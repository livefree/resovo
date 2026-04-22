/**
 * image-broken.ts — 前端图片破损上报 beacon 端点
 * POST /internal/image-broken
 *
 * 规则（ADR-046 §D3）：
 *   - 无鉴权，不查 users 表
 *   - reason 仅允许 client_load_error / empty_src（服务端 fetch_* 禁止前端上报）
 *   - video_id 不预查 videos 表；FK violation → 204 静默丢弃（防 video_id 枚举）
 *   - 同 IP 10 分钟内 > 50 次 → 204 静默丢弃（不返回 429，防信息泄露）
 *   - upsert dedup key: (video_id, image_kind, url_hash_prefix, bucket_start)
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { upsertBrokenImageEvent } from '@/api/db/queries/imageHealth'

// ── IP 限速（内存，进程级，可接受精度损失）─────────────────────────

const ipCallMap = new Map<string, { count: number; resetAt: number }>()
const IP_WINDOW_MS = 10 * 60_000   // 10 分钟
const IP_LIMIT = 50

function checkIpLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipCallMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipCallMap.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= IP_LIMIT
}

// ── Body Schema ───────────────────────────────────────────────────

const ImageKindEnum = z.enum(['poster', 'backdrop', 'logo', 'banner_backdrop', 'stills', 'thumbnail'])
const ClientReasonEnum = z.enum(['client_load_error', 'empty_src'])

const BodySchema = z.object({
  video_id: z.string().uuid(),
  image_kind: ImageKindEnum,
  url: z.string().url().max(2048),
  reason: ClientReasonEnum,
})

// ── 是否 FK violation ────────────────────────────────────────────

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23503'
  )
}

// ── Route ─────────────────────────────────────────────────────────

export async function internalImageBrokenRoutes(fastify: FastifyInstance) {
  fastify.post('/internal/image-broken', async (request, reply) => {
    // IP 限速：超限静默丢弃
    const ip = request.ip
    if (!checkIpLimit(ip)) {
      return reply.code(204).send()
    }

    // Body 校验
    const parsed = BodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body',
          status: 400,
        },
      })
    }

    const { video_id, image_kind, url, reason } = parsed.data

    try {
      await upsertBrokenImageEvent(db, {
        videoId: video_id,
        imageKind: image_kind,
        url,
        eventType: reason,
      })
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        // video_id 不存在 → 静默丢弃（不暴露是否存在）
        return reply.code(204).send()
      }
      throw err
    }

    return reply.code(204).send()
  })
}
