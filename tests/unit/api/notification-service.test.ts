/**
 * tests/unit/api/notification-service.test.ts —
 * ADR-147 / CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A NotificationService + endpoint 单测
 *
 * 覆盖（ADR-147 §6 测试 surface #1-7 + #12-13）：
 *   #1 白名单内 actionType → 返回对应 NotificationItem
 *   #2 白名单外 actionType → 不出现在结果（SQL ANY 过滤）
 *   #3 level 映射 system.webhook_send_failed → 'danger'
 *   #4 level 映射 staging.batch_publish → 'info' (默认)
 *   #5 href 映射 video.merge → '/admin/merge'
 *   #6 时间窗口 since 参数生效（SQL 收到正确值）
 *   #7 limit 上限（SQL 收到 limit 值）
 *   #12 端点 auth：未登录 401 / 非 admin/moderator 403
 *   #13 端点正常：200 + data + meta.total
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/api/lib/postgres', () => ({ db: { query: queryMock } }))
vi.mock('@/api/lib/redis', () => ({
  // publish：markAllRead 现 publish user:<id> 信号（ADR-196 D-196-2 对称）；duplicate 缺省由 stream init try/catch 降级
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    publish: vi.fn().mockResolvedValue(1),
  },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import { NotificationService } from '@/api/services/NotificationService'
import { NOTIFICATION_ACTION_TYPES } from '@/api/services/notification-audit-emit'
import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'

beforeEach(() => {
  vi.clearAllMocks()
  queryMock.mockReset()
})

/**
 * NTLG-P1-c-C：list 迁 notifications 新表（弃 audit 派生）。
 * list 内 Promise.all 顺序调 3 query → queryMock 依次返回 [listNotifications rows, countNotifications, getEffectiveReadCursor]。
 * listNotifications 谓词参数顺序（buildNotificationFilter + limit）：[scopes($1), since($2), sourceKinds($3), limit($4)]。
 */
interface NotifRowOverride {
  id?: string
  type?: string
  level?: 'info' | 'warn' | 'danger'
  title?: string
  body?: string | null
  href?: string | null
  sourceKind?: string
  createdAt?: Date
}
function notifRow(over: NotifRowOverride = {}) {
  return {
    id: over.id ?? 'n-1',
    type: over.type ?? 'video.manual_add',
    level: over.level ?? 'info',
    title: over.title ?? '手动添加视频',
    body: over.body ?? null,
    payload: null,
    href: over.href ?? '/admin/videos',
    sourceKind: over.sourceKind ?? 'admin_action',
    sourceRef: 'vid-1',
    scope: 'broadcast',
    createdAt: over.createdAt ?? new Date('2026-05-20T10:00:00Z'),
    expiresAt: null,
  }
}
/** mock 一次 list() 的 3 个 query（list rows / count / cursor） */
function mockListQueries(rows: ReturnType<typeof notifRow>[], count = String(rows.length), readAt: Date | null = new Date('2026-05-19T00:00:00Z')) {
  queryMock
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({ rows: [{ count }] })
    .mockResolvedValueOnce({ rows: [{ readAt }] })
}
const LIST_PARAMS = { limit: 50, since: '2026-05-13T00:00:00Z', userId: 'admin-1', role: 'admin' }

