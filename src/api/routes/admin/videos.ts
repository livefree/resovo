/**
 * admin/videos.ts — 视频内容管理接口
 * ADMIN-02
 *
 * GET    /admin/videos              列表（含 is_published 筛选，需 moderator+）
 * PATCH  /admin/videos/:id/publish  上下架（单条，需 moderator+）
 * POST   /admin/videos/batch-publish 批量上下架（需 moderator+，事务）
 * GET    /admin/videos/:id          获取单条详情（含未发布，需 moderator+）
 * PATCH  /admin/videos/:id          编辑元数据（需 moderator+）
 * POST   /admin/videos              手动新增视频（需 moderator+）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { VideoService } from '@/api/services/VideoService'
import { DoubanService } from '@/api/services/DoubanService'
import type { VideoType, VideoStatus, VideoGenre, VisibilityStatus } from '@/types'

// ── Zod Schema ────────────────────────────────────────────────────

const PublishSchema = z.object({
  isPublished: z.boolean(),
})

const VisibilitySchema = z.object({
  visibility: z.enum(['public', 'internal', 'hidden'] as const),
})

const ReviewSchema = z.object({
  action: z.enum(['approve', 'reject'] as const),
  reason: z.string().max(500).optional(),
})

const StateTransitionSchema = z.object({
  action: z.enum([
    'approve',
    'reject',
    'reopen_pending',
    'publish',
    'unpublish',
    'set_internal',
    'set_hidden',
  ] as const),
  reason: z.string().max(500).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
})

const BatchPublishSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  isPublished: z.boolean(),
})

const VideoMetaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleEn: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  type: z.enum(['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other'] as const).optional(),
  genre: z.string().max(50).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  country: z.string().max(10).optional().nullable(),
  episodeCount: z.number().int().min(0).optional(),
  status: z.enum(['ongoing', 'completed'] as const).optional(),
  rating: z.number().min(0).max(10).optional().nullable(),
  director: z.array(z.string()).optional(),
  cast: z.array(z.string()).optional(),
  writers: z.array(z.string()).optional(),
  doubanId: z.string().max(20).optional().nullable(),
})

const CreateVideoSchema = VideoMetaSchema.required({ title: true, type: true })

const SORT_FIELDS = ['created_at', 'updated_at', 'title', 'year', 'type'] as const

const ListQuerySchema = z.object({
  status: z.enum(['pending', 'published', 'unpublished', 'all']).optional().default('all'),
  type: z.enum(['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other'] as const).optional(),
  visibilityStatus: z.enum(['public', 'internal', 'hidden'] as const).optional(),
  reviewStatus: z.enum(['pending_review', 'approved', 'rejected'] as const).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().max(100).optional(),
  /** 按来源站点 key 筛选 */
  site: z.string().max(100).optional(),
  sortField: z.enum(SORT_FIELDS).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

// ── 路由注册 ──────────────────────────────────────────────────────

