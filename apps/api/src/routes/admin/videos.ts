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
import { VideoService, VideoManualAddConflictError } from '@/api/services/VideoService'
import { DoubanService } from '@/api/services/DoubanService'
import { ModerationService } from '@/api/services/ModerationService'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import { isAppError } from '@/api/lib/errors'
import type { VisibilityStatus } from '@/types'
import { VIDEO_TYPES, VIDEO_STATUSES, REVIEW_STATUSES, VISIBILITY_STATUSES, DOUBAN_STATUSES, BANGUMI_STATUSES, SOURCE_CHECK_STATUSES, METADATA_STATUS_OVERALLS, METADATA_PROVIDER_STATES, METADATA_ISSUE_LEVELS } from '@resovo/types'

// ── Zod Schema ────────────────────────────────────────────────────

const PublishSchema = z.object({
  isPublished: z.boolean(),
})

const VisibilitySchema = z.object({
  visibility: z.enum(VISIBILITY_STATUSES),
})

const ReviewSchema = z.object({
  action: z.enum(['approve', 'approve_and_publish', 'reject'] as const),
  reason: z.string().max(500).optional(),
  labelKey: z.string().max(64).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
})

const StateTransitionSchema = z.object({
  action: z.enum([
    'approve',
    'approve_and_publish',
    'reject',
    'reopen_pending',
    'publish',
    'unpublish',
    'set_internal',
    'set_hidden',
    'staging_revert',  // M-SN-4 D-01：暂存退回待审核（approved+internal/hidden+0 → pending_review）
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
  type: z.enum(VIDEO_TYPES).optional(),
  genres: z.array(z.string().max(50)).optional(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  country: z.string().max(10).optional().nullable(),
  episodeCount: z.number().int().min(0).optional(),
  status: z.enum(VIDEO_STATUSES).optional(),
  rating: z.number().min(0).max(10).optional().nullable(),
  director: z.array(z.string()).optional(),
  cast: z.array(z.string()).optional(),
  writers: z.array(z.string()).optional(),
  doubanId: z.string().max(20).optional().nullable(),
})

const CreateVideoSchema = VideoMetaSchema.required({ title: true, type: true })

// ADR-145 / CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A：admin 手动添加视频 schema
// 最小 3 字段（title/type/contentRating）+ 14 元数据 optional + publishMode 三路径 + force 重复检测
const ManualAddVideoSchema = VideoMetaSchema.required({ title: true, type: true }).extend({
  contentRating: z.enum(['general', 'adult'] as const).default('general'),
  publishMode: z.enum(['draft', 'staging', 'published'] as const).default('staging'),
  force: z.boolean().default(false),
})

// AMD2-PATCH-2（2026-05-24）：扩展 SORT_FIELDS 白名单同步 queries SORT_FIELD_WHITELIST
// 兑现 ADR-150 AMD2 D-150-AMD2-1 "所有有数据的列默认可排序"原则
const SORT_FIELDS = [
  'created_at', 'updated_at', 'title', 'year', 'type',
  // 新扩 5 字段：
  'source_health', 'visibility', 'review_status', 'douban_status', 'meta_score',
  // CHG-VSR-2（§2.5）：集数列排序
  'episode_count',
  // SRCHEALTH-P1-1-A（B1）：探测/试播聚合列排序（同步 queries SORT_FIELD_WHITELIST）
  'source_check_status', 'render_check_status',
  // META-32-B（ADR-201 §视频库 排序）：元数据运营优先级 + 完整度独立字段（同步 SORT_FIELD_WHITELIST）
  'metadata_status', 'metadata_score',
] as const

// CHG-VSR-2：CSV → enum 数组 query 解析（参 SourcesMatrixService / crawler.runs.ts 同范式，各 route 私有 helper）
const csvEnum = <T extends string>(values: readonly T[]) =>
  z.string().optional().transform((s, ctx) => {
    if (!s) return undefined
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) return undefined
    for (const p of parts) {
      if (!(values as readonly string[]).includes(p)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid value: ${p}` })
        return z.NEVER
      }
    }
    return parts as T[]
  })
// CSV → 自由字符串数组（country 动态值 / 长度安全约束）
const csvFreeStr = (maxLen = 64) =>
  z.string().optional().transform((s, ctx) => {
    if (!s) return undefined
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) return undefined
    for (const p of parts) {
      if (p.length > maxLen) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `value too long: ${p}` })
        return z.NEVER
      }
    }
    return parts
  })
// query 布尔（z.coerce.boolean 把 'false' 也判 true，故显式枚举）
const queryBool = z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true'))

const ListQuerySchema = z.object({
  status: z.enum(['pending', 'published', 'unpublished', 'all']).optional().default('all'),
  type: z.enum(VIDEO_TYPES).optional(),
  /** CHG-VSR-2（§2.6）：type 多选（CSV，加性与单值 type 并存） */
  types: csvEnum(VIDEO_TYPES),
  visibilityStatus: z.enum(VISIBILITY_STATUSES).optional(),
  reviewStatus: z.enum(REVIEW_STATUSES).optional(),
  // ── CHG-VSR-2 三层过滤（§2.6 / ADR-150 AMENDMENT）：原子可筛选列 + 快捷筛选派生 ──
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  country: csvFreeStr(64),
  catalogStatus: csvEnum(VIDEO_STATUSES),
  isPublished: queryBool,
  doubanStatus: csvEnum(DOUBAN_STATUSES),
  bangumiStatus: csvEnum(BANGUMI_STATUSES),
  metaScoreMin: z.coerce.number().int().min(0).max(100).optional(),
  metaScoreMax: z.coerce.number().int().min(0).max(100).optional(),
  episodeMismatch: queryBool,
  episodeMissing: queryBool,
  metaIncomplete: queryBool,
  pendingReview: queryBool,
  // ── META-32-B（ADR-201 §视频库 过滤）：元数据状态筛选（CSV 多选 + 范围 + 快捷 bool）──
  metadataOverall: csvEnum(METADATA_STATUS_OVERALLS),
  metadataProviderState: csvEnum(METADATA_PROVIDER_STATES),
  metadataIssueLevel: csvEnum(METADATA_ISSUE_LEVELS),
  metadataUpdatedFrom: z.string().datetime().optional(),
  metadataUpdatedTo: z.string().datetime().optional(),
  metadataNeedsReview: queryBool,
  metadataHasCandidate: queryBool,
  metadataMissing: queryBool,
  metadataTmdbPending: queryBool,
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().max(100).optional(),
  /** 按来源站点 key 筛选 */
  site: z.string().max(100).optional(),
  // CHG-VSR-2（§2.5）：默认排序 updated_at desc（DB 层 fallback 不动，仅 route 显式默认）
  sortField: z.enum(SORT_FIELDS).optional().default('updated_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
})

// ── 路由注册 ──────────────────────────────────────────────────────

export async function adminVideoRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]
  const videoService = new VideoService(db, es)
  const doubanService = new DoubanService(db)
  const moderationSvc = new ModerationService(db, es)
  async function shouldIncludeAdultInAdminContent(): Promise<boolean> {
    const raw = await systemSettingsQueries.getSetting(db, 'show_adult_content')
    return raw === 'true'
  }
  function mapTransitionError(err: unknown): { status: number; code: string; message: string } {
    if (isAppError(err, 'STATE_CONFLICT')) {
      return { status: 409, code: 'STATE_CONFLICT', message: '状态已被其他操作更新，请刷新后重试' }
    }
    if (isAppError(err, 'INVALID_TRANSITION')) {
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

    const {
      status, type, types, visibilityStatus, reviewStatus, page, limit, q, site, sortField, sortDir,
      yearMin, yearMax, country, catalogStatus, isPublished, doubanStatus, bangumiStatus,
      metaScoreMin, metaScoreMax, episodeMismatch, episodeMissing, metaIncomplete, pendingReview,
      metadataOverall, metadataProviderState, metadataIssueLevel, metadataUpdatedFrom, metadataUpdatedTo,
      metadataNeedsReview, metadataHasCandidate, metadataMissing, metadataTmdbPending,
    } = parsed.data
    const includeAdult = await shouldIncludeAdultInAdminContent()
    const result = await videoService.adminList({
      status,
      type,
      types,
      visibilityStatus,
      reviewStatus,
      page,
      limit,
      q,
      siteKey: site,
      includeAdult,
      sortField,
      sortDir,
      yearMin,
      yearMax,
      country,
      catalogStatus,
      isPublished,
      doubanStatus,
      bangumiStatus,
      metaScoreMin,
      metaScoreMax,
      episodeMismatch,
      episodeMissing,
      metaIncomplete,
      pendingReview,
      metadataOverall,
      metadataProviderState,
      metadataIssueLevel,
      metadataUpdatedFrom,
      metadataUpdatedTo,
      metadataNeedsReview,
      metadataHasCandidate,
      metadataMissing,
      metadataTmdbPending,
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
      // CHG-SN-4-10-A2：传 audit 让 service 记 video.visibility_patch
      const result = await videoService.updateVisibility(
        id,
        parsed.data.visibility as VisibilityStatus,
        { actorId: request.user!.userId, requestId: request.id },
      )
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

    if (parsed.data.action === 'approve_and_publish' && request.user!.role !== 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'approve_and_publish 仅限 admin 角色', status: 403 },
      })
    }

    try {
      if (parsed.data.action === 'reject' && parsed.data.labelKey) {
        const result = await moderationSvc.rejectLabeled({
          videoId: id,
          labelKey: parsed.data.labelKey,
          reason: parsed.data.reason,
          expectedUpdatedAt: parsed.data.expectedUpdatedAt,
          actorId: request.user!.userId,
          requestId: request.id,
        })
        if (!result) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
        }
        return reply.send({ data: result })
      }
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

    if (parsed.data.action === 'approve_and_publish' && request.user!.role !== 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'approve_and_publish 仅限 admin 角色', status: 403 },
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

    const result = await videoService.update(id, parsed.data)
    if (!result) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    // ADMIN-14: 响应带 skippedFields，供前端区分"已保存" vs "被锁未保存"
    return reply.send({ data: result.data, skippedFields: result.skippedFields })
  })

  // ── POST /admin/videos ───────────────────────────────────────
  // ADR-145：admin 手动添加视频（重构端点：findOrCreate catalog + 重复检测 + publishMode 三路径 + R-MID-1 audit）
  fastify.post('/admin/videos', { preHandler: auth }, async (request, reply) => {
    const parsed = ManualAddVideoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? '参数错误',
          status: 422,
        },
      })
    }

    try {
      const result = await videoService.create(parsed.data, request.user!.userId)
      return reply.code(201).send({ data: result })
    } catch (err: unknown) {
      if (err instanceof VideoManualAddConflictError) {
        return reply.code(409).send({
          error: {
            code: 'STATE_CONFLICT',
            message: 'catalog 已存在关联视频（可设 force=true 强制创建）',
            status: 409,
            detail: { existingVideoId: err.existingVideoId, existingTitle: err.existingTitle },
          },
        })
      }
      throw err
    }
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
      doubanStatus: z.enum(DOUBAN_STATUSES).optional(),
      sourceCheckStatus: z.enum(SOURCE_CHECK_STATUSES).optional(),
    })
    const parsed = PendingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const includeAdult = await shouldIncludeAdultInAdminContent()
    const result = await videoService.pendingReviewList({
      ...parsed.data,
      includeAdult,
      doubanStatus: parsed.data.doubanStatus,
      sourceCheckStatus: parsed.data.sourceCheckStatus,
    })
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

