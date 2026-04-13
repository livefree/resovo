/**
 * moderation.ts — 审核台操作 API
 * UX-11: 豆瓣搜索 / 确认（pending_review 视频，无暂存状态限制）
 * CHG-387: 后续追加 PATCH /meta / POST /batch-approve / POST /batch-reject / GET /history
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { DoubanService } from '@/api/services/DoubanService'
import * as videoQueries from '@/api/db/queries/videos'

const DoubanSearchSchema = z.object({
  keyword: z.string().min(1).max(200),
})

const DoubanConfirmSchema = z.object({
  subjectId: z.string().min(1).max(100),
})

export async function adminModerationRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const svc = new DoubanService(db)

  // ── POST /admin/moderation/:id/douban-search ─────────────────
  // 对待审视频进行豆瓣关键词搜索（不校验暂存状态）
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
  // 确认并写入豆瓣信息（不校验暂存状态）
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
}
