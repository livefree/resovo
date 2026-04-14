/**
 * moderation.ts — 审核台操作 API
 * UX-11: 豆瓣搜索 / 确认（pending_review 视频）
 * UX-12: PATCH /meta 元数据内联编辑（仅 pending_review 视频）
 * P2 fix: 所有写操作校验 review_status = pending_review
 * CHG-387: 后续追加 POST /batch-approve / POST /batch-reject / GET /history
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { DoubanService } from '@/api/services/DoubanService'
import { VideoService } from '@/api/services/VideoService'
import * as videoQueries from '@/api/db/queries/videos'

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

export async function adminModerationRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const svc = new DoubanService(db)
  const videoSvc = new VideoService(db)

  // ── PATCH /admin/moderation/:id/meta — 内联元数据快速编辑 ────
  // 仅 pending_review 视频；底层复用 VideoService.update（source='manual'）
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
  // candidate 态：忽略当前候选，将 douban_status 标记为 unmatched
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
}