describe('NotificationService.list — 新表读 + sourceKind allowlist + readAt（NTLG-P1-c-C）', () => {
  it('#1 新表行直映 NotificationItem（title/level/href 直读列 + read=false）', async () => {
    mockListQueries([notifRow({ id: 'log-1' })])
    const svc = new NotificationService(db)
    const result = await svc.list(LIST_PARAMS)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'log-1',
      title: '手动添加视频',
      level: 'info',
      href: '/admin/videos',
      read: false,
    })
    expect(result.total).toBe(1)
    expect(typeof result.readAt).toBe('string')
  })

  it('#2 8 类白名单真源完整（防漏注册；WHITELIST Set 已删 → 测 NOTIFICATION_ACTION_TYPES）', () => {
    expect(NOTIFICATION_ACTION_TYPES).toHaveLength(8)
    expect(NOTIFICATION_ACTION_TYPES).toContain('system.webhook_send_failed')
    expect(NOTIFICATION_ACTION_TYPES).not.toContain('video.approve')
  })

  it('#3 level 直读列：danger', async () => {
    mockListQueries([notifRow({ level: 'danger', title: 'Webhook 投递失败' })])
    const svc = new NotificationService(db)
    const result = await svc.list(LIST_PARAMS)
    expect(result.items[0]?.level).toBe('danger')
    expect(result.items[0]?.title).toBe('Webhook 投递失败')
  })

  it('#4 level 直读列：info', async () => {
    mockListQueries([notifRow({ level: 'info' })])
    const svc = new NotificationService(db)
    const result = await svc.list(LIST_PARAMS)
    expect(result.items[0]?.level).toBe('info')
  })

  it('#5 href 直读列：/admin/merge', async () => {
    mockListQueries([notifRow({ href: '/admin/merge' })])
    const svc = new NotificationService(db)
    const result = await svc.list(LIST_PARAMS)
    expect(result.items[0]?.href).toBe('/admin/merge')
  })

  it('#5b body 仅在非空时带键（admin_action 恒 null → 不带，parity）', async () => {
    mockListQueries([notifRow({ body: null })])
    const svc = new NotificationService(db)
    const result = await svc.list(LIST_PARAMS)
    expect('body' in result.items[0]!).toBe(false)
  })

  it('#6 since 透传 listNotifications SQL（$2）', async () => {
    mockListQueries([])
    const svc = new NotificationService(db)
    const sinceISO = '2026-05-10T00:00:00.000Z'
    await svc.list({ ...LIST_PARAMS, since: sinceISO })
    expect(queryMock.mock.calls[0][1][1]).toBe(sinceISO)
  })

  it('#7 limit 透传 listNotifications SQL（$4，sourceKinds 插在 $3）', async () => {
    mockListQueries([])
    const svc = new NotificationService(db)
    await svc.list({ ...LIST_PARAMS, limit: 25 })
    expect(queryMock.mock.calls[0][1][3]).toBe(25)
  })

  it('#8 scope 按角色派生 + sourceKind allowlist=[admin_action, crawler] 透传（NTLG-P2-c-C-1 扩纳 crawler）', async () => {
    mockListQueries([])
    const svc = new NotificationService(db)
    await svc.list({ ...LIST_PARAMS, userId: 'mod-9', role: 'moderator' })
    const params = queryMock.mock.calls[0][1]
    expect(params[0]).toEqual(['broadcast', 'role:moderator', 'user:mod-9'])
    // crawler 并入主 list（出 ADR-152 background lane / D-196-5①）→ query 谓词须同时拉 admin_action + crawler
    expect(params[2]).toEqual(['admin_action', 'crawler'])
  })

  it('#8b crawler 完成项（sourceKind=crawler）进 list 并直映 NotificationItem（NTLG-P2-c-C-1）', async () => {
    mockListQueries([notifRow({
      id: 'crawler-run-1',
      type: 'crawler.run.completed',
      title: '采集完成',
      href: '/admin/crawler',
      sourceKind: 'crawler',
    })])
    const svc = new NotificationService(db)
    const result = await svc.list(LIST_PARAMS)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'crawler-run-1',
      title: '采集完成',
      href: '/admin/crawler',
      read: false,
    })
  })

  it('#9 readAt 为 getEffectiveReadCursor 结果（ISO）；cursor null → readAt null', async () => {
    mockListQueries([], '0', null)
    const svc = new NotificationService(db)
    const result = await svc.list(LIST_PARAMS)
    expect(result.readAt).toBeNull()
    expect(result.total).toBe(0)
  })
})