export async function adminVideoRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]
  const videoService = new VideoService(db, es)
  const doubanService = new DoubanService(db)
  function mapTransitionError(err: unknown): { status: number; code: string; message: string } {
    if (err instanceof Error && err.message === 'STATE_CONFLICT') {
      return { status: 409, code: 'STATE_CONFLICT', message: '状态已被其他操作更新，请刷新后重试' }
    }
    if (err instanceof Error && err.message === 'INVALID_TRANSITION') {
      return { status: 422, code: 'INVALID_TRANSITION', message: '非法状态跃迁，请按审核流程操作' }
    }
    return { status: 500, code: 'INTERNAL_ERROR', message: '状态更新失败' }
  }

  // ── GET /admin/videos ────────────────────────────────────────
  fastify.get('/admin/videos', { preHandler: auth }, async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { status, type, visibilityStatus, reviewStatus, page, limit, q, site, sortField, sortDir } = parsed.data
    const result = await videoService.adminList({
      status,
      type,
      visibilityStatus,
      reviewStatus,
      page,
      limit,
      q,
      siteKey: site,
      sortField,
      sortDir,
    })
    return reply.send(result)
  })

  // ── GET /admin/videos/:id ────────────────────────────────────
  fastify.get('/admin/videos/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const video = await videoService.adminFindById(id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    return reply.send({ data: video })
  })

  // ── PATCH /admin/videos/:id/publish ─────────────────────────
  fastify.patch('/admin/videos/:id/publish', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = PublishSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const result = await videoService.publish(id, parsed.data.isPublished)
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }
      return reply.send({ data: result })
    } catch (err) {
      const mapped = mapTransitionError(err)
      return reply.code(mapped.status).send({
        error: { code: mapped.code, message: mapped.message, status: mapped.status },
      })
    }
  })

  // ── PATCH /admin/videos/:id/visibility ─────────────────────
  // CHG-200: 可见性切换（public ↔ hidden），同步 is_published
  fastify.patch('/admin/videos/:id/visibility', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = VisibilitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const result = await videoService.updateVisibility(id, parsed.data.visibility as VisibilityStatus)
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }
      return reply.send({ data: result })
    } catch (err) {
      const mapped = mapTransitionError(err)
      return reply.code(mapped.status).send({
        error: { code: mapped.code, message: mapped.message, status: mapped.status },
      })
    }
  })

  // ── POST /admin/videos/:id/review ──────────────────────────
  // CHG-201: 内容审核（approve / reject）
  fastify.post('/admin/videos/:id/review', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = ReviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const result = await videoService.review(id, {
        action: parsed.data.action,
        reason: parsed.data.reason,
        reviewedBy: request.user!.userId,
      })
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }
      return reply.send({ data: result })
    } catch (err) {
      const mapped = mapTransitionError(err)
      return reply.code(mapped.status).send({
        error: { code: mapped.code, message: mapped.message, status: mapped.status },
      })
    }
  })

  // ── POST /admin/videos/:id/state-transition ─────────────────
  // 单一状态写入口：审核/可见性/上架统一通过 action 驱动
  fastify.post('/admin/videos/:id/state-transition', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = StateTransitionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const result = await videoService.transitionState(id, {
        action: parsed.data.action,
        reason: parsed.data.reason,
        expectedUpdatedAt: parsed.data.expectedUpdatedAt,
        reviewedBy: request.user!.userId,
      })
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }
      return reply.send({ data: result })
    } catch (err) {
      const mapped = mapTransitionError(err)
      return reply.code(mapped.status).send({
        error: { code: mapped.code, message: mapped.message, status: mapped.status },
      })
    }
  })

  // ── POST /admin/videos/batch-publish ───────────────────────
  fastify.post('/admin/videos/batch-publish', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchPublishSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    try {
      const updated = await videoService.batchPublish(parsed.data.ids, parsed.data.isPublished)
      return reply.send({ data: { updated } })
    } catch (err) {
      request.log.error({ err }, 'batch-publish failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '批量操作失败', status: 500 },
      })
    }
  })

  // ── POST /admin/videos/batch-unpublish ──────────────────────
  fastify.post('/admin/videos/batch-unpublish', { preHandler: auth }, async (request, reply) => {
    const BatchSchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(50),
    })
    const parsed = BatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误，ids 最多 50 条', status: 422 },
      })
    }

    try {
      const updated = await videoService.batchUnpublish(parsed.data.ids)
      return reply.send({ data: { updated } })
    } catch (err) {
      request.log.error({ err }, 'batch-unpublish failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '批量下架失败', status: 500 },
      })
    }
  })

  // ── PATCH /admin/videos/:id ──────────────────────────────────
  fastify.patch('/admin/videos/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = VideoMetaSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    // 管理员手动设置 genre 时，自动标记 genreSource='manual'；清空时置 null
    const updateInput = {
      ...parsed.data,
      ...(('genre' in parsed.data)
        ? { genreSource: parsed.data.genre ? ('manual' as const) : null }
        : {}),
    }
    const result = await videoService.update(id, updateInput)
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    return reply.send({ data: result })
  })

  // ── POST /admin/videos ───────────────────────────────────────
  fastify.post('/admin/videos', { preHandler: auth }, async (request, reply) => {
    const parsed = CreateVideoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? '参数错误',
          status: 422,
        },
      })
    }

    const result = await videoService.create(parsed.data)
    return reply.code(201).send({ data: result })
  })

  // ── GET /admin/videos/moderation-stats ─────────────────────
  // CHG-220: 审核台统计板数据
  fastify.get('/admin/videos/moderation-stats', { preHandler: auth }, async (_request, reply) => {
    const stats = await videoService.moderationStats()
    return reply.send({ data: stats })
  })

  // ── GET /admin/videos/pending-review ───────────────────────
  // CHG-220: 待审视频列表（含首条活跃源 URL）
  fastify.get('/admin/videos/pending-review', { preHandler: auth }, async (request, reply) => {
    const PendingQuerySchema = z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
      type: z.string().max(50).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      q: z.string().max(100).optional(),
      siteKey: z.string().max(100).optional(),
      sourceState: z.enum(['all', 'active', 'missing']).optional(),
    })
    const parsed = PendingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const result = await videoService.pendingReviewList(parsed.data)
    return reply.send(result)
  })

  // ── POST /admin/videos/:id/douban-sync ───────────────────────
  // CHG-23: admin only，手动触发豆瓣元数据同步
  fastify.post('/admin/videos/:id/douban-sync', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!/^[0-9a-f-]{36}$/.test(id)) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const result = await doubanService.syncVideo(id)
    return reply.send({ data: result })
  })

  // ── GET /admin/videos/:id/douban-preview ─────────────────────
  // UX-05: admin only，预览豆瓣元数据（不写 DB）
  fastify.get('/admin/videos/:id/douban-preview', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!/^[0-9a-f-]{36}$/.test(id)) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }

    const result = await doubanService.previewVideo(id)
    return reply.send({ data: result })
  })
}

// ── 类型导出（供其他模块使用） ─────────────────────────────────────

export type { VideoType, VideoStatus, VideoGenre }
