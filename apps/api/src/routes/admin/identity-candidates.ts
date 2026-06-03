/**
 * admin/identity-candidates.ts — identity 候选人工裁定 admin API（ADR-178 / CHG-VIR-9-B）
 *
 * POST /admin/identity-candidates/:id/reject — 人工拒绝候选（candidate rejected + identity_decisions 记录）
 *
 * 鉴权：admin only（ADR-178 D-178-1，对齐 ADR-105 §5 merge 同级破坏性操作）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  IdentityCandidatesService,
  RejectCandidateSchema,
} from '@/api/services/IdentityCandidatesService'
import { isAppError } from '@/api/lib/errors'

export async function adminIdentityCandidatesRoutes(fastify: FastifyInstance) {
  const svc = new IdentityCandidatesService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── POST /admin/identity-candidates/:id/reject ───────────────────

  fastify.post('/admin/identity-candidates/:id/reject', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = RejectCandidateSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    try {
      const result = await svc.reject(id, request.user!.userId, parsed.data.reason)
      return reply.send({ data: result })
    } catch (err) {
      if (isAppError(err, 'NOT_FOUND')) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: err.message, status: 404 } })
      }
      if (isAppError(err, 'STATE_CONFLICT')) {
        return reply.code(409).send({ error: { code: 'STATE_CONFLICT', message: err.message, status: 409 } })
      }
      request.log.error({ err }, '[admin/identity-candidates] reject unexpected error')
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 } })
    }
  })
}
