/**
 * admin/content.ts — 播放源、投稿、字幕审核接口
 * ADMIN-03
 *
 * GET    /admin/sources                   — 播放源列表（按 is_active 筛选，需 moderator+）
 * DELETE /admin/sources/:id               — 软删除（需 moderator+）
 * POST   /admin/sources/batch-delete      — 批量软删除（需 moderator+）
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

// ── 路由注册 ──────────────────────────────────────────────────────

export async function adminContentRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const contentService = new ContentService(db)

  // ════════════════════════════════════════════════════════════════
  // 播放源管理
  // ════════════════════════════════════════════════════════════════

  const SourceListSchema = z.object({
    active: z.enum(['true', 'false', 'all']).optional().default('all'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    videoId: z.string().uuid().optional(),
  })

  fastify.get('/admin/sources', { preHandler: auth }, async (request, reply) => {
    const parsed = SourceListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { active, page, limit, videoId } = parsed.data
    const result = await contentService.listSources({ active, page, limit, videoId })
    return reply.send(result)
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

  // ════════════════════════════════════════════════════════════════
  // 投稿队列（is_active=false && submitted_by IS NOT NULL）
  // ════════════════════════════════════════════════════════════════

  const SubListSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })

  fastify.get('/admin/submissions', { preHandler: auth }, async (request, reply) => {
    const parsed = SubListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { page, limit } = parsed.data
    const result = await contentService.listSubmissions(page, limit)
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
    const rejected = await contentService.rejectSubmission(id)
    if (!rejected) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '投稿记录不存在或已处理', status: 404 },
      })
    }
    return reply.code(204).send()
  })

  // ════════════════════════════════════════════════════════════════
  // 字幕审核队列（is_verified=false）
  // ════════════════════════════════════════════════════════════════

  fastify.get('/admin/subtitles', { preHandler: auth }, async (request, reply) => {
    const parsed = SubListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: '参数错误', status: 422 },
      })
    }

    const { page, limit } = parsed.data
    const result = await contentService.listSubtitles(page, limit)
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
    const rejected = await contentService.rejectSubtitle(id)
    if (!rejected) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '字幕记录不存在', status: 404 },
      })
    }
    return reply.code(204).send()
  })
}
