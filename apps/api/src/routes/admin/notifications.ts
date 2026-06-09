/**
 * admin/notifications.ts — GET /admin/notifications（ADR-147）
 *
 * ADR-147 §4 端点契约（NTLG-P1-c-C：数据源迁 notifications 新表 + meta.readAt 加性）：
 *   GET /admin/notifications?limit=50&since=ISO8601
 *   preHandler: [authenticate, requireRole(['admin', 'moderator'])]
 *   response: { data: AdminNotificationItem[], meta: { total, limit, since, readAt } }
 *   错误码：401 / 403 / 422（零新增）
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

    const result = await svc.list({
      limit,
      since,
      userId: request.user!.userId,
      role: request.user!.role,
    })
    return reply.send({
      data: result.items,
      meta: {
        total: result.total,
        limit,
        since,
        // NTLG-P1-c-C：已读高水位线（cursor 单一源）；前端据此对 general+background 合并项统一计算 read。
        readAt: result.readAt,
      },
    })
  })

  // ── GET /admin/notifications/unread-count（ADR-192 D-192-8）─────────
  // top bar 铃铛未读计数；cursor 混合模型（D-192-5）。P1 阶段 emit 未接入（归 P1-c）
  // → notifications 新表空时恒返 0（「无新通知」过渡期正确语义，AMENDMENT D-192-AMD-3）。
  fastify.get('/admin/notifications/unread-count', { preHandler: auth }, async (request, reply) => {
    const count = await svc.unreadCount(request.user!.userId, request.user!.role)
    return reply.send({ data: { count }, meta: { scope: 'self' } })
  })

  // ── POST /admin/notifications/read（ADR-192 AMENDMENT D-192-AMD-1）──
  // 标记当前登录用户全部 broadcast/role 通知已读：upsert cursor 高水位线（read_at=NOW，服务端取时）。
  fastify.post('/admin/notifications/read', { preHandler: auth }, async (request, reply) => {
    const result = await svc.markAllRead(request.user!.userId)
    return reply.send({ data: result })
  })
}
