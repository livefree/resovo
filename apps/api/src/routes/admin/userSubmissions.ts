/**
 * admin/userSubmissions.ts — 用户投稿 4 类统一 API（ADR-124 / CHG-SN-7-REDO-02-B）
 *
 * 6 端点（ADR-124 §端点契约）：
 *   GET    /admin/user-submissions                        — 4 类 + status 过滤 + badges 聚合
 *   GET    /admin/user-submissions/:id                    — 详情
 *   POST   /admin/user-submissions/:id/process            — 状态机 pending → processed + audit
 *   POST   /admin/user-submissions/:id/reject             — 状态机 pending → rejected + audit
 *   POST   /admin/user-submissions/batch-process          — 批量 + audit
 *   POST   /admin/user-submissions/batch-reject           — 批量 + audit
 *
 * 鉴权：全 6 端点 moderator+admin（与 v1 submissions 一致 / ADR-124 §端点契约表）
 * audit：4 路径合并 actionType `user_submission.action` + afterJsonb.action 区分（D-124-3）
 * 错误码：复用 ADR-110 14 码（零新增 / D-124-6）
 */

import type { FastifyInstance, FastifyReply, FastifyBaseLogger } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  UserSubmissionService,
  ListUserSubmissionsQuerySchema,
  UserSubmissionIdParamsSchema,
  ProcessBodySchema,
  RejectBodySchema,
  BatchProcessBodySchema,
  BatchRejectBodySchema,
} from '@/api/services/UserSubmissionService'
import { isAppError } from '@/api/lib/errors'

function handleError(reply: FastifyReply, err: unknown, route: string, log: FastifyBaseLogger): FastifyReply {
  if (isAppError(err, 'NOT_FOUND')) {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
  }
  if (isAppError(err, 'STATE_CONFLICT')) {
    return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
  }
  log.error({ err }, `${route} error`)
  return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
}

export async function adminUserSubmissionsRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]
  const svc = new UserSubmissionService(db)

  // ── GET /admin/user-submissions ──────────────────────────────────
  fastify.get('/admin/user-submissions', { preHandler: auth }, async (request, reply) => {
    const parsed = ListUserSubmissionsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.listUserSubmissions(parsed.data)
      return reply.send(result)
    } catch (err) {
      return handleError(reply, err, '[admin/user-submissions GET]', request.log)
    }
  })

  // ── GET /admin/user-submissions/:id ──────────────────────────────
  fastify.get('/admin/user-submissions/:id', { preHandler: auth }, async (request, reply) => {
    const parsed = UserSubmissionIdParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const row = await svc.getUserSubmissionById(parsed.data.id)
      return reply.send({ data: row })
    } catch (err) {
      return handleError(reply, err, '[admin/user-submissions/:id GET]', request.log)
    }
  })

  // ── POST /admin/user-submissions/:id/process ─────────────────────
  fastify.post('/admin/user-submissions/:id/process', { preHandler: auth }, async (request, reply) => {
    const paramsParsed = UserSubmissionIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: paramsParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const bodyParsed = ProcessBodySchema.safeParse(request.body ?? {})
    if (!bodyParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: bodyParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.processUserSubmission(
        paramsParsed.data.id,
        request.user!.userId,
        bodyParsed.data.action_taken,
        request.id,
      )
      return reply.send({ data: result })
    } catch (err) {
      return handleError(reply, err, '[admin/user-submissions/:id/process]', request.log)
    }
  })

  // ── POST /admin/user-submissions/:id/reject ──────────────────────
  fastify.post('/admin/user-submissions/:id/reject', { preHandler: auth }, async (request, reply) => {
    const paramsParsed = UserSubmissionIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: paramsParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const bodyParsed = RejectBodySchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: bodyParsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.rejectUserSubmission(
        paramsParsed.data.id,
        request.user!.userId,
        bodyParsed.data.reason,
        request.id,
      )
      return reply.send({ data: result })
    } catch (err) {
      return handleError(reply, err, '[admin/user-submissions/:id/reject]', request.log)
    }
  })

  // ── POST /admin/user-submissions/batch-process ───────────────────
  fastify.post('/admin/user-submissions/batch-process', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchProcessBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.batchProcessUserSubmissions(
        parsed.data.ids,
        request.user!.userId,
        parsed.data.action_taken,
        request.id,
      )
      return reply.send({ data: result })
    } catch (err) {
      return handleError(reply, err, '[admin/user-submissions/batch-process]', request.log)
    }
  })

  // ── POST /admin/user-submissions/batch-reject ────────────────────
  fastify.post('/admin/user-submissions/batch-reject', { preHandler: auth }, async (request, reply) => {
    const parsed = BatchRejectBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.batchRejectUserSubmissions(
        parsed.data.ids,
        request.user!.userId,
        parsed.data.reason,
        request.id,
      )
      return reply.send({ data: result })
    } catch (err) {
      return handleError(reply, err, '[admin/user-submissions/batch-reject]', request.log)
    }
  })
}
