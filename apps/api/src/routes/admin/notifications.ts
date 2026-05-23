/**
 * admin/notifications.ts — GET /admin/notifications（ADR-147）
 *
 * ADR-147 §4 端点契约：
 *   GET /admin/notifications?limit=50&since=ISO8601
 *   preHandler: [authenticate, requireRole(['admin', 'moderator'])]
 *   response: { data: AdminNotificationItem[], meta: { total, limit, since } }
 *   错误码：401 / 403（零新增）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { NotificationService } from '@/api/services/NotificationService'

const DEFAULT_WINDOW_DAYS = 7
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  since: z.string().datetime().optional(),
})

export async function adminNotificationRoutes(fastify: FastifyInstance) {
  const svc = new NotificationService(db)
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]

  fastify.get('/admin/notifications', { preHandler: auth }, async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? '参数错误',
          status: 422,
        },
      })
    }
    const limit = parsed.data.limit ?? DEFAULT_LIMIT
    const since =
      parsed.data.since ??
      new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 3600_000).toISOString()

    const result = await svc.list({ limit, since })
    return reply.send({
      data: result.items,
      meta: {
        total: result.total,
        limit,
        since,
      },
    })
  })
}
