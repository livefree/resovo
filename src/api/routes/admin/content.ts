/**
 * admin/content.ts — 播放源、投稿、字幕审核接口
 * ADMIN-03
 *
 * GET    /admin/sources                   — 播放源列表（按 is_active 筛选，需 moderator+）
 * DELETE /admin/sources/:id               — 软删除（需 moderator+）
 * POST   /admin/sources/batch-delete      — 批量软删除（需 moderator+）
 * PATCH  /admin/sources/:id/status        — 单条手工切换状态（需 moderator+）
 * POST   /admin/sources/batch-status      — 批量手工切换状态（需 moderator+）
 *
 * GET    /admin/submissions               — 投稿队列（is_active=false && submitted_by IS NOT NULL，需 moderator+）
 * POST   /admin/submissions/:id/approve   — 审核通过 → is_active=true（需 moderator+）
 * POST   /admin/submissions/:id/reject    — 拒绝 → 软删除（需 moderator+）
 *
 * GET    /admin/subtitles                 — 字幕审核队列（is_verified=false，需 moderator+）
 * POST   /admin/subtitles/:id/approve     — 审核通过 → is_verified=true（需 moderator+）
 * POST   /admin/subtitles/:id/reject      — 拒绝 → 软删除（需 moderator+）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { ContentService } from '@/api/services/ContentService'
import * as sourcesQueries from '@/api/db/queries/sources'

// ── 路由注册 ──────────────────────────────────────────────────────

export async function adminContentRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const contentService = new ContentService(db)
  const SOURCE_SORT_FIELDS = [
    'created_at',
    'last_checked',
    'is_active',
    'status',
    'video_title',
    'source_url',
    'site_key',
  ] as const

  // ════════════════════════════════════════════════════════════════
  // 播放源管理
  // ════════════════════════════════════════════════════════════════

  const SourceListSchema = z.object({
    /** active=true/false/all（旧参数保留向后兼容） */
    active: z.enum(['true', 'false', 'all']).optional(),
    /** status=active|inactive|all（新参数，与 active 取值映射） */
    status: z.enum(['active', 'inactive', 'all']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    videoId: z.string().uuid().optional(),
    keyword: z.string().optional(),
    title: z.string().optional(),
    siteKey: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })

  fastify.get('/admin/sources', { preHandler: auth }, async (request, reply) => {
    const parsed = SourceListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { active, status, page, limit, videoId, keyword, title, siteKey, sortField, sortDir } = parsed.data
    // status 参数优先；向后兼容 active 参数
    const resolvedActive = status
      ? (status === 'active' ? 'true' : status === 'inactive' ? 'false' : 'all')
      : (active ?? 'all')
    const normalizedKeyword = keyword?.trim() ? keyword.trim() : undefined
    const normalizedTitle = title?.trim() ? title.trim() : undefined
    const normalizedSiteKey = siteKey?.trim() ? siteKey.trim() : undefined
    const validSortField = sortField && SOURCE_SORT_FIELDS.includes(sortField as typeof SOURCE_SORT_FIELDS[number])
      ? (sortField === 'status' ? 'is_active' : sortField) as 'created_at' | 'last_checked' | 'is_active' | 'video_title' | 'source_url' | 'site_key'
      : undefined
    const result = await contentService.listSources({
      active: resolvedActive,
      page,
      limit,
      videoId,
      keyword: normalizedKeyword,
      title: normalizedTitle,
      siteKey: normalizedSiteKey,
      sortField: validSortField,
      sortDir,
    })
    return reply.send(result)
  })

  fastify.get('/admin/sources/shell-count', { preHandler: auth }, async (_request, reply) => {
    const result = await contentService.getShellVideoCount()
    const verifySchedulerEnabled = process.env.VERIFY_SCHEDULER_ENABLED === 'true'
    return reply.send({
      data: {
        ...result,
        verifySchedulerEnabled,
      },
    })
  })

  fastify.delete('/admin/sources/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const deleted = await contentService.deleteSource(id)
    if (!deleted) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  fastify.post('/admin/sources/batch-delete', { preHandler: auth }, async (request, reply) => {
    const BatchSchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    })
    const parsed = BatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const deleted = await contentService.batchDeleteSources(parsed.data.ids)
    return reply.send({ data: { deleted } })
  })

  fastify.patch('/admin/sources/:id/status', { preHandler: auth }, async (request, reply) => {
    const StatusSchema = z.object({
      isActive: z.boolean(),
    })
    const parsed = StatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { id } = request.params as { id: string }
    const updated = await contentService.setSourceStatus(id, parsed.data.isActive)
    if (!updated) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
      })
    }
    return reply.send({ data: { updated: true, isActive: parsed.data.isActive } })
  })

  fastify.post('/admin/sources/batch-status', { preHandler: auth }, async (request, reply) => {
    const BatchStatusSchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      isActive: z.boolean(),
    })
    const parsed = BatchStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const updated = await contentService.batchSetSourceStatus(parsed.data.ids, parsed.data.isActive)
    return reply.send({ data: { updated, isActive: parsed.data.isActive } })
  })

  // ════════════════════════════════════════════════════════════════
  // 投稿队列（is_active=false && submitted_by IS NOT NULL）
  // ════════════════════════════════════════════════════════════════

  const SUBMISSION_SORT_FIELDS = ['video', 'source_url', 'submitted_by', 'created_at'] as const
  const SUBTITLE_SORT_FIELDS = ['video', 'language', 'format', 'uploaded_by', 'created_at'] as const

  const SubListSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    videoType: z.string().max(50).optional(),
    siteKey: z.string().max(100).optional(),
  })

  fastify.get('/admin/submissions', { preHandler: auth }, async (request, reply) => {
    const parsed = SubListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { page, limit, sortField, sortDir, videoType, siteKey } = parsed.data
    const validSortField = (sortField && (SUBMISSION_SORT_FIELDS as readonly string[]).includes(sortField))
      ? sortField
      : undefined
    const result = await contentService.listSubmissions(
      page, limit, validSortField, sortDir,
      { videoType, siteKey }
    )
    return reply.send(result)
  })

  fastify.post('/admin/submissions/:id/approve', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const approved = await contentService.approveSubmission(id)
    if (!approved) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '投稿记录不存在或已处理', status: 404 },
      })
    }
    return reply.send({ data: { approved: true } })
  })

  fastify.post('/admin/submissions/:id/reject', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const RejectSchema = z.object({ reason: z.string().min(1).max(200).optional() })
    const parsed = RejectSchema.safeParse(request.body)
    const reason = parsed.success ? parsed.data.reason : undefined
    const rejected = await contentService.rejectSubmission(id, reason)
    if (!rejected) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '投稿记录不存在或已处理', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  // UX-06: 批量通过投稿
  fastify.post('/admin/submissions/batch-approve', { preHandler: auth }, async (request, reply) => {
    const BatchSchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    })
    const parsed = BatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const approved = await contentService.batchApproveSubmissions(parsed.data.ids)
    return reply.send({ data: { approved } })
  })

  // UX-06: 批量拒绝投稿
  fastify.post('/admin/submissions/batch-reject', { preHandler: auth }, async (request, reply) => {
    const BatchSchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      reason: z.string().min(1).max(200).optional(),
    })
    const parsed = BatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const rejected = await contentService.batchRejectSubmissions(parsed.data.ids, parsed.data.reason)
    return reply.send({ data: { rejected } })
  })

  // ════════════════════════════════════════════════════════════════
  // 字幕审核队列（is_verified=false）
  // ════════════════════════════════════════════════════════════════

  const SubtitleListSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })

  fastify.get('/admin/subtitles', { preHandler: auth }, async (request, reply) => {
    const parsed = SubtitleListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { page, limit, sortField, sortDir } = parsed.data
    const validSortField = (sortField && (SUBTITLE_SORT_FIELDS as readonly string[]).includes(sortField))
      ? sortField
      : undefined
    const result = await contentService.listSubtitles(page, limit, validSortField, sortDir)
    return reply.send(result)
  })

  fastify.post('/admin/subtitles/:id/approve', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const approved = await contentService.approveSubtitle(id)
    if (!approved) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '字幕记录不存在', status: 404 },
      })
    }
    return reply.send({ data: { approved: true } })
  })

  fastify.post('/admin/subtitles/:id/reject', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const RejectSchema = z.object({ reason: z.string().min(1).max(200).optional() })
    const parsed = RejectSchema.safeParse(request.body)
    const reason = parsed.success ? parsed.data.reason : undefined
    const rejected = await contentService.rejectSubtitle(id, reason)
    if (!rejected) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '字幕记录不存在', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  // ════════════════════════════════════════════════════════════════
  // 孤岛视频（ADMIN-12: CHG-388 自动下架后补源仍失败的视频）
  // ════════════════════════════════════════════════════════════════

  // ── GET /admin/sources/orphan-videos ─────────────────────────────
  fastify.get('/admin/sources/orphan-videos', { preHandler: auth }, async (_request, reply) => {
    try {
      const rows = await sourcesQueries.listOrphanVideos(db, 100)
      return reply.send({ data: rows, total: rows.length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `查询孤岛视频失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/sources/orphan-videos/:id/resolve — 标记已处理 ───
  fastify.post('/admin/sources/orphan-videos/:id/resolve', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await sourcesQueries.resolveOrphanVideo(db, id)
      return reply.send({ data: { id, resolved: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `标记失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── PATCH /admin/sources/:id/url — 替换播放源 URL ───────────────
  const ReplaceUrlSchema = z.object({
    newUrl: z.string().url().max(2048),
  })

  fastify.patch('/admin/sources/:id/url', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = ReplaceUrlSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    try {
      const ok = await sourcesQueries.replaceSourceUrl(db, id, parsed.data.newUrl)
      if (!ok) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '播放源不存在', status: 404 },
        })
      }
      return reply.send({ data: { id, updated: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `替换失败: ${msg}`, status: 500 },
      })
    }
  })
}
