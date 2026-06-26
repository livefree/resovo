/**
 * admin/analytics.video-plays.ts — 后台视频播放分析只读端点（ADR-217 / SEQ-20260624-02 STATS-07-A）
 *
 * GET /admin/analytics/video-plays/overview   — period 窗口概览（adminOnly）
 * GET /admin/analytics/video-plays/trend       — 每日趋势 N 点 zero-fill（adminOnly）
 * GET /admin/analytics/video-plays/top-videos  — 热门视频榜前 limit（adminOnly）
 *
 * 分层（D-217-9）：Route → VideoPlayAnalyticsService → videoPlayStats query；route 零内联 SQL，
 *   不 import query 模块（防直调越层）；`db` 仅用于 service 构造（同 analytics.ts DI 约定）。
 * 入参 per-endpoint 严格 zod（.strict() 拒未知键/空串/越界 → 422 VALIDATION_ERROR，D-217-8）。
 * 只读端点无 audit（沿用 legacy analytics 范式，D-217-1）。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { VideoPlayAnalyticsService } from '@/api/services/VideoPlayAnalyticsService'

const PeriodSchema = z.enum(['7d', '30d', '90d'])

// overview / trend：仅接受 period（不接受 limit，.strict() 拒未知键）
const PeriodOnlyQuerySchema = z
  .object({
    period: PeriodSchema.optional().default('7d'),
  })
  .strict()

// top-videos：period + limit∈[1,100]（默认 20）；空串/NaN/越界 → 422
const TopVideosQuerySchema = z
  .object({
    period: PeriodSchema.optional().default('7d'),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict()

const VALIDATION_ERROR = { error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } }

export async function adminVideoPlayAnalyticsRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const service = new VideoPlayAnalyticsService(db)

  fastify.get('/admin/analytics/video-plays/overview', { preHandler: auth }, async (request, reply) => {
    const parsed = PeriodOnlyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send(VALIDATION_ERROR)
    }
    const data = await service.getOverview(parsed.data.period)
    return reply.send({ data })
  })

  fastify.get('/admin/analytics/video-plays/trend', { preHandler: auth }, async (request, reply) => {
    const parsed = PeriodOnlyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send(VALIDATION_ERROR)
    }
    const data = await service.getTrend(parsed.data.period)
    return reply.send({ data })
  })

  fastify.get('/admin/analytics/video-plays/top-videos', { preHandler: auth }, async (request, reply) => {
    const parsed = TopVideosQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send(VALIDATION_ERROR)
    }
    const data = await service.getTopVideos(parsed.data.period, parsed.data.limit)
    return reply.send({ data })
  })
}
