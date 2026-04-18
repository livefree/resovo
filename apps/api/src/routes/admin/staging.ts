/**
 * staging.ts — 暂存发布队列 API
 * CHG-383: GET /admin/staging, POST /admin/staging/:id/publish,
 *          POST /admin/staging/batch-publish, GET/PUT /admin/staging/rules
 * ADMIN-10: PATCH /admin/staging/:id/meta（暂存阶段元数据快速编辑）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { StagingPublishService } from '@/api/services/StagingPublishService'
import { DoubanService } from '@/api/services/DoubanService'
import { VideoService } from '@/api/services/VideoService'
import * as stagingQueries from '@/api/db/queries/staging'

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other'] as const).optional(),
  readiness: z.enum(['ready', 'warning', 'blocked']).optional(),
  siteKey: z.string().max(100).optional(),
})

const BatchDoubanSyncSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

const DoubanSearchSchema = z.object({
  keyword: z.string().min(1).max(200),
})

const DoubanConfirmSchema = z.object({
  subjectId: z.string().min(1).max(100),
})

const RulesSchema = z.object({
  minMetaScore: z.number().int().min(0).max(100),
  requireDoubanMatched: z.boolean(),
  requireCoverUrl: z.boolean(),
  minActiveSourceCount: z.number().int().min(0).max(10),
})

const MetaEditSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  type: z.enum(['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other'] as const).optional(),
  genres: z.array(z.string().min(1).max(50)).max(10).optional(),
})

export async function adminStagingRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]
  const svc = new StagingPublishService(db)
  const doubanSvc = new DoubanService(db)

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
      const result = await stagingQueries.listStagingVideos(db, { ...parsed.data, rules })

      const rows = result.rows.map((video) => ({
        ...video,
        readiness: svc.checkReadiness(video, rules),
      }))

      return reply.send({ data: rows, total: result.total, rules, summary: result.summary })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `暂存队列查询失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── GET /admin/staging/:id — 暂存视频详情（含 genres + doubanId）──
  fastify.get('/admin/staging/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const video = await stagingQueries.getStagingVideoDetailById(db, id)
      if (!video) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在或不在暂存状态', status: 404 },
        })
      }
      const rules = await svc.getRules()
      return reply.send({ data: { ...video, readiness: svc.checkReadiness(video, rules) } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `查询失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/staging/:id/publish — 手动发布单条 ─────────
  fastify.post('/admin/staging/:id/publish', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'PUBLISH_FAILED', message: msg, status: 500 },
      })
    }
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

  // ── POST /admin/staging/batch-douban-sync — 批量触发豆瓣丰富 ─
  fastify.post('/admin/staging/batch-douban-sync', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchDoubanSyncSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    try {
      // 只对仍处于暂存状态（approved+internal+unpublished）的视频入队
      const stagingIds: string[] = []
      let skipped = 0
      for (const id of parsed.data.ids) {
        const video = await stagingQueries.getStagingVideoById(db, id)
        if (video) { stagingIds.push(id) } else { skipped++ }
      }
      const result = await doubanSvc.batchEnqueueEnrich(stagingIds)
      return reply.send({ data: { queued: result.queued, skipped: skipped + result.skipped } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `批量同步失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/staging/:id/douban-search — 手动搜索豆瓣 ─────
  fastify.post('/admin/staging/:id/douban-search', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanSearchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const video = await stagingQueries.getStagingVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在或不在暂存状态', status: 404 },
      })
    }
    try {
      const raw = await doubanSvc.searchByKeyword(parsed.data.keyword)
      // 规范化字段名：SuggestItem.id → subjectId，供前端 confirm 接口使用
      const candidates = raw.map((item) => ({
        subjectId: item.id,
        title: item.title,
        year: item.year ? parseInt(item.year, 10) : null,
        subTitle: item.sub_title,
        coverUrl: null as string | null,
        rating: null as number | null,
        type: '',
      }))
      return reply.send({ data: { videoId: id, candidates } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'SEARCH_FAILED', message: `豆瓣搜索失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── PATCH /admin/staging/:id/meta — 暂存阶段元数据快速编辑（ADMIN-10）─
  fastify.patch('/admin/staging/:id/meta', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = MetaEditSchema.safeParse(request.body)
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const video = await stagingQueries.getStagingVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在或不在暂存状态', status: 404 },
      })
    }
    try {
      const videoSvc = new VideoService(db)
      await videoSvc.update(id, parsed.data)
      return reply.send({ data: { id, updated: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `保存失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/staging/:id/douban-confirm — 确认豆瓣条目 ────
  fastify.post('/admin/staging/:id/douban-confirm', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanConfirmSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const video = await stagingQueries.getStagingVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在或不在暂存状态', status: 404 },
      })
    }
    try {
      const result = await doubanSvc.confirmSubject(id, parsed.data.subjectId)
      if (!result.updated) {
        return reply.code(422).send({
          error: { code: 'CONFIRM_FAILED', message: result.reason ?? '确认失败', status: 422 },
        })
      }
      return reply.send({ data: { id, confirmed: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `确认失败: ${msg}`, status: 500 },
      })
    }
  })
}
