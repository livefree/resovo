/**
 * admin/video-merges.ts — video 合并 admin API（ADR-105 / CHG-SN-5-09/-10）
 *
 * GET  /admin/video-merges/candidates         — 合并候选预览列表 + 评分
 * POST /admin/video-merges                    — 执行合并
 * POST /admin/video-merges/:auditId/unmerge   — 撤销合并
 * POST /admin/videos/:id/split                — 拆分
 * GET  /admin/videos/:id/split-suggestions    — 拆分自动分组建议只读预览
 *                                               （ADR-105 AMENDMENT 2026-06-03 / CHG-VIR-11-B）
 *
 * 鉴权：admin only（ADR-105 §5）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import {
  VideoMergesService,
  ListCandidatesSchema,
  MergeSchema,
  UnmergeSchema,
  SplitSchema,
  ListAuditSchema,
} from '@/api/services/VideoMergesService'
import { SplitSuggestionsService } from '@/api/services/SplitSuggestionsService'
import { isAppError } from '@/api/lib/errors'

const UuidParamSchema = z.string().uuid()

export async function adminVideoMergesRoutes(fastify: FastifyInstance) {
  const svc = new VideoMergesService(db)
  const suggestionsSvc = new SplitSuggestionsService(db)
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
    // CHG-VIR-9-C FIX（Codex review）：source 回显透传（identity 空表降级 legacy 时 UI 据此提示 / ADR-105a AMENDMENT 2026-06-03）
    // CHG-VIR-16-TBL FIX（Codex review）：truncated 透传（D-105a-19 cap 截断警示条消费——route 手工构造响应曾把该字段丢弃）
    return reply.send({
      data: result.data, total: result.total, page: result.page, limit: result.limit, source: result.source,
      ...(result.truncated !== undefined ? { truncated: result.truncated } : {}),
    })
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

  // ── GET /admin/videos/:id/split-suggestions（ADR-105 AMENDMENT 2026-06-03 D-105-1）──
  // 实时只读计算零持久化（R-105-S1）；契约表 #6（422 / 404 / 409）

  fastify.get('/admin/videos/:id/split-suggestions', { preHandler: adminOnly }, async (request, reply) => {
    const { id: videoId } = request.params as { id: string }
    if (!UuidParamSchema.safeParse(videoId).success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'videoId 必须是合法 uuid', status: 422 },
      })
    }
    try {
      const result = await suggestionsSvc.getSuggestions(videoId)
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      }
      request.log.error({ err }, '[admin/video-merges] split-suggestions unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })

  // ── GET /admin/video-merges/audit (CHG-SN-6-AUDIT-TIMELINE / RETRO 4/7) ──────

  fastify.get('/admin/video-merges/audit', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ListAuditSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.listAudit(parsed.data)
    return reply.send({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  })
}
