/**
 * admin/webhook.ts — admin webhook 测试端点
 * ADR-146 / CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A
 *
 * POST /admin/webhook/test — admin 连通性测试（不重试 / 30s 超时 / 不写 audit）
 */
import type { FastifyInstance } from 'fastify'
import { db } from '@/api/lib/postgres'
import { AuditLogService } from '@/api/services/AuditLogService'
import { WebhookDispatcher } from '@/api/services/WebhookDispatcher'

export async function adminWebhookRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const auditSvc = new AuditLogService(db)
  const dispatcher = new WebhookDispatcher(db, auditSvc)

  fastify.post('/admin/webhook/test', { preHandler: auth }, async (_request, reply) => {
    const result = await dispatcher.sendTest()
    if (!result.success && result.httpStatus === null && result.error?.includes('请先')) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error,
          status: 422,
        },
      })
    }
    if (!result.success && result.httpStatus === null && result.error?.includes('不安全')) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error,
          status: 422,
        },
      })
    }
    return reply.send({ data: result })
  })
}
