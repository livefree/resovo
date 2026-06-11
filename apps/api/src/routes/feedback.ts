/**
 * feedback.ts — POST /feedback/playback（前台；外部路径 /v1/feedback/playback）
 * CHG-SN-4-05: 播放反馈入口
 * - rate-limit: (hash(IP), sourceId) 每分钟 1 次
 * - PII: 只存 hash(IP) 头 8 字节，不存 userId / IP 原值
 * - 副作用 fire-and-forget: probe_status 更新 / quality_detected 写入 / health event 入队
 *
 * CHG-SN-5-PRE-01-D（DEBT-SN-4-05-B）：客户端 IP 改用 Fastify request.ip（受 trustProxy 白名单保护），
 * 不再手动解析 X-Forwarded-For；攻击者无法通过伪造 XFF 头绕过 rate-limit。
 */

import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { insertHealthEvent } from '@/api/db/queries/sourceHealthEvents'
import { baseLogger } from '@/api/lib/logger'

const PlaybackFeedbackBodySchema = z.object({
  videoId: z.string().uuid(),
  sourceId: z.string().uuid(),
  success: z.boolean(),
  resolutionWidth: z.number().int().positive().optional(),
  resolutionHeight: z.number().int().positive().optional(),
  bufferingCount: z.number().int().min(0).optional(),
  errorCode: z.string().max(64).optional(),
})

/**
 * SRCHEALTH-P2-2 / F4 前置：EMA 半衰期 7 天（arch-reviewer claude-opus-4-8 裁决 D）。
 * 推导：P2-1 上报 per-sourceId 去抖 + 1/N 采样 → 单源日均有效样本个位~十位；
 * 7 天让约一周前样本权重衰减到 0.5（两周前 0.25）——近期质量主导但不健忘；
 * 稳态权重量级与 P3-2 置信度缩放 N（个位~十位）匹配。
 * 调参须配合 P3-2 影子验证重新校准（方案 §4 时序硬依赖链），故为代码常量不进 env。
 */
const FB_HALF_LIFE_SECONDS = 7 * 24 * 60 * 60

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 8)
}

/**
 * EMA 反馈落账（SRCHEALTH-P2-2）：单条 UPDATE 内完成「读旧值 → 半衰 → 并入观测 → 写回」。
 *
 * ⚠️ 并发安全依赖 SQL 形态（arch-reviewer 二轮裁决，勿为 DRY 改写）：
 * decay 输入列（fb_score / fb_sample_weight / last_feedback_at）必须**直接引用目标表 vs**——
 * PG READ COMMITTED 下并发 UPDATE 同行经行级锁串行化，EvalPlanQual 重求值会把目标行列
 * 刷新为最新提交版本，故无 last-write-lost。若改写为 FROM 子查询 / CTE / LATERAL 取
 * decay 输入，EPQ 不重跑这些子计划（用旧快照缓存元组）→ 并发反馈被部分覆盖且产生
 * 新旧版本混合值。decay 表达式重复书写三遍是该保证的代价（正确性 #1 > 改动收敛 #5）。
 *
 * 冷启动：last_feedback_at IS NULL → decay 强制 0 → 首样本 fb_score=obs / weight=1（无先验）。
 * 本卡只写不进评分（P3-2 影子验证硬前置）。
 */
