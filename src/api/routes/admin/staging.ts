/**
 * staging.ts — 暂存发布队列 API
 * CHG-383: GET /admin/staging, POST /admin/staging/:id/publish,
 *          POST /admin/staging/batch-publish, GET/PUT /admin/staging/rules
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { StagingPublishService } from '@/api/services/StagingPublishService'
import * as stagingQueries from '@/api/db/queries/staging'

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other'] as const).optional(),
})

const RulesSchema = z.object({
  minMetaScore: z.number().int().min(0).max(100),
  requireDoubanMatched: z.boolean(),
  requireCoverUrl: z.boolean(),
  minActiveSourceCount: z.number().int().min(0).max(10),
})

export async function adminStagingRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]
  const svc = new StagingPublishService(db)

  // ── GET /admin/staging — 暂存队列列表 ────────────────────────
  fastify.get('/admin/staging', { preHandler: auth }, async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const rules = await svc.getRules()
      const result = await stagingQueries.listStagingVideos(db, parsed.data)

      const rows = result.rows.map((video) => ({
        ...video,
        readiness: svc.checkReadiness(video, rules),
      }))

      return reply.send({ data: rows, total: result.total, rules })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `暂存队列查询失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/staging/:id/publish — 手动发布单条 ─────────
  fastify.post('/admin/staging/:id/publish', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const video = await stagingQueries.getStagingVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在或不在暂存状态', status: 404 },
      })
    }

    const ok = await svc.publishSingle(id, request.user!.userId)
    if (!ok) {
      return reply.code(422).send({
        error: { code: 'PUBLISH_FAILED', message: '发布失败，状态可能已变更', status: 422 },
      })
    }

    return reply.send({ data: { id, published: true } })
  })

  // ── POST /admin/staging/batch-publish — 批量发布就绪视频 ───
  // admin only：批量操作影响范围大
  fastify.post('/admin/staging/batch-publish', { preHandler: adminOnly }, async (request, reply) => {
    const { published, skipped } = await svc.publishReadyBatch(100)
    return reply.send({ data: { published, skipped } })
  })

  // ── GET /admin/staging/rules — 获取自动发布规则 ─────────────
  fastify.get('/admin/staging/rules', { preHandler: auth }, async (_request, reply) => {
    try {
      const rules = await svc.getRules()
      return reply.send({ data: rules })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `获取规则失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── PUT /admin/staging/rules — 更新自动发布规则 ─────────────
  fastify.put('/admin/staging/rules', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = RulesSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '规则参数错误', status: 422 },
      })
    }
    await svc.saveRules(parsed.data)
    return reply.send({ data: parsed.data })
  })
}
