/**
 * admin/sources-matrix.ts — /admin/sources 线路矩阵视图端点（ADR-117 / CHG-SN-5-11）
 *
 * GET  /admin/sources/video-groups           — 视频分组列表（含聚合信号状态）
 * GET  /admin/sources/video-groups/stats     — KPI 统计（total / active / dead / orphan）
 * GET  /admin/sources/video-groups/:videoId/matrix — 单视频线路×集数矩阵
 * GET  /admin/source-line-aliases            — 全局别名列表
 * PUT  /admin/source-line-aliases/:siteKey/:sourceName — 新建/更新别名（admin only）
 *
 * 鉴权：读端点 moderator+admin；PUT 写端点 admin only（ADR-117 D-117-1）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import {
  SourcesMatrixService,
  VideoGroupsQuerySchema,
  UpsertAliasSchema,
} from '@/api/services/SourcesMatrixService'
import { isAppError } from '@/api/lib/errors'

export async function adminSourcesMatrixRoutes(fastify: FastifyInstance) {
  const svc = new SourcesMatrixService(db)
  const readAuth  = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/sources/video-groups ──────────────────────────────

  fastify.get('/admin/sources/video-groups', { preHandler: readAuth }, async (request, reply) => {
    const parsed = VideoGroupsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.listVideoGroups(parsed.data)
    return reply.send({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  })

  // ── GET /admin/sources/video-groups/stats ────────────────────────

  fastify.get('/admin/sources/video-groups/stats', { preHandler: readAuth }, async (_request, reply) => {
    const stats = await svc.getVideoGroupStats()
    return reply.send({ data: stats })
  })

  // ── GET /admin/sources/video-groups/:videoId/matrix ──────────────

  const VideoIdSchema = z.object({ videoId: z.string().uuid() })

  fastify.get('/admin/sources/video-groups/:videoId/matrix', { preHandler: readAuth }, async (request, reply) => {
    const parsed = VideoIdSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'videoId 格式无效', status: 422 },
      })
    }
    try {
      const lines = await svc.getVideoMatrix(parsed.data.videoId)
      return reply.send({ data: lines })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      request.log.error({ err }, '[admin/sources/video-groups/matrix] unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── GET /admin/source-line-aliases ───────────────────────────────

  fastify.get('/admin/source-line-aliases', { preHandler: readAuth }, async (_request, reply) => {
    const aliases = await svc.listLineAliases()
    return reply.send({ data: aliases })
  })

  // ── PUT /admin/source-line-aliases/:siteKey/:sourceName ──────────

  fastify.put('/admin/source-line-aliases/:siteKey/:sourceName', { preHandler: adminOnly }, async (request, reply) => {
    const { siteKey, sourceName } = request.params as { siteKey: string; sourceName: string }
    const parsed = UpsertAliasSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const alias = await svc.upsertLineAlias(
        decodeURIComponent(siteKey),
        decodeURIComponent(sourceName),
        parsed.data.displayName,
        request.user!.userId,
        request.id,
      )
      return reply.send({ data: alias })
    } catch (err) {
      request.log.error({ err }, '[admin/source-line-aliases] upsert error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })
}
