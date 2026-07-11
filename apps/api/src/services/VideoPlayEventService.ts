// VideoPlayEventService.ts — 视频播放上报写服务（ADR-216 / SEQ-20260624-02 STATS-03-A2）
//
// 编排 POST /videos/:id/play-events 业务：解析 short_id + 公开可见、source 校验、occurredAt 非对称 clamp、
// IP/UA 哈希、双维 INCR 限流（fail-closed）、双防线幂等插入。route 不含业务逻辑；本服务不查 users（D-216-5）。

import { createHmac } from 'node:crypto'
import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import { findVideoByShortId } from '@/api/db/queries/videos'
import {
  insertVideoPlayEvent,
  isActiveSourceOfVideo,
  type InsertVideoPlayEventInput,
} from '@/api/db/queries/videoPlayStats'

// D-216-8：两条唯一约束名（与 migration 128 一致）；命中任一 23505 当幂等成功
const IDEMPOTENCY_CONSTRAINT = 'uq_video_play_events_idempotency_key'
const SESSION_VIDEO_EPISODE_CONSTRAINT = 'uq_video_play_events_session_video_episode'

// D-216-9：occurredAt 非对称容差（过去 −30min / 未来 +2min），超窗回退 ingested_at
const OCCURRED_AT_PAST_TOLERANCE_MS = 30 * 60 * 1000
const OCCURRED_AT_FUTURE_TOLERANCE_MS = 2 * 60 * 1000

// 双维固定窗限流（阈值式，允许幂等重试通过、超阈拦截刷量）；窗 60s
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_VISITOR_MAX = 10 // 同 visitor+video+ep / 分钟
const RATE_LIMIT_IP_MAX = 30 // 同 ip+video+ep / 分钟（高于 visitor 维，容 NAT 出口共享）

// 原子幂等 marker（Redis SET NX）TTL：覆盖 fire-and-forget 重试窗 + 关闭并发 TOCTOU（Codex BLOCK-B 复审）。
// 过期后的迟到重试由 DB 唯一约束兜底（仍幂等），故 TTL 取较短值控内存。
const IDEMPOTENCY_MARKER_TTL_SECONDS = 300

export interface RecordPlayEventInput {
  shortId: string
  sourceId: string | null
  episodeNumber: number | null
  playSessionId: string
  idempotencyKey: string
  watchSeconds: number
  durationSeconds: number | null
  occurredAt: string
  locale: string | null
  referrerPath: string | null
  /** A1 中间件解析（null=无身份/fail-safe） */
  visitorHash: string | null
  visitorIsEphemeral: boolean
  /** optionalAuthenticate 填充（匿名 null，D-216-5；不查 users） */
  userId: string | null
  ip: string
  userAgent: string | null
}

export type RecordPlayEventResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'invalid_source' | 'rate_limited' }

// HMAC 而非裸 sha256：IPv4 空间可枚举，含密钥防离线反推 ip/ua（Codex MEDIUM-D2）。
// **生产强度真源**：与 A1 visitor-cookie 共用 SERVER_VISITOR_SECRET；A1 `setupVisitorCookie` boot 期
// `assertVisitorSecretStrength` 已对生产「缺失/dev 默认/<32 字符」fail-fast 拒绝启动 → 生产绝不静默回退。
// `||`（非 `??`）令空串也回退（dev/test 兜底；生产已被 A1 boot 拦截）。
const VISITOR_SECRET_FALLBACK = 'dev-visitor-secret-replace-in-production'
function hmacHex(input: string): string {
  const secret = process.env.SERVER_VISITOR_SECRET || VISITOR_SECRET_FALLBACK
  return createHmac('sha256', secret).update(input).digest('hex').slice(0, 32)
}

/** pg 唯一约束冲突（23505）且命中指定约束名之一（避免无差别吞 23505，D-216-8 M1）。 */
function isUniqueViolationOn(err: unknown, constraints: readonly string[]): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; constraint?: unknown }
  return (
    e.code === '23505' &&
    typeof e.constraint === 'string' &&
    constraints.includes(e.constraint)
  )
}

export class VideoPlayEventService {
  constructor(
    private readonly db: Pool,
    private readonly redis: Redis,
  ) {}