async function recordFeedbackEma(sourceId: string, obs: 0 | 1): Promise<void> {
  await db.query(
    `UPDATE video_sources AS vs
     SET
       fb_score =
         (COALESCE(vs.fb_score, 0)
            * (CASE WHEN vs.last_feedback_at IS NULL THEN 0
                    ELSE COALESCE(vs.fb_sample_weight, 0)
                         * power(0.5, EXTRACT(EPOCH FROM (NOW() - vs.last_feedback_at)) / $3)
               END)
          + $2)
         /
         ((CASE WHEN vs.last_feedback_at IS NULL THEN 0
                ELSE COALESCE(vs.fb_sample_weight, 0)
                     * power(0.5, EXTRACT(EPOCH FROM (NOW() - vs.last_feedback_at)) / $3)
           END) + 1),
       fb_sample_weight =
         (CASE WHEN vs.last_feedback_at IS NULL THEN 0
               ELSE COALESCE(vs.fb_sample_weight, 0)
                    * power(0.5, EXTRACT(EPOCH FROM (NOW() - vs.last_feedback_at)) / $3)
          END) + 1,
       last_feedback_at = NOW()
     WHERE vs.id = $1 AND vs.deleted_at IS NULL`,
    [sourceId, obs, FB_HALF_LIFE_SECONDS],
  ).catch((e: unknown) => {
    baseLogger.warn({ err: e, sourceId, obs }, '[feedback] ema update failed')
  })
}

function mapHeightToQuality(h: number): string {
  if (h >= 2160) return '4K'
  if (h >= 1440) return '2K'
  if (h >= 1080) return '1080P'
  if (h >= 720) return '720P'
  if (h >= 480) return '480P'
  if (h >= 360) return '360P'
  return '240P'
}

async function checkRateLimit(ipHash: string, sourceId: string): Promise<boolean> {
  const key = `fb:rl:${ipHash}:${sourceId}`
  const res = await redis.set(key, '1', 'EX', 60, 'NX')
  return res !== null
}

/**
 * SRCHEALTH-P2-3 / F3 + §8 C3：信任门槛统一「独立佐证」原语——SET 语义（SADD+SCARD+TTL）。
 * 禁用 INCR：那是同一 ipHash 计次，复活侧照搬会实现成「同一客户端成功 2 次即复活」。
 *
 * TTL 设置用 ttl<0 检查而非 scard===1 判断：SADD 不像 INCR 有原子递增返回值——
 * 两个并发首次 SADD（不同 member）后双方 SCARD 都读到 2，谁都不设 TTL → 永久 key
 * （复活门槛被脏状态永远满足）。ttl<0（-1=无过期）由任意后续请求自愈，重复 EXPIRE 同值无害。
 */
async function countDistinctIps(key: string, ipHash: string, windowSeconds: number): Promise<number> {
  await redis.sadd(key, ipHash)
  const ttl = await redis.ttl(key)
  if (ttl < 0) {
    await redis.expire(key, windowSeconds)  // 固定窗口（对齐原失败侧 count===1 时设置的语义）
  }
  return redis.scard(key)
}

