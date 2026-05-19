/**
 * admin/sources-matrix.ts — /admin/sources 线路矩阵视图端点（ADR-117 / CHG-SN-5-11
 *                                                + AMENDMENT 2026-05-19 / REDO-01-E）
 *
 * GET  /admin/sources/video-groups                       — 视频分组列表（含聚合信号状态）
 * GET  /admin/sources/video-groups/stats                 — KPI 统计（total / active / dead / orphan）
 * GET  /admin/sources/video-groups/:videoId/matrix       — 单视频线路×集数矩阵
 * GET  /admin/source-line-aliases                        — 全局别名列表
 * PUT  /admin/source-line-aliases/:siteKey/:sourceName   — 新建/更新别名（admin only）
 * GET  /admin/sources/routes/by-site/:siteKey            — 按站点聚合线路明细（AMENDMENT row 6）
 *
 * 鉴权：读端点 moderator+admin；PUT 写端点 admin only（ADR-117 D-117-1）
 */

import type { FastifyInstance, FastifyReply, FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import {
  SourcesMatrixService,
  VideoGroupsQuerySchema,
  UpsertAliasSchema,
  RoutesBySiteParamsSchema,
  RouteActionParamsSchema,
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

  // ── GET /admin/sources/routes/by-site/:siteKey ──────────────────
  // ADR-117 AMENDMENT 2026-05-19 / CHG-SN-7-REDO-01-E

  fastify.get('/admin/sources/routes/by-site/:siteKey', { preHandler: readAuth }, async (request, reply) => {
    const parsed = RoutesBySiteParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const rows = await svc.listRoutesBySite(decodeURIComponent(parsed.data.siteKey))
      return reply.send({ data: rows })
    } catch (err) {
      request.log.error({ err }, '[admin/sources/routes/by-site] query error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── ADR-117 AMENDMENT 2 2026-05-19 / CHG-SN-7-REDO-01-E2 ─────────
  // 行级 3 mutations：admin only / 复用 actionType `sources.route_action`

  function parseRouteActionParams(params: unknown) {
    const parsed = RouteActionParamsSchema.safeParse(params)
    if (!parsed.success) {
      return { ok: false as const, message: parsed.error.issues[0]?.message ?? '参数错误' }
    }
    return {
      ok: true as const,
      siteKey: decodeURIComponent(parsed.data.siteKey),
      sourceName: decodeURIComponent(parsed.data.sourceName),
    }
  }

  function handleRouteActionError(reply: FastifyReply, err: unknown, route: string, requestLog: FastifyBaseLogger): FastifyReply {
    if (isAppError(err, 'NOT_FOUND')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
    }
    if (isAppError(err, 'STATE_CONFLICT')) {
      return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
    }
    requestLog.error({ err }, `${route} error`)
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
  }

  // ── POST /admin/sources/routes/by-site/:siteKey/:sourceName/test ──
  fastify.post('/admin/sources/routes/by-site/:siteKey/:sourceName/test', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = parseRouteActionParams(request.params)
    if (!parsed.ok) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: parsed.message, status: 422 } })
    }
    try {
      const result = await svc.testRoute(parsed.siteKey, parsed.sourceName, request.user!.userId, request.id)
      return reply.send({ data: result })
    } catch (err) {
      return handleRouteActionError(reply, err, '[admin/sources/routes/.../test]', request.log)
    }
  })

  // ── POST /admin/sources/routes/by-site/:siteKey/:sourceName/reprobe ──
  fastify.post('/admin/sources/routes/by-site/:siteKey/:sourceName/reprobe', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = parseRouteActionParams(request.params)
    if (!parsed.ok) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: parsed.message, status: 422 } })
    }
    try {
      const result = await svc.reprobeRoute(parsed.siteKey, parsed.sourceName, request.user!.userId, request.id)
      return reply.send({ data: result })
    } catch (err) {
      return handleRouteActionError(reply, err, '[admin/sources/routes/.../reprobe]', request.log)
    }
  })

  // ── DELETE /admin/sources/routes/by-site/:siteKey/:sourceName ────
  fastify.delete('/admin/sources/routes/by-site/:siteKey/:sourceName', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = parseRouteActionParams(request.params)
    if (!parsed.ok) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: parsed.message, status: 422 } })
    }
    try {
      const result = await svc.deleteRoute(parsed.siteKey, parsed.sourceName, request.user!.userId, request.id)
      return reply.send({ data: result })
    } catch (err) {
      return handleRouteActionError(reply, err, '[admin/sources/routes/.../DELETE]', request.log)
    }
  })
}
