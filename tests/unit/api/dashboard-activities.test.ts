/**
 * tests/unit/api/dashboard-activities.test.ts —
 * ADR-141 / CHG-SN-8-FUP-DASH-ACTIVITY-LIVE 端点单测
 *
 * 覆盖（ADR-141 §9 测试 surface，10 用例）：
 *   #1 happy path 有数据 → 200 + data 非空 + created_at DESC 排序
 *   #2 空数据 → 200 + 空 data
 *   #3 limit 生效（limit=3 → 最多 3 条）
 *   #4 limit 超范围（limit=100）→ 422 VALIDATION_ERROR
 *   #5 limit 缺省 → default 10
 *   #6 未认证 → 401
 *   #7 moderator → 403（admin only）
 *   #8 actorUsername LEFT JOIN 有 → string
 *   #9 actorUsername LEFT JOIN 无（actor 已删除）→ null
 *   #10 缓存命中：连续 2 次请求，第 2 次不查 DB
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbQueryMock = vi.fn()
vi.mock('@/api/lib/postgres', () => ({
  db: { query: (...args: unknown[]) => dbQueryMock(...args) },
}))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

async function buildApp() {
  // 动态 import 让每个测试拿独立 module 副本，避免 module-level 缓存跨测试污染
  // （ADR-141 缓存定义在 module top-level Map；测试间通过 vi.resetModules + dynamic import 隔离）
  vi.resetModules()
  const { adminDashboardRoutes } = await import('@/api/routes/admin/dashboard')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminDashboardRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

const ROW_1 = {
  id: '1001', actorId: 'a-1', actorUsername: 'Alice',
  actionType: 'video.approve', targetKind: 'video', targetId: 'v-1',
  createdAt: '2026-05-22T10:00:00.000Z',
}
const ROW_2 = {
  id: '1000', actorId: 'a-2', actorUsername: 'Bob',
  actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-2',
  createdAt: '2026-05-22T09:00:00.000Z',
}

describe('GET /admin/dashboard/activities (ADR-141)', () => {
  it('#1 happy path → 200 + 非空 data + created_at DESC 排序', async () => {
    dbQueryMock.mockResolvedValue({ rows: [ROW_1, ROW_2] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/dashboard/activities',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].id).toBe('1001')
    expect(body.data[0].createdAt > body.data[1].createdAt).toBe(true)
    await app.close()
  })

  it('#2 空数据 → 200 + 空 data', async () => {
    dbQueryMock.mockResolvedValue({ rows: [] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/dashboard/activities',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
    await app.close()
  })

  it('#3 limit=3 → SQL 参数 = 3', async () => {
    dbQueryMock.mockResolvedValue({ rows: [] })
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: '/admin/dashboard/activities?limit=3',
      headers: adminAuth(),
    })
    expect(dbQueryMock).toHaveBeenCalledWith(expect.any(String), [3])
    await app.close()
  })

  it('#4 limit=100 超范围 → 422 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/dashboard/activities?limit=100',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(dbQueryMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('#5 limit 缺省 → default 10', async () => {
    dbQueryMock.mockResolvedValue({ rows: [] })
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: '/admin/dashboard/activities',
      headers: adminAuth(),
    })
    expect(dbQueryMock).toHaveBeenCalledWith(expect.any(String), [10])
    await app.close()
  })

  it('#6 未认证 → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/dashboard/activities',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('#7 moderator → 403 (admin only)', async () => {
    mockVerify.mockReturnValue({ userId: 'mod-1', role: 'moderator', iat: Math.floor(Date.now() / 1000) })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/dashboard/activities',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('#8 actorUsername LEFT JOIN 有 → string 字段', async () => {
    dbQueryMock.mockResolvedValue({ rows: [{ ...ROW_1, actorUsername: 'Alice' }] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/dashboard/activities',
      headers: adminAuth(),
    })
    expect(res.json().data[0].actorUsername).toBe('Alice')
    await app.close()
  })

  it('#9 actorUsername LEFT JOIN 无（actor 已删除）→ null', async () => {
    dbQueryMock.mockResolvedValue({ rows: [{ ...ROW_1, actorUsername: null }] })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/dashboard/activities',
      headers: adminAuth(),
    })
    expect(res.json().data[0].actorUsername).toBeNull()
    await app.close()
  })

  it('#10 缓存命中：连续 2 次相同 limit 请求 → DB 仅调用 1 次', async () => {
    dbQueryMock.mockResolvedValue({ rows: [ROW_1] })
    const app = await buildApp()  // 新 module 实例（vi.resetModules + dynamic import 保证 cache 空）
    await app.inject({
      method: 'GET', url: '/admin/dashboard/activities?limit=5',
      headers: adminAuth(),
    })
    await app.inject({
      method: 'GET', url: '/admin/dashboard/activities?limit=5',
      headers: adminAuth(),
    })
    expect(dbQueryMock).toHaveBeenCalledTimes(1)  // 第 2 次走缓存
    await app.close()
  })
})