/** 复活门槛：窗口内 ≥2 独立 ipHash 成功才允许 dead→ok（方案 §3 P2-3） */
const REVIVE_WINDOW_SECONDS = 300
const REVIVE_DISTINCT_IPS = 2
/** recheck 触发：窗口内 ≥3 独立 ipHash 失败才入队信号（原 INCR 3 次/5min 迁移，阈值/窗口保留） */
const FAIL_WINDOW_SECONDS = 300
const FAIL_DISTINCT_IPS = 3

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.post('/feedback/playback', async (request, reply) => {
    const parsed = PlaybackFeedbackBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }

    const { videoId, sourceId, success, resolutionWidth, resolutionHeight, errorCode } = parsed.data
    // request.ip 由 Fastify 根据 trustProxy 白名单解析；未配置时回落到 socket.remoteAddress（XFF 被忽略）
    const ipHash = hashIp(request.ip)

    const allowed = await checkRateLimit(ipHash, sourceId).catch(() => true)
    if (!allowed) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍候', status: 429 } })
    }

    void handleFeedbackSideEffects({ videoId, sourceId, success, resolutionWidth, resolutionHeight, errorCode, ipHash })

    return reply.code(202).send({ data: { received: true } })
  })

  async function handleFeedbackSideEffects(opts: {
    videoId: string
    sourceId: string
    success: boolean
    resolutionWidth?: number
    resolutionHeight?: number
    errorCode?: string
    ipHash: string
  }) {
    const { videoId, sourceId, success, resolutionWidth, resolutionHeight, errorCode, ipHash } = opts

    if (success) {
      // SRCHEALTH-P2-3：dead→ok 复活需窗口内 ≥2 独立 ipHash（redis 故障 catch→0 = fail-safe 不复活）；
      // 未达门槛仅刷 last_probed_at（保留 CHG-SN-4-05 现状「success 反馈视为 probe 信号」，
      // 该时间戳语义与 P3-1 新鲜度衰减的关系留 P3-1 裁决）
      const distinctSuccessIps = await countDistinctIps(
        `fb:revive:${sourceId}`, ipHash, REVIVE_WINDOW_SECONDS,
      ).catch(() => 0)
      const reviveSql = distinctSuccessIps >= REVIVE_DISTINCT_IPS
        ? `UPDATE video_sources
           SET probe_status = CASE WHEN probe_status = 'dead' THEN 'ok' ELSE probe_status END,
               last_probed_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`
        : `UPDATE video_sources
           SET last_probed_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`
      await db.query(reviveSql, [sourceId]).catch((e: unknown) => {
        baseLogger.warn({ err: e, sourceId }, '[feedback] probe update failed')
      })

      if (resolutionHeight !== undefined) {
        const qualityDetected = mapHeightToQuality(resolutionHeight)
        await db.query(
          `UPDATE video_sources
           SET quality_detected = $1,
               quality_source = 'player_feedback',
               resolution_width = $2,
               resolution_height = $3,
               detected_at = NOW()
           WHERE id = $4 AND deleted_at IS NULL AND quality_detected IS NULL`,
          [qualityDetected, resolutionWidth ?? null, resolutionHeight, sourceId],
        ).catch((e: unknown) => {
          baseLogger.warn({ err: e, sourceId }, '[feedback] quality update failed')
        })
      }

      // SRCHEALTH-P2-2：EMA 落账（obs=1），与复活/quality UPDATE 各自独立 fire-and-forget——
      // 失败隔离（arch-reviewer 裁决 E）：任一 UPDATE 失败不连累其他（如 CHECK 触发只 warn EMA 条）
      await recordFeedbackEma(sourceId, 1)
    } else {
      await insertHealthEvent(db, {
        videoId,
        sourceId,
        origin: 'feedback_driven',
        errorDetail: errorCode ?? null,
        processedAt: new Date().toISOString(),
      }).catch((e: unknown) => {
        baseLogger.warn({ err: e, videoId, sourceId }, '[feedback] health event insert failed')
      })

      // SRCHEALTH-P2-3：recheck 触发由「同一 ipHash INCR 3 次」迁移为「≥3 独立 ipHash」
      // （key 族 fb:fail:set:* 新建；旧 fb:fail:{ipHash}:* 不再写入，存量 TTL 300s 自然过期）
      const distinctFailureIps = await countDistinctIps(
        `fb:fail:set:${sourceId}`, ipHash, FAIL_WINDOW_SECONDS,
      ).catch(() => 0)
      if (distinctFailureIps >= FAIL_DISTINCT_IPS) {
        await insertHealthEvent(db, {
          videoId,
          sourceId,
          origin: 'feedback_driven',
          errorDetail: errorCode ?? null,
          processedAt: null,
        }).catch((e: unknown) => {
          baseLogger.warn({ err: e, videoId, sourceId }, '[feedback] queue signal insert failed')
        })
      }

      // SRCHEALTH-P2-2：EMA 落账（obs=0）。与 redis INCR 正交（arch-reviewer 裁决 E）：
      // INCR 是同 ipHash 5min 瞬时事件触发器（驱动 recheck），EMA 是跨客户端持久统计量（P3-2 驱动排序）
      await recordFeedbackEma(sourceId, 0)
    }
  }
}
