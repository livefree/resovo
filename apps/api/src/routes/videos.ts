/**
 * videos.ts — 视频路由
 * GET /videos               视频列表（含过滤和分页）
 * GET /videos/trending      热门视频
 * GET /videos/count-by-type 各类型视频数量（TTL 300s）
 * GET /videos/:id           视频详情（by short_id）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { VideoService } from '@/api/services/VideoService'
import { VideoPlayEventService } from '@/api/services/VideoPlayEventService'
import { VIDEO_GENRES, AUDIO_LANGUAGE_CANONICALS } from '@/types'

// ADR-216 STATS-03-A2：公共写端点 body（含长度上限防超长冲击唯一索引/表膨胀，Codex MEDIUM）
const PlayEventBodySchema = z.object({
  sourceId: z.string().uuid().optional(),
  // 数值上限防越界（Codex D-1）：超界 → 干净 422，不抛 DB INT range error
  episodeNumber: z.number().int().min(1).max(9999).optional(),
  playSessionId: z.string().min(16).max(32),
  idempotencyKey: z.string().regex(/^[0-9a-f]{64}$/),
  watchSeconds: z.number().int().min(0).max(86400), // ≤24h
  durationSeconds: z.number().int().positive().max(86400).optional(),
  occurredAt: z.string().datetime(),
  locale: z.string().max(16).optional(),
  referrerPath: z.string().max(2048).optional(),
})

const VideoTypeEnum = z.enum([
  'movie', 'series', 'anime', 'variety',
  'documentary', 'short', 'sports', 'music',
  'news', 'kids', 'other',
])
const GenreEnum = z.enum(VIDEO_GENRES)
const AudioLangEnum = z.enum(AUDIO_LANGUAGE_CANONICALS)
const SortEnum = z.enum(['hot', 'rating', 'latest', 'updated'])
const PeriodEnum = z.enum(['today', 'week', 'month'])

export async function videoRoutes(fastify: FastifyInstance) {
  const videoService = new VideoService(db, undefined, redis)
  const videoPlayEventService = new VideoPlayEventService(db, redis)

  // ── POST /videos/:id/play-events ─────────────────────────────
  // ADR-216 公共写端点：匿名 qualified play 上报（202 fire-and-forget）。
  // preHandler optionalAuthenticate 填 request.user（仅验 JWT+Redis 黑名单，不查 users，D-216-5）。
  fastify.post(
    '/videos/:id/play-events',
    { preHandler: fastify.optionalAuthenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      // short_id 格式（沿用 GET /videos/:id 口径）→ 非法 404 NOT_FOUND（不新造 code）
      if (!/^[A-Za-z0-9_-]{8}$/.test(id)) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }
      const parsed = PlayEventBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
        })
      }
      const body = parsed.data
      const result = await videoPlayEventService.recordPlayEvent({
        shortId: id,
        sourceId: body.sourceId ?? null,
        episodeNumber: body.episodeNumber ?? null,
        playSessionId: body.playSessionId,
        idempotencyKey: body.idempotencyKey,
        watchSeconds: body.watchSeconds,
        durationSeconds: body.durationSeconds ?? null,
        occurredAt: body.occurredAt,
        locale: body.locale ?? null,
        referrerPath: body.referrerPath ?? null,
        visitorHash: request.visitorHash ?? null,
        visitorIsEphemeral: request.visitorIsEphemeral ?? false,
        userId: request.user?.userId ?? null, // D-216-5：匿名 null，不查 users
        ip: request.ip,
        userAgent:
          typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      })
      if (!result.ok) {
        switch (result.reason) {
          case 'not_found':
            return reply
              .code(404)
              .send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
          case 'invalid_source':
            return reply
              .code(422)
              .send({ error: { code: 'INVALID_SOURCE', message: '线路无效', status: 422 } })
          case 'rate_limited':
            return reply
              .code(429)
              .send({ error: { code: 'RATE_LIMITED', message: '操作过于频繁，请稍候', status: 429 } })
        }
      }
      return reply.code(202).send({ data: { received: true } })
    },
  )

  // ── GET /videos/trending ─────────────────────────────────────
  // 注意：trending 必须在 :id 之前注册，否则 "trending" 会被识别为 shortId
  fastify.get('/videos/trending', async (request, reply) => {
    const QuerySchema = z.object({
      period: PeriodEnum.default('week'),
      type: VideoTypeEnum.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const data = await videoService.trending(parsed.data)
    return reply.send({ data })
  })

  // ── GET /videos ──────────────────────────────────────────────
  fastify.get('/videos', async (request, reply) => {
    const QuerySchema = z.object({
      type: VideoTypeEnum.optional(),
      category: z.string().optional(),
      genre: GenreEnum.optional(),
      lang: AudioLangEnum.optional(),
      year: z.coerce.number().int().min(1900).max(2100).optional(),
      country: z.string().max(2).optional(),
      rating_min: z.coerce.number().min(0).max(10).optional(),
      sort: SortEnum.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { rating_min: ratingMin, ...rest } = parsed.data
    const result = await videoService.list({ ...rest, ratingMin })
    return reply.send(result)
  })

  // ── GET /videos/count-by-type ────────────────────────────────
  // 注意：必须在 :id 之前注册，否则 "count-by-type" 会被识别为 shortId
  fastify.get('/videos/count-by-type', async (_request, reply) => {
    const data = await videoService.countByType()
    return reply.send({ data })
  })

  // ── GET /videos/:id ──────────────────────────────────────────
  // ADR-160 D-160-4a：?preview=admin 时走 admin preview 路径（放行 internal/hidden）
  // 走 preview 时需 admin/moderator 鉴权（preHandler 在 handler 内按 query 派发 / 公开路径无鉴权）
  fastify.get('/videos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // short_id 格式：8 位字母数字
    if (!/^[A-Za-z0-9_-]{8}$/.test(id)) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    // preview query 解析（ADR-160 D-160-4a）
    const PreviewQuerySchema = z.object({
      preview: z.literal('admin').optional(),
    })
    const previewParsed = PreviewQuerySchema.safeParse(request.query)
    if (!previewParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const preview = previewParsed.data.preview === 'admin'

    // preview 模式必须 admin/moderator 鉴权（ADR-160 D-160-1 双因素 + D-160-4b）
    if (preview) {
      await fastify.authenticate(request, reply)
      if (reply.sent) return
      await fastify.requireRole(['admin', 'moderator'])(request, reply)
      if (reply.sent) return
    }

    const video = await videoService.findByShortId(id, preview ? { preview: true } : undefined)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在或已被删除', status: 404 },
      })
    }

    return reply.send({ data: video })
  })
}
