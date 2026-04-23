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

const VideoTypeEnum = z.enum([
  'movie', 'series', 'anime', 'variety',
  'documentary', 'short', 'sports', 'music',
  'news', 'kids', 'other',
])
const SortEnum = z.enum(['hot', 'rating', 'latest', 'updated'])
const PeriodEnum = z.enum(['today', 'week', 'month'])

export async function videoRoutes(fastify: FastifyInstance) {
  const videoService = new VideoService(db, undefined, redis)

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
  fastify.get('/videos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // short_id 格式：8 位字母数字
    if (!/^[A-Za-z0-9_-]{8}$/.test(id)) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const video = await videoService.findByShortId(id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在或已被删除', status: 404 },
      })
    }

    return reply.send({ data: video })
  })
}
