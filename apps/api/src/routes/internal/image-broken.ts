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
 *
 * ADR-213 D-213-6（方案 C·双真源溶解）：端点对外契约完全不变；内部由「仅写 events」改为
 * **双写** —— ① 受治理 4 kind 写 media_catalog.<kind>_client_error_at 浏览器自过期信号列
 * （URL 同源守卫，驱动健康读路径）② 保留 upsertBrokenImageEvent 作纯遥测（趋势/域名/brokenLast7Days）。
 * 两写各自 try、互不阻断，失败结构化 warn（best-effort）。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { markCatalogClientError, upsertBrokenImageEvent } from '@/api/db/queries/imageHealth'

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

// ── 信号列受治理 kind 守卫（ADV-213-6）──────────────────────────────
// 仅 poster/backdrop/logo/banner_backdrop 有 <kind>_client_error_at 列；
// stills（JSONB 数组）/ thumbnail（video_episode_images）不在 problem-images 板范围 → 跳信号列、仅遥测。
const SIGNAL_KINDS = ['poster', 'backdrop', 'logo', 'banner_backdrop'] as const
type SignalKind = (typeof SIGNAL_KINDS)[number]
function isSignalKind(kind: string): kind is SignalKind {
  return (SIGNAL_KINDS as readonly string[]).includes(kind)
}

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

    // ① 浏览器自过期信号列（仅 4 受治理 kind + URL 同源守卫）—— ADR-213 D-213-6
    //    驱动健康读路径；best-effort：失败不阻断遥测双写、不影响 204 契约。
    if (isSignalKind(image_kind)) {
      try {
        await markCatalogClientError(db, { videoId: video_id, kind: image_kind, url })
      } catch (err) {
        request.log.warn(
          { err, video_id, image_kind, write_target: 'client_error_signal' },
          'image-broken 信号列写入失败（best-effort 降级，健康判定不受阻）'
        )
      }
    }

    // ② events 双写作纯遥测（趋势/域名/brokenLast7Days 仍需 client_load_error 流）—— ADR-213 D-213-6
    //    FK violation（video_id 不存在）→ 静默 204（反枚举，契约不变）；其余失败 best-effort warn。
    try {
      await upsertBrokenImageEvent(db, {
        videoId: video_id,
        imageKind: image_kind,
        url,
        eventType: reason,
      })
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        return reply.code(204).send()
      }
      request.log.warn(
        { err, video_id, image_kind, write_target: 'broken_event_telemetry' },
        'image-broken 遥测事件写入失败（best-effort 降级）'
      )
    }

    return reply.code(204).send()
  })
}
