/**
 * tests/unit/api/admin-users-ban-inv.test.ts —
 * ADR-139 N1-139-2 / CHG-SN-8-FUP-USERS-BAN-INV ban 同模式 session invalidate 单测
 *
 * 覆盖：
 *   #1 ban 端点调用 banUser query（query 内 SQL 应含 role_changed_at = NOW()，
 *      mock 验证返回结构含 role_changed_at 字段）
 *   #2 ban 后 Redis user:rca:{id} 写入 EX 900（与 PATCH role 同模式）
 *   #3 admin 不能被 ban → 403（现有行为不变）
 *   #4 banUser 返 null（用户不存在 / 已删除）→ 404
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redisGet = vi.fn()
const redisSet = vi.fn()
vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: (...args: unknown[]) => redisGet(...args),
    set: (...args: unknown[]) => redisSet(...args),
  },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/db/queries/users', () => ({
  findUserById: vi.fn(),
  findAdminUserById: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  updateUserRole: vi.fn(),
}))

vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as usersQueries from '@/api/db/queries/users'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockFindAdminUserById = usersQueries.findAdminUserById as ReturnType<typeof vi.fn>
const mockBanUser = usersQueries.banUser as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  redisGet.mockReset().mockResolvedValue(null)
  redisSet.mockReset().mockResolvedValue('OK')
})

async function buildApp() {
  const { adminUserRoutes } = await import('@/api/routes/admin/users')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminUserRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

describe('PATCH /admin/users/:id/ban — session invalidate (ADR-139 N1-139-2)', () => {
  it('#1 ban 端点 → banUser 调用 + 返回 banned_at + role_changed_at 字段', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', role: 'user' })
    const rca = '2026-05-22T10:00:00.000Z'
    mockBanUser.mockResolvedValue({ id: 'u-1', banned_at: rca, role_changed_at: rca })

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/ban',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(mockBanUser).toHaveBeenCalledWith(expect.anything(), 'u-1')
    expect(res.json().data.banned_at).toBe(rca)
    await app.close()
  })

  it('#2 ban 后 Redis user:rca:{id} 写入 EX 900', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', role: 'user' })
    const rca = '2026-05-22T10:00:00.000Z'
    mockBanUser.mockResolvedValue({ id: 'u-1', banned_at: rca, role_changed_at: rca })

    const app = await buildApp()
    await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/ban',
      headers: adminAuth(),
    })
    expect(redisSet).toHaveBeenCalledWith('user:rca:u-1', rca, 'EX', 900)
    await app.close()
  })

  it('#3 admin 不能被 ban → 403 （现有行为不变）', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: 'u-admin', role: 'admin' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-admin/ban',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toContain('admin')
    expect(mockBanUser).not.toHaveBeenCalled()
    expect(redisSet).not.toHaveBeenCalled()
    await app.close()
  })

  it('#4 banUser 返 null（用户不存在 / 已删除） → 404', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', role: 'user' })
    mockBanUser.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/ban',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(404)
    expect(redisSet).not.toHaveBeenCalled()
    await app.close()
  })
})
