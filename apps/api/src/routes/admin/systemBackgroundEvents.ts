/**
 * admin/systemBackgroundEvents.ts — GET /admin/system/background-events（ADR-152）
 * CW1-E-EP step 4
 *
 * ADR-152 §端点契约：
 *   GET /admin/system/background-events?limit=20&windowHours=6
 *   preHandler: [authenticate, requireRole(['admin', 'moderator'])]
 *   response: { data: AdminBackgroundEvent[], meta: { total, limit, windowHours, generatedAt, degraded? } }
 *   错误码：401 / 403 / 422 VALIDATION_ERROR
 *   Cache-Control: private, max-age=30（D-152-4 防重复打 DB / per-user）
 *
 * 分层约束（ADR-152 §8）：Route 层仅做 zod 校验 + auth + 调 Service；不含业务聚合逻辑。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import { BackgroundEventService } from '@/api/services/BackgroundEventService'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const DEFAULT_WINDOW_HOURS = 6
const MIN_WINDOW_HOURS = 1
const MAX_WINDOW_HOURS = 24

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  windowHours: z.coerce.number().int().min(MIN_WINDOW_HOURS).max(MAX_WINDOW_HOURS).optional(),
})

export async function adminSystemBackgroundEventsRoutes(fastify: FastifyInstance) {
  const svc = new BackgroundEventService(db)
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]

  fastify.get('/admin/system/background-events', { preHandler: auth }, async (request, reply) => {
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
    const windowHours = parsed.data.windowHours ?? DEFAULT_WINDOW_HOURS

    const result = await svc.list({ limit, windowHours, userId: request.user!.userId })

    // D-152-4：Cache-Control private, max-age=30（per-user 30s 短缓存 / 防重复打 DB）
    void reply.header('Cache-Control', 'private, max-age=30')

    const meta: {
      total: number
      limit: number
      windowHours: number
      generatedAt: string
      degraded?: boolean
    } = {
      total: result.total,
      limit,
      windowHours,
      generatedAt: result.generatedAt,
    }
    if (result.degraded) {
      meta.degraded = true
    }

    return reply.send({ data: result.events, meta })
  })
}
