/**
 * admin/sources-matrix.ts — /admin/sources 线路矩阵视图端点（CHG-SN-5-11）
 *
 * GET  /admin/sources/video-groups           — 视频分组列表（含聚合信号状态）
 * GET  /admin/sources/video-groups/stats     — KPI 统计（total / active / dead / orphan）
 * GET  /admin/sources/video-groups/:videoId/matrix — 单视频线路×集数矩阵
 * GET  /admin/source-line-aliases            — 全局别名列表
 * PUT  /admin/source-line-aliases/:siteKey/:sourceName — 新建/更新别名
 *
 * 鉴权：admin/moderator（与 content.ts admin/sources 对齐）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import {
  listVideoGroups,
  getVideoGroupStats,
  getVideoMatrix,
  listLineAliases,
  upsertLineAlias,
} from '@/api/db/queries/sources-matrix'

const VideoGroupsQuerySchema = z.object({
  page:          z.coerce.number().int().min(1).optional().default(1),
  limit:         z.coerce.number().int().min(1).max(100).optional().default(20),
  keyword:       z.string().optional(),
  segment:       z.enum(['grouped', 'dead', 'correction', 'orphan']).optional().default('grouped'),
  siteKey:       z.string().optional(),
  probeStatus:   z.string().optional(),
  renderStatus:  z.string().optional(),
})

const UpsertAliasSchema = z.object({
  displayName: z.string().min(1, '别名不能为空').max(100, '别名过长'),
})

export async function adminSourcesMatrixRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]

  // ── GET /admin/sources/video-groups ──────────────────────────────

  fastify.get('/admin/sources/video-groups', { preHandler: auth }, async (request, reply) => {
    const parsed = VideoGroupsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await listVideoGroups(db, parsed.data)
    return reply.send({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  })

  // ── GET /admin/sources/video-groups/stats ────────────────────────

  fastify.get('/admin/sources/video-groups/stats', { preHandler: auth }, async (_request, reply) => {
    const stats = await getVideoGroupStats(db)
    return reply.send({ data: stats })
  })

  // ── GET /admin/sources/video-groups/:videoId/matrix ──────────────

  fastify.get('/admin/sources/video-groups/:videoId/matrix', { preHandler: auth }, async (request, reply) => {
    const { videoId } = request.params as { videoId: string }
    if (!videoId || !/^[0-9a-f-]{36}$/i.test(videoId)) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'videoId 格式无效', status: 422 },
      })
    }
    const lines = await getVideoMatrix(db, videoId)
    return reply.send({ data: lines })
  })

  // ── GET /admin/source-line-aliases ───────────────────────────────

  fastify.get('/admin/source-line-aliases', { preHandler: auth }, async (_request, reply) => {
    const aliases = await listLineAliases(db)
    return reply.send({ data: aliases })
  })

  // ── PUT /admin/source-line-aliases/:siteKey/:sourceName ──────────

  fastify.put('/admin/source-line-aliases/:siteKey/:sourceName', { preHandler: auth }, async (request, reply) => {
    const { siteKey, sourceName } = request.params as { siteKey: string; sourceName: string }
    const parsed = UpsertAliasSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const alias = await upsertLineAlias(
        db,
        decodeURIComponent(siteKey),
        decodeURIComponent(sourceName),
        parsed.data.displayName,
        request.user!.userId,
      )
      return reply.send({ data: alias })
    } catch (err) {
      request.log.error({ err }, '[admin/source-line-aliases] upsert error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })
}
