/**
 * admin/video-merges.ts — video 合并 admin API（ADR-105 / CHG-SN-5-09）
 *
 * CHG-SN-5-09（本卡）：
 *   GET  /admin/video-merges/candidates — 合并候选预览列表 + 评分
 *
 * CHG-SN-5-10（下一卡）：
 *   POST /admin/video-merges                  — 执行合并
 *   POST /admin/video-merges/:auditId/unmerge — 撤销合并
 *   POST /admin/videos/:id/split              — 拆分
 *
 * 鉴权：admin only（ADR-105 §5）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { VideoMergesService, ListCandidatesSchema } from '@/api/services/VideoMergesService'

export async function adminVideoMergesRoutes(fastify: FastifyInstance) {
  const svc = new VideoMergesService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/video-merges/candidates ───────────────────────────

  fastify.get('/admin/video-merges/candidates', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ListCandidatesSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? '参数错误',
          status: 422,
        },
      })
    }
    const result = await svc.listCandidates(parsed.data)
    return reply.send({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  })
}
