/**
 * admin/video-merges.ts — video 合并 admin API（ADR-105 / CHG-SN-5-09/-10）
 *
 * GET  /admin/video-merges/candidates        — 合并候选预览列表 + 评分
 * POST /admin/video-merges                   — 执行合并
 * POST /admin/video-merges/:auditId/unmerge  — 撤销合并
 * POST /admin/videos/:id/split               — 拆分
 *
 * 鉴权：admin only（ADR-105 §5）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  VideoMergesService,
  ListCandidatesSchema,
  MergeSchema,
  UnmergeSchema,
  SplitSchema,
} from '@/api/services/VideoMergesService'
import { isAppError } from '@/api/lib/errors'

export async function adminVideoMergesRoutes(fastify: FastifyInstance) {
  const svc = new VideoMergesService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/video-merges/candidates ───────────────────────────

  fastify.get('/admin/video-merges/candidates', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ListCandidatesSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.listCandidates(parsed.data)
    return reply.send({ data: result.data, total: result.total, page: result.page, limit: result.limit })
  })

  // ── POST /admin/video-merges ──────────────────────────────────────

  fastify.post('/admin/video-merges', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = MergeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.merge(parsed.data, request.user!.userId)
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      }
      if (isAppError(err, 'VALIDATION_ERROR')) {
        return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: err.message, status: 422 } })
      }
      request.log.error({ err }, '[admin/video-merges] merge unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── POST /admin/video-merges/:auditId/unmerge ────────────────────

  fastify.post('/admin/video-merges/:auditId/unmerge', { preHandler: adminOnly }, async (request, reply) => {
    const { auditId } = request.params as { auditId: string }
    const parsed = UnmergeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.unmerge(auditId, request.user!.userId, parsed.data.reason)
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      }
      request.log.error({ err }, '[admin/video-merges] unmerge unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── POST /admin/videos/:id/split ─────────────────────────────────

  fastify.post('/admin/videos/:id/split', { preHandler: adminOnly }, async (request, reply) => {
    const { id: videoId } = request.params as { id: string }
    const parsed = SplitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.split(
        { videoId, groups: parsed.data.groups },
        request.user!.userId,
      )
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      }
      if (isAppError(err, 'VALIDATION_ERROR')) {
        return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: err.message, status: 422 } })
      }
      request.log.error({ err }, '[admin/video-merges] split unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })
}