describe('NotificationService.unreadCount / markAllRead — cursor 编排（ADR-192 + AMENDMENT）', () => {
  it('#u1 unreadCount 按角色派生 scope（broadcast + role:<role> + user:<id>）透传 query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '3' }] })
    const svc = new NotificationService(db)
    const count = await svc.unreadCount('admin-1', 'admin')
    expect(count).toBe(3)
    // countUnreadNotifications params: [userId, broadcastScopes, targetedScope]
    const params = queryMock.mock.calls[0][1]
    expect(params[0]).toBe('admin-1')
    expect(params[1]).toEqual(['broadcast', 'role:admin'])
    expect(params[2]).toBe('user:admin-1')
  })

  it('#u2 unreadCount moderator 角色 → role:moderator scope', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    const svc = new NotificationService(db)
    const count = await svc.unreadCount('mod-1', 'moderator')
    expect(count).toBe(0)
    expect(queryMock.mock.calls[0][1][1]).toEqual(['broadcast', 'role:moderator'])
  })

  it('#u3 markAllRead upsert cursor 返回 readAt（ISO 8601）', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const svc = new NotificationService(db)
    const result = await svc.markAllRead('admin-1')
    expect(typeof result.readAt).toBe('string')
    expect(() => new Date(result.readAt).toISOString()).not.toThrow()
    // upsertReadCursor params: [userId, readAt]
    const params = queryMock.mock.calls[0][1]
    expect(params[0]).toBe('admin-1')
    expect(params[1]).toBe(result.readAt)
  })

  it('#u4 markAllRead → publish `user:<id>` 信号触发 SSE 重推（ADR-196 D-196-2 对称，跨标签页 read 同步）', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await new NotificationService(db).markAllRead('admin-1')
    const publishMock = vi.mocked(redis.publish)
    expect(publishMock).toHaveBeenCalledTimes(1)
    const [channel, payload] = publishMock.mock.calls[0]!
    expect(channel).toBe('notifications:changed')
    expect(JSON.parse(payload as string)).toEqual({ scope: 'user:admin-1' })
  })
})

