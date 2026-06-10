/**
 * admin/system-jobs.ts — GET /admin/system/jobs（ADR-147）
 *
 * ADR-147 §4 端点契约：
 *   GET /admin/system/jobs?limit=20&since=ISO8601
 *   preHandler: [authenticate, requireRole(['admin', 'moderator'])]
 *   response: { data: AdminTaskItem[], meta: { total, limit, since, queueCounts, degraded? } }
 *   错误码：401 / 403（503 用 meta.degraded=true 软降级，不返回错误）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { TaskAggregator } from '@/api/services/TaskAggregator'

const DEFAULT_WINDOW_DAYS = 3
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  since: z.string().datetime().optional(),
})

export async function adminSystemJobsRoutes(fastify: FastifyInstance) {
  const svc = new TaskAggregator(db)
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]

  fastify.get('/admin/system/jobs', { preHandler: auth }, async (request, reply) => {
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

    const result = await svc.list({ limit, since, userId: request.user!.userId })
    const meta: {
      total: number
      limit: number
      since: string
      queueCounts: typeof result.queueCounts
      degraded?: boolean
    } = {
      total: result.total,
      limit,
      since,
      queueCounts: result.queueCounts,
    }
    if (result.degraded) {
      meta.degraded = true
    }
    return reply.send({ data: result.items, meta })
  })
}
