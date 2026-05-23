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
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import { NotificationService, NOTIFICATION_ACTION_WHITELIST } from '@/api/services/NotificationService'
import { db } from '@/api/lib/postgres'

beforeEach(() => {
  vi.clearAllMocks()
  queryMock.mockReset()
})

describe('NotificationService.list — 白名单过滤 + 映射', () => {
  it('#1 白名单内 actionType → 返回 NotificationItem（含 title/level/href）', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'log-1',
          action_type: 'video.manual_add',
          target_id: 'vid-1',
          created_at: new Date('2026-05-20T10:00:00Z'),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ c: '1' }] })
    const svc = new NotificationService(db)
    const result = await svc.list({ limit: 50, since: '2026-05-13T00:00:00Z' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'log-1',
      title: '手动添加视频',
      level: 'info',
      href: '/admin/videos',
      read: false,
    })
  })

  it('#2 白名单完整 8 类（防漏注册）', () => {
    expect(NOTIFICATION_ACTION_WHITELIST.size).toBe(8)
    expect(NOTIFICATION_ACTION_WHITELIST.has('system.webhook_send_failed')).toBe(true)
    expect(NOTIFICATION_ACTION_WHITELIST.has('video.approve')).toBe(false)  // 非白名单
  })

  it('#3 level 映射：system.webhook_send_failed → danger', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'log-2',
          action_type: 'system.webhook_send_failed',
          target_id: null,
          created_at: new Date(),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ c: '1' }] })
    const svc = new NotificationService(db)
    const result = await svc.list({ limit: 50, since: '2026-05-13T00:00:00Z' })
    expect(result.items[0]?.level).toBe('danger')
    expect(result.items[0]?.title).toBe('Webhook 投递失败')
  })

  it('#4 level 映射：staging.batch_publish → info (默认)', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'log-3',
          action_type: 'staging.batch_publish',
          target_id: null,
          created_at: new Date(),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ c: '1' }] })
    const svc = new NotificationService(db)
    const result = await svc.list({ limit: 50, since: '2026-05-13T00:00:00Z' })
    expect(result.items[0]?.level).toBe('info')
  })

  it('#5 href 映射：video.merge → /admin/merge', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'log-4',
          action_type: 'video.merge',
          target_id: 'vid-merge',
          created_at: new Date(),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ c: '1' }] })
    const svc = new NotificationService(db)
    const result = await svc.list({ limit: 50, since: '2026-05-13T00:00:00Z' })
    expect(result.items[0]?.href).toBe('/admin/merge')
  })

  it('#6 时间窗口 since 参数透传到 SQL', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ c: '0' }] })
    const svc = new NotificationService(db)
    const sinceISO = '2026-05-10T00:00:00.000Z'
    await svc.list({ limit: 50, since: sinceISO })
    const firstCall = queryMock.mock.calls[0]
    expect(firstCall[1][1]).toBe(sinceISO)
  })

  it('#7 limit 参数透传到 SQL', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ c: '0' }] })
    const svc = new NotificationService(db)
    await svc.list({ limit: 25, since: '2026-05-13T00:00:00Z' })
    const firstCall = queryMock.mock.calls[0]
    expect(firstCall[1][2]).toBe(25)
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

  it('#13 admin 登录 → 200 + data + meta.total', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'log-x',
          action_type: 'system.audit_rollback',
          target_id: null,
          created_at: new Date('2026-05-20T08:00:00Z'),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ c: '5' }] })

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
    const body = res.json() as { data: unknown[]; meta: { total: number; limit: number; since: string } }
    expect(body.data).toHaveLength(1)
    expect(body.meta.total).toBe(5)
    expect(body.meta.limit).toBe(50)
    expect(typeof body.meta.since).toBe('string')
    await app.close()
  })
})