describe('GET /admin/notifications/unread-count + POST /admin/notifications/read endpoints（ADR-192 AMENDMENT）', () => {
  async function buildApp() {
    const Fastify = (await import('fastify')).default
    const cookie = (await import('@fastify/cookie')).default
    const { setupAuthenticate } = await import('@/api/plugins/authenticate')
    const { adminNotificationRoutes } = await import('@/api/routes/admin/notifications')
    const app = Fastify({ logger: false })
    await app.register(cookie, { secret: 'test-secret' })
    setupAuthenticate(app)
    await app.register(adminNotificationRoutes)
    await app.ready()
    return app
  }

  it('#u4 unread-count 未登录 → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/notifications/unread-count' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('#u5 unread-count admin 登录 → 200 + { data: { count }, meta: { scope: self } }', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '7' }] })
    const authLib = await import('@/api/lib/auth')
    ;(authLib.verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValue({
      userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000),
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/notifications/unread-count', headers: { Authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { count: number }; meta: { scope: string } }
    expect(body.data.count).toBe(7)
    expect(body.meta.scope).toBe('self')
    await app.close()
  })

  it('#u6 POST read admin 登录 → 200 + { data: { readAt } }', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const authLib = await import('@/api/lib/auth')
    ;(authLib.verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValue({
      userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000),
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/notifications/read', headers: { Authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { readAt: string } }
    expect(typeof body.data.readAt).toBe('string')
    await app.close()
  })

  it('#u7 POST read 未登录 → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/notifications/read' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('GET /admin/notifications endpoint — auth + 正常路径', () => {
  it('#12 未登录 → 401（任何 admin route 默认行为）', async () => {
    const Fastify = (await import('fastify')).default
    const cookie = (await import('@fastify/cookie')).default
    const { setupAuthenticate } = await import('@/api/plugins/authenticate')
    const { adminNotificationRoutes } = await import('@/api/routes/admin/notifications')
    const app = Fastify({ logger: false })
    await app.register(cookie, { secret: 'test-secret' })
    setupAuthenticate(app)
    await app.register(adminNotificationRoutes)
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/admin/notifications' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('#13 admin 登录 → 200 + data + meta.total + meta.readAt', async () => {
    // list 顺序 3 query：listNotifications rows / countNotifications / getEffectiveReadCursor
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'log-x',
          type: 'system.audit_rollback',
          level: 'warn',
          title: '审计回滚执行',
          body: null,
          payload: null,
          href: '/admin/audit',
          sourceKind: 'admin_action',
          sourceRef: null,
          scope: 'broadcast',
          createdAt: new Date('2026-05-20T08:00:00Z'),
          expiresAt: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ readAt: new Date('2026-05-19T00:00:00Z') }] })

    const authLib = await import('@/api/lib/auth')
    const verifyMock = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
    verifyMock.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })

    const Fastify = (await import('fastify')).default
    const cookie = (await import('@fastify/cookie')).default
    const { setupAuthenticate } = await import('@/api/plugins/authenticate')
    const { adminNotificationRoutes } = await import('@/api/routes/admin/notifications')
    const app = Fastify({ logger: false })
    await app.register(cookie, { secret: 'test-secret' })
    setupAuthenticate(app)
    await app.register(adminNotificationRoutes)
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/notifications',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: unknown[]; meta: { total: number; limit: number; since: string; readAt: string | null } }
    expect(body.data).toHaveLength(1)
    expect(body.meta.total).toBe(5)
    expect(body.meta.limit).toBe(50)
    expect(typeof body.meta.since).toBe('string')
    expect(typeof body.meta.readAt).toBe('string')
    await app.close()
  })

  it('#M1 消息中心模式（q）→ meta.nextCursor 编码（满 limit）+ since=null（无默认窗，ADR-196 D-196-4）', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: '42', type: 'video.merge', level: 'info', title: '合并视频 X', body: null, payload: null,
          href: null, sourceKind: 'admin_action', sourceRef: null, scope: 'broadcast',
          createdAt: new Date('2026-06-09T08:00:00Z'), expiresAt: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ readAt: new Date('2026-06-01T00:00:00Z') }] })

    const authLib = await import('@/api/lib/auth')
    ;(authLib.verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })
    const Fastify = (await import('fastify')).default
    const cookie = (await import('@fastify/cookie')).default
    const { setupAuthenticate } = await import('@/api/plugins/authenticate')
    const { adminNotificationRoutes } = await import('@/api/routes/admin/notifications')
    const app = Fastify({ logger: false })
    await app.register(cookie, { secret: 'test-secret' })
    setupAuthenticate(app)
    await app.register(adminNotificationRoutes)
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/admin/notifications?q=%E8%A7%86%E9%A2%91&limit=1', headers: { Authorization: 'Bearer t' } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { meta: { since: string | null; nextCursor: string | null } }
    expect(body.meta.since).toBeNull() // 消息中心模式不默认 7d 窗
    expect(typeof body.meta.nextCursor).toBe('string') // rows 满 limit → 有下一页游标
    const decoded = Buffer.from(body.meta.nextCursor as string, 'base64url').toString('utf8')
    expect(decoded).toContain('42') // 末行 id
    await app.close()
  })

  it('#M2 无效 cursor → 422 VALIDATION_ERROR', async () => {
    const authLib = await import('@/api/lib/auth')
    ;(authLib.verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })
    const Fastify = (await import('fastify')).default
    const cookie = (await import('@fastify/cookie')).default
    const { setupAuthenticate } = await import('@/api/plugins/authenticate')
    const { adminNotificationRoutes } = await import('@/api/routes/admin/notifications')
    const app = Fastify({ logger: false })
    await app.register(cookie, { secret: 'test-secret' })
    setupAuthenticate(app)
    await app.register(adminNotificationRoutes)
    await app.ready()
    // 'bm9waXBl' = base64url('nopipe')，解码无 '|' 分隔 → decodeCursor 返 null → 422
    const res = await app.inject({ method: 'GET', url: '/admin/notifications?cursor=bm9waXBl', headers: { Authorization: 'Bearer t' } })
    expect(res.statusCode).toBe(422)
    await app.close()
  })
})
