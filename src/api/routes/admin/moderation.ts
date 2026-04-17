/**
 * moderation.ts — 审核台操作 API
 * UX-11: 豆瓣搜索 / 确认（pending_review 视频）
 * UX-12: PATCH /meta 元数据内联编辑（仅 pending_review 视频）
 * UX-13: POST /batch-approve / POST /batch-reject / GET /history / POST /:id/reopen
 * CHG-387: batch-reject + approve_and_publish admin 专属（在 videos.ts review 路由中）
 * P2 fix: 所有写操作校验 review_status = pending_review
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { DoubanService } from '@/api/services/DoubanService'
import { VideoService } from '@/api/services/VideoService'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'
import * as videoQueries from '@/api/db/queries/videos'
import * as moderationQueries from '@/api/db/queries/moderation'

const MetaEditSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  type: z.enum(['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other']).optional(),
  genres: z.array(z.string().min(1).max(50)).max(10).optional(),
})

const DoubanSearchSchema = z.object({
  keyword: z.string().min(1).max(200),
})

const DoubanConfirmSchema = z.object({
  subjectId: z.string().min(1).max(100),
})

const DoubanConfirmFieldsSchema = z.object({
  subjectId: z.string().min(1).max(100),
  fields: z.array(z.string().min(1).max(50)).min(1).max(20),
})

const BatchApproveSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
})

const BatchRejectSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().min(1).max(500),
})

const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  result: z.enum(['approved', 'rejected']).optional(),
  type: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

export async function adminModerationRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const svc = new DoubanService(db)
  const videoSvc = new VideoService(db)
  const indexSync = new VideoIndexSyncService(db, es)

  // ── PATCH /admin/moderation/:id/meta — 内联元数据快速编辑 ────
  fastify.patch('/admin/moderation/:id/meta', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = MetaEditSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '至少提供一个可编辑字段', status: 422 },
      })
    }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'pending_review') {
      return reply.code(422).send({ error: { code: 'NOT_PENDING', message: '仅待审核视频可通过审核台接口编辑', status: 422 } })
    }
    try {
      const result = await videoSvc.update(id, parsed.data)
      if (!result) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
        })
      }
      return reply.send({ data: { id, updated: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `保存失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/moderation/:id/douban-search ─────────────────
  fastify.post('/admin/moderation/:id/douban-search', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanSearchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 },
      })
    }
    try {
      const candidates = await svc.searchByKeyword(parsed.data.keyword)
      return reply.send({ data: { videoId: id, candidates } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'SEARCH_FAILED', message: `豆瓣搜索失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── POST /admin/moderation/:id/douban-confirm ────────────────
  fastify.post('/admin/moderation/:id/douban-confirm', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanConfirmSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'pending_review') {
      return reply.code(422).send({ error: { code: 'NOT_PENDING', message: '仅待审核视频可操作', status: 422 } })
    }
    try {
      const result = await svc.confirmSubject(id, parsed.data.subjectId)
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

  // ── POST /admin/moderation/:id/douban-ignore ─────────────────
  fastify.post('/admin/moderation/:id/douban-ignore', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'pending_review') {
      return reply.code(422).send({ error: { code: 'NOT_PENDING', message: '仅待审核视频可操作', status: 422 } })
    }
    try {
      await videoQueries.updateVideoEnrichStatus(db, id, {
        doubanStatus: 'unmatched',
        metaScore: video.meta_score ?? 0,
      })
      return reply.send({ data: { id, ignored: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `操作失败: ${msg}`, status: 500 },
      })
    }
  })

  // ── GET /admin/moderation/:id/douban-candidate ──────────────
  // META-07: 获取候选对比数据（当前 catalog 字段 vs 候选条目字段）
  fastify.get('/admin/moderation/:id/douban-candidate', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    try {
      const data = await svc.getCandidateData(id)
      if (!data) {
        return reply.code(404).send({ error: { code: 'NO_CANDIDATE', message: '无候选豆瓣条目', status: 404 } })
      }
      return reply.send({ data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: msg, status: 500 } })
    }
  })

  // ── POST /admin/moderation/:id/douban-confirm-fields ─────────
  // META-07: 只应用选中字段，并写 manual_confirmed
  fastify.post('/admin/moderation/:id/douban-confirm-fields', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = DoubanConfirmFieldsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 } })
    }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'pending_review') {
      return reply.code(422).send({ error: { code: 'NOT_PENDING', message: '仅待审核视频可操作', status: 422 } })
    }
    try {
      const result = await svc.confirmFields(id, parsed.data.subjectId, parsed.data.fields)
      if (!result.updated) {
        return reply.code(422).send({ error: { code: 'CONFIRM_FAILED', message: result.reason ?? '确认失败', status: 422 } })
      }
      void indexSync.syncVideo(id)
      return reply.send({ data: { id, confirmed: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: msg, status: 500 } })
    }
  })

  // ── POST /admin/moderation/batch-approve ─────────────────────
  // 批量通过暂存（仅 pending_review → approved+internal+false）
  fastify.post('/admin/moderation/batch-approve', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchApproveSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const userId = request.user!.userId
    let approved = 0, skipped = 0, failed = 0
    for (const id of parsed.data.ids) {
      try {
        // 仅 pending_review 视频可批量通过；其他状态直接计入 skipped
        const video = await videoQueries.findAdminVideoById(db, id)
        if (!video || video.review_status !== 'pending_review') { skipped++; continue }
        const result = await videoQueries.transitionVideoState(db, id, {
          action: 'approve',
          reviewedBy: userId,
        })
        if (result) { approved++ } else { skipped++ }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'STATE_CONFLICT' || msg === 'INVALID_TRANSITION') { skipped++ }
        else { failed++ }
      }
    }
    return reply.send({ data: { approved, skipped, failed } })
  })

  // ── POST /admin/moderation/batch-reject ──────────────────────
  // 批量拒绝（需提供拒绝原因）
  fastify.post('/admin/moderation/batch-reject', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchRejectSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }
    const userId = request.user!.userId
    let rejected = 0, skipped = 0, failed = 0
    for (const id of parsed.data.ids) {
      try {
        // 仅 pending_review 视频可批量拒绝；其他状态（包括 approved）直接计入 skipped
        const video = await videoQueries.findAdminVideoById(db, id)
        if (!video || video.review_status !== 'pending_review') { skipped++; continue }
        const result = await videoQueries.transitionVideoState(db, id, {
          action: 'reject',
          reason: parsed.data.reason,
          reviewedBy: userId,
        })
        if (result) { rejected++ } else { skipped++ }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'STATE_CONFLICT' || msg === 'INVALID_TRANSITION') { skipped++ }
        else { failed++ }
      }
    }
    return reply.send({ data: { rejected, skipped, failed } })
  })

  // ── GET /admin/moderation/history ────────────────────────────
  // 已审核历史列表（approved / rejected）
  fastify.get('/admin/moderation/history', { preHandler: auth }, async (request, reply) => {
    const parsed = HistoryQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '分页参数错误', status: 422 },
      })
    }
    const result = await moderationQueries.listModerationHistory(db, {
      result: parsed.data.result,
      type: parsed.data.type,
      sortDir: parsed.data.sortDir,
      page: parsed.data.page,
      limit: parsed.data.limit,
    })
    return reply.send({ data: result.rows, total: result.total })
  })

  // ── POST /admin/moderation/:id/reopen ────────────────────────
  // 复审：rejected → pending_review
  fastify.post('/admin/moderation/:id/reopen', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const video = await videoQueries.findAdminVideoById(db, id)
    if (!video) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '视频不存在', status: 404 } })
    }
    if (video.review_status !== 'rejected') {
      return reply.code(422).send({
        error: { code: 'NOT_REJECTED', message: '仅已拒绝视频可复审', status: 422 },
      })
    }
    try {
      await videoQueries.transitionVideoState(db, id, { action: 'reopen_pending' })
      return reply.send({ data: { id, reopened: true } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: `复审失败: ${msg}`, status: 500 },
      })
    }
  })
}
