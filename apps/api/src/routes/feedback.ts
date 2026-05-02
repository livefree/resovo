/**
 * feedback.ts — POST /feedback/playback（前台；外部路径 /v1/feedback/playback）
 * CHG-SN-4-05: 播放反馈入口
 * - rate-limit: (hash(IP), sourceId) 每分钟 1 次
 * - PII: 只存 hash(IP) 头 8 字节，不存 userId / IP 原值
 * - 副作用 fire-and-forget: probe_status 更新 / quality_detected 写入 / health event 入队
 */

import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { insertHealthEvent } from '@/api/db/queries/sourceHealthEvents'

const PlaybackFeedbackBodySchema = z.object({
  videoId: z.string().uuid(),
  sourceId: z.string().uuid(),
  success: z.boolean(),
  resolutionWidth: z.number().int().positive().optional(),
  resolutionHeight: z.number().int().positive().optional(),
  bufferingCount: z.number().int().min(0).optional(),
  errorCode: z.string().max(64).optional(),
})

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 8)
}

function getClientIp(request: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
  const xff = request.headers['x-forwarded-for']
  const raw = Array.isArray(xff) ? xff[0] : xff
  return (raw?.split(',')[0]?.trim()) ?? request.socket?.remoteAddress ?? 'unknown'
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

async function countRecentFailures(ipHash: string, sourceId: string): Promise<number> {
  const key = `fb:fail:${ipHash}:${sourceId}`
  const val = await redis.get(key)
  return val ? parseInt(val, 10) : 0
}

async function incrementFailureCount(ipHash: string, sourceId: string): Promise<number> {
  const key = `fb:fail:${ipHash}:${sourceId}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, 300)  // 5 分钟窗口
  }
  return count
}

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.post('/feedback/playback', async (request, reply) => {
    const parsed = PlaybackFeedbackBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }

    const { videoId, sourceId, success, resolutionWidth, resolutionHeight, errorCode } = parsed.data
    const ip = getClientIp(request as Parameters<typeof getClientIp>[0])
    const ipHash = hashIp(ip)

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
      await db.query(
        `UPDATE video_sources
         SET probe_status = CASE WHEN probe_status = 'dead' THEN 'ok' ELSE probe_status END,
             last_probed_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL`,
        [sourceId],
      ).catch((e: unknown) => {
        process.stderr.write(`[feedback] probe update failed: ${String(e)}\n`)
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
          process.stderr.write(`[feedback] quality update failed: ${String(e)}\n`)
        })
      }
    } else {
      await insertHealthEvent(db, {
        videoId,
        sourceId,
        origin: 'feedback_driven',
        errorDetail: errorCode ?? null,
        processedAt: new Date().toISOString(),
      }).catch((e: unknown) => {
        process.stderr.write(`[feedback] health event insert failed: ${String(e)}\n`)
      })

      const failCount = await incrementFailureCount(ipHash, sourceId).catch(() => 0)
      if (failCount >= 3) {
        await insertHealthEvent(db, {
          videoId,
          sourceId,
          origin: 'feedback_driven',
          errorDetail: errorCode ?? null,
          processedAt: null,
        }).catch((e: unknown) => {
          process.stderr.write(`[feedback] queue signal insert failed: ${String(e)}\n`)
        })
      }
    }
  }
}
