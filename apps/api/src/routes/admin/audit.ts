/**
 * admin/audit.ts — /admin/audit 全局审计日志视图 admin API（ADR-118 / CHG-SN-6-01）
 *
 * GET /admin/audit/logs       — 多维 filter + 分页列表（payloadSummary 裁剪）
 * GET /admin/audit/logs/:id   — 单条详情（含完整 jsonb + ipHash）
 * GET /admin/audit/enums      — actionTypes + targetKinds 枚举（编译时反射）
 *
 * 鉴权：adminOnly（plan §4.5 + ADR-118 §端点契约）
 */

import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import {
  AuditLogService,
  ListAdminAuditLogsSchema,
  GetAdminAuditLogDetailSchema,
} from '@/api/services/AuditLogService'

export async function adminAuditRoutes(fastify: FastifyInstance) {
  const svc = new AuditLogService(db)
  const adminOnly = [fastify.authenticate, fastify.requireRole(['admin'])]

  // ── GET /admin/audit/logs ─────────────────────────────────────────

  fastify.get('/admin/audit/logs', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = ListAdminAuditLogsSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.listAdminAuditLogs(parsed.data)
    return reply.send({
      data: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  })

  // ── GET /admin/audit/logs/:id ─────────────────────────────────────

  fastify.get('/admin/audit/logs/:id', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = GetAdminAuditLogDetailSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const detail = await svc.getAdminAuditLogDetail(parsed.data.id)
    if (!detail) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '审计日志不存在', status: 404 },
      })
    }
    return reply.send({ data: detail })
  })

  // ── GET /admin/audit/enums ────────────────────────────────────────

  fastify.get('/admin/audit/enums', { preHandler: adminOnly }, async (_request, reply) => {
    const enums = svc.getAdminAuditEnums()
    return reply.send({ data: enums })
  })
}
