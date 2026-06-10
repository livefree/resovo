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
import { NotificationStreamService } from '@/api/services/NotificationStreamService'

const DEFAULT_WINDOW_DAYS = 7
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// ADR-196 D-196-4：消息中心检索/过滤/keyset 分页（加性，省略=drawer 旧行为）
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  cursor: z.string().min(1).max(256).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  level: z.enum(['info', 'warn', 'danger']).optional(),
  type: z.string().trim().min(1).max(100).optional(),
  readState: z.enum(['read', 'unread']).optional(),
})

// ADR-197 D-197-3：dismiss 软移除入参（item_key 走 body 规避 path param `:` 冲突）。
const DismissSchema = z.object({ itemKey: z.string().min(1).max(256) })
const DismissBatchSchema = z.object({ itemKeys: z.array(z.string().min(1).max(256)).min(1).max(200) })

/** keyset 游标编解码（base64url 不透明串 `<createdAtISO>|<id>`）。 */
function encodeCursor(c: { createdAt: string; id: string }): string {
  return Buffer.from(`${c.createdAt}|${c.id}`, 'utf8').toString('base64url')
}
function decodeCursor(s: string): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id, ...rest] = Buffer.from(s, 'base64url').toString('utf8').split('|')
    if (!createdAt || !id || rest.length > 0 || Number.isNaN(Date.parse(createdAt)) || !/^\d+$/.test(id)) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

export async function adminNotificationRoutes(fastify: FastifyInstance) {
  const svc = new NotificationService(db)
  const auth = [fastify.authenticate, fastify.requireRole(['admin', 'moderator'])]

  // ADR-196 D-196-3：SSE 未读推送连接编排（单实例共享 subscribe + 内存连接表 fan-out）。
  // init 非阻塞、Redis-down 不抛（available=false → /stream 503 降级）；onClose 优雅关闭。
  const streamService = new NotificationStreamService({
    getUnreadCount: (userId, role) => svc.unreadCount(userId, role),
  })
  streamService.init()
  fastify.addHook('onClose', async () => {
    await streamService.shutdown()
  })

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
    const d = parsed.data
    // 消息中心模式：cursor/q/level/type/until/readState 任一 → 全量历史（不默认 7d 窗）；drawer 模式默认 7d
    const isHistoryMode = Boolean(d.cursor || d.q || d.level || d.type || d.until || d.readState)
    const since =
      d.since ??
      (isHistoryMode ? undefined : new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 3600_000).toISOString())

    let cursor: { createdAt: string; id: string } | undefined
    if (d.cursor) {
      const decoded = decodeCursor(d.cursor)
      if (!decoded) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: 'cursor 无效', status: 422 },
        })
      }
      cursor = decoded
    }

    const result = await svc.list({
      limit,
      userId: request.user!.userId,
      role: request.user!.role,
      ...(since != null && { since }),
      ...(cursor != null && { cursor }),
      ...(d.until != null && { until: d.until }),
      ...(d.q != null && { q: d.q }),
      ...(d.level != null && { levels: [d.level] }),
      ...(d.type != null && { types: [d.type] }),
      ...(d.readState != null && { readState: d.readState }),
    })
    return reply.send({
      data: result.items,
      meta: {
        total: result.total,
        limit,
        since: since ?? null,
        // NTLG-P1-c-C：已读高水位线（cursor 单一源）；前端据此对 general+background 合并项统一计算 read。
        readAt: result.readAt,
        // ADR-196 D-196-4：keyset 下一页游标（base64url 不透明串）；null=末页
        nextCursor: result.nextCursor != null ? encodeCursor(result.nextCursor) : null,
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

  // ── POST /admin/notifications/dismiss（ADR-197 D-197-2/3）─────────────────
  // 单条抽屉级软移除（视图态，非物理删除 / 非已读）：守卫可 dismiss 范围（general \d+ / bg-audit:），
  // 命中 upcoming/active 不可移除项 → 422 ITEM_NOT_DISMISSABLE。Route 仅校验 + 委托 Service（守分层）。
  fastify.post('/admin/notifications/dismiss', { preHandler: auth }, async (request, reply) => {
    const parsed = DismissSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.dismiss(request.user!.userId, parsed.data.itemKey)
    if (!result.ok) {
      return reply.code(422).send({
        error: { code: 'ITEM_NOT_DISMISSABLE', message: '该项不支持移除', status: 422 },
      })
    }
    return reply.send({ data: { dismissed: result.dismissed } })
  })

  // ── POST /admin/notifications/dismiss-batch（ADR-197 D-197-3）─────────────
  // 批量清空：前端回传当前抽屉可见 item_key 数组（多源不可后端单查复现，D-197-3），逐条守卫部分成功
  // （可移除批量落库、upcoming/active 跳过计 skipped，不整批失败）。
  fastify.post('/admin/notifications/dismiss-batch', { preHandler: auth }, async (request, reply) => {
    const parsed = DismissBatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 422 },
      })
    }
    const result = await svc.dismissBatch(request.user!.userId, parsed.data.itemKeys)
    return reply.send({ data: result })
  })

  // ── GET /admin/notifications/stream（ADR-196 D-196-1/2/3，全平台首个 SSE）──────
  // 未读计数实时推送（替 60s 轮询，admin+moderator）：建连即推当前未读 → Redis 信号触发推 unread
  //   → 25s 心跳 keep-alive。客户端用 fetch-stream（携 Bearer，非 EventSource，D-196-1）。
  // route 仅 auth + 建流 + 委托（连接编排全在 NotificationStreamService，守 Route→Service 分层）。
  fastify.get('/admin/notifications/stream', { preHandler: auth }, async (request, reply) => {
    // Redis-down 优雅降级 / 软上限 → 503（不挂半开连接，client 走 D-196-6 轮询 fallback）
    if (!streamService.isAvailable()) {
      return reply.code(503).send({
        error: { code: 'STREAM_UNAVAILABLE', message: 'SSE 暂不可用，请降级轮询', status: 503 },
      })
    }
    if (streamService.isAtCapacity()) {
      return reply.code(503).send({
        error: { code: 'STREAM_AT_CAPACITY', message: 'SSE 连接已满，请降级轮询', status: 503 },
      })
    }
    // 接管 raw response（Fastify 不再管理生命周期）；建流后须靠 client 断连 / onClose 收尾
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁反代缓冲（nginx），保 SSE 帧即时下推
    })
    const conn = streamService.register({
      userId: request.user!.userId,
      role: request.user!.role,
      sink: { write: (chunk) => { raw.write(chunk) } },
    })
    // 客户端断连 → 注销连接防内存泄漏（黄线 3）
    request.raw.on('close', () => { streamService.unregister(conn) })
  })
}