  async recordPlayEvent(input: RecordPlayEventInput): Promise<RecordPlayEventResult> {
    // ① 解析 short_id + 公开可见（复用 canonical 公开过滤：is_published + 未软删 + visibility=public）
    const video = await findVideoByShortId(this.db, input.shortId)
    if (!video) return { ok: false, reason: 'not_found' }

    // ② source 校验（给定时须属该 video + active + 未软删）
    if (input.sourceId) {
      const valid = await isActiveSourceOfVideo(this.db, input.sourceId, video.id)
      if (!valid) return { ok: false, reason: 'invalid_source' }
    }

    // ③ 原子幂等 marker（Redis SET NX，Codex BLOCK-B 复审）：关闭并发 TOCTOU——并发/近期同 key 仅一个获 marker，
    //    其余直接幂等 202、**不消耗限流 INCR**。redis 故障 → fail-closed（429）。DB 唯一约束仍为最终幂等真源。
    const markerKey = `pe:idem:${input.idempotencyKey}`
    const marker = await this.acquireIdempotencyMarker(markerKey)
    if (marker === 'duplicate') return { ok: true }
    if (marker === 'redis_error') return { ok: false, reason: 'rate_limited' }
    // 自此持有 marker；非成功出口须释放（防迟到重试误判已处理而丢事件）

    // ④ visitor 身份：A1 给 null（fail-safe）时回退 ephemeral（visitor_hash NOT NULL；不计 UV）。ip/ua 经 HMAC。
    const ipHash = hmacHex(`ip:${input.ip}`)
    const userAgentHash = input.userAgent ? hmacHex(`ua:${input.userAgent}`) : null
    const visitorHash = input.visitorHash ?? hmacHex(`vfallback:${input.ip}|${input.userAgent ?? ''}`)
    const visitorIsEphemeral = input.visitorIsEphemeral || input.visitorHash === null

    // ⑤ 双维 INCR 限流（fail-closed）——marker 已短路重试，故此处仅对新 key 计数
    const allowed = await this.checkRateLimit(visitorHash, ipHash, video.id, input.episodeNumber)
    if (!allowed) {
      await this.releaseIdempotencyMarker(markerKey)
      return { ok: false, reason: 'rate_limited' }
    }

    // ⑥ ingestedAt 单一基准：clamp 基准 + 显式写 ingested_at → occurred_at 回退值恒 == ingested_at（Codex MEDIUM-C）
    const ingestedAt = new Date()
    const occurredAt = this.clampOccurredAt(input.occurredAt, ingestedAt)

    // ⑦ 双防线幂等插入
    const insertInput: InsertVideoPlayEventInput = {
      idempotencyKey: input.idempotencyKey,
      videoId: video.id,
      sourceId: input.sourceId,
      episodeNumber: input.episodeNumber,
      playSessionId: input.playSessionId,
      visitorHash,
      visitorIsEphemeral,
      ipHash,
      userId: input.userId,
      watchSeconds: input.watchSeconds,
      durationSeconds: input.durationSeconds,
      locale: input.locale,
      referrerPath: input.referrerPath,
      userAgentHash,
      occurredAt,
      ingestedAt: ingestedAt.toISOString(),
    }
    try {
      // ON CONFLICT(idempotency_key) 跳过 = 幂等命中（inserted:false 仍 ok）；marker 保留至 TTL
      await insertVideoPlayEvent(this.db, insertInput)
      return { ok: true }
    } catch (err) {
      // 第二防线 session/video/episode 23505（ON CONFLICT 不捕获）→ 幂等成功；其余 23505 上抛 500
      if (isUniqueViolationOn(err, [IDEMPOTENCY_CONSTRAINT, SESSION_VIDEO_EPISODE_CONSTRAINT])) {
        return { ok: true }
      }
      // 瞬态错误（连接断等）→ 释放 marker，允许重试重做（防 marker 残留致事件丢失）
      await this.releaseIdempotencyMarker(markerKey)
      throw err
    }
  }

  /** 原子获取幂等 marker（SET NX EX）。acquired=首次 / duplicate=已存在（并发或近期）/ redis_error=故障（fail-closed）。 */
  private async acquireIdempotencyMarker(
    key: string,
  ): Promise<'acquired' | 'duplicate' | 'redis_error'> {
    try {
      const r = await this.redis.set(key, '1', 'EX', IDEMPOTENCY_MARKER_TTL_SECONDS, 'NX')
      return r === null ? 'duplicate' : 'acquired'
    } catch {
      return 'redis_error'
    }
  }

  private async releaseIdempotencyMarker(key: string): Promise<void> {
    await this.redis.del(key).catch(() => undefined)
  }

  /** 双维固定窗 INCR 限流；返回 true=放行 / false=拦截。fail-closed：任何 redis 异常→拦截。 */
  private async checkRateLimit(
    visitorHash: string,
    ipHash: string,
    videoId: string,
    episodeNumber: number | null,
  ): Promise<boolean> {
    const ep = episodeNumber ?? 0
    const visitorKey = `pe:rl:v:${visitorHash}:${videoId}:${ep}`
    const ipKey = `pe:rl:i:${ipHash}:${videoId}:${ep}`
    try {
      const visitorCount = await this.incrWindow(visitorKey)
      const ipCount = await this.incrWindow(ipKey)
      return visitorCount <= RATE_LIMIT_VISITOR_MAX && ipCount <= RATE_LIMIT_IP_MAX
    } catch {
      return false // fail-closed
    }
  }

  private async incrWindow(key: string): Promise<number> {
    const count = await this.redis.incr(key)
    if (count === 1) await this.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS)
    return count
  }

  /** D-216-9：client occurredAt 在 [ingested−30min, ingested+2min] 内则信任，否则回退 ingested_at。 */
  private clampOccurredAt(clientISO: string, ingestedAt: Date): string {
    const t = Date.parse(clientISO)
    if (Number.isNaN(t)) return ingestedAt.toISOString()
    const lower = ingestedAt.getTime() - OCCURRED_AT_PAST_TOLERANCE_MS
    const upper = ingestedAt.getTime() + OCCURRED_AT_FUTURE_TOLERANCE_MS
    if (t < lower || t > upper) return ingestedAt.toISOString()
    return new Date(t).toISOString()
  }
}
