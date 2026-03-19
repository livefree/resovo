/**
 * tests/unit/api/admin-users.test.ts
 * CHG-26: Admin 用户管理 — 搜索过滤、分页、密码重置权限、admin 不可封 admin
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null) },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/db/queries/users', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByUsername: vi.fn(),
  createUser: vi.fn(),
  listAdminUsers: vi.fn(),
  findAdminUserById: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  updateUserRole: vi.fn(),
  resetUserPassword: vi.fn(),
}))

// bcryptjs: deterministic mock to avoid real hashing in tests
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashed'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as usersQueriesModule from '@/api/db/queries/users'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockListAdminUsers = usersQueriesModule.listAdminUsers as ReturnType<typeof vi.fn>
const mockFindAdminUserById = usersQueriesModule.findAdminUserById as ReturnType<typeof vi.fn>
const mockBanUser = usersQueriesModule.banUser as ReturnType<typeof vi.fn>
const mockResetUserPassword = usersQueriesModule.resetUserPassword as ReturnType<typeof vi.fn>

async function buildApp() {
  const { adminUserRoutes } = await import('@/api/routes/admin/users')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminUserRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'admin-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('Admin Users API (CHG-26)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  // ── GET /admin/users ──────────────────────────────────────────

  it('GET /admin/users：未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/users' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /admin/users：非 admin 角色返回 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: authHeader('user'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('GET /admin/users：admin 可获取用户列表', async () => {
    mockListAdminUsers.mockResolvedValueOnce({ rows: [], total: 0 })
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: unknown[]; total: number }>()
    expect(body.total).toBe(0)
  })

  it('GET /admin/users?q=foo：将 q 参数传递给 listAdminUsers', async () => {
    mockListAdminUsers.mockResolvedValueOnce({ rows: [], total: 0 })
    await app.inject({
      method: 'GET',
      url: '/admin/users?q=foo',
      headers: authHeader(),
    })
    expect(mockListAdminUsers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: 'foo' })
    )
  })

  it('GET /admin/users?page=2&limit=10：将分页参数传递给 listAdminUsers', async () => {
    mockListAdminUsers.mockResolvedValueOnce({ rows: [], total: 25 })
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users?page=2&limit=10',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ page: number; limit: number }>()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)
    expect(mockListAdminUsers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 2, limit: 10 })
    )
  })

  // ── PATCH /admin/users/:id/ban ────────────────────────────────

  it('PATCH /admin/users/:id/ban：尝试封禁 admin 账号返回 403', async () => {
    mockFindAdminUserById.mockResolvedValueOnce({
      id: 'target-admin',
      username: 'superadmin',
      email: 'super@example.com',
      role: 'admin',
      avatar_url: null,
      locale: 'zh',
      banned_at: null,
      created_at: '2024-01-01',
    })
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/users/target-admin/ban',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(403)
    const body = res.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('PATCH /admin/users/:id/ban：封禁普通用户成功返回 200', async () => {
    mockFindAdminUserById.mockResolvedValueOnce({
      id: 'user-1',
      role: 'user',
      banned_at: null,
    })
    mockBanUser.mockResolvedValueOnce({ id: 'user-1', banned_at: '2026-03-18T00:00:00Z' })
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/users/user-1/ban',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
  })

  // ── POST /admin/users/:id/reset-password ──────────────────────

  it('POST /admin/users/:id/reset-password：未登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/user-1/reset-password',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /admin/users/:id/reset-password：非 admin 返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/user-1/reset-password',
      headers: authHeader('user'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /admin/users/:id/reset-password：用户不存在返回 404', async () => {
    mockFindAdminUserById.mockResolvedValueOnce(null)
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/nonexistent/reset-password',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /admin/users/:id/reset-password：尝试重置 admin 密码返回 403', async () => {
    mockFindAdminUserById.mockResolvedValueOnce({
      id: 'admin-2',
      role: 'admin',
      banned_at: null,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/admin-2/reset-password',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /admin/users/:id/reset-password：成功时返回 newPassword', async () => {
    mockFindAdminUserById.mockResolvedValueOnce({
      id: 'user-1',
      role: 'user',
      banned_at: null,
    })
    mockResetUserPassword.mockResolvedValueOnce({ id: 'user-1' })

    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/user-1/reset-password',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { newPassword: string } }>()
    expect(typeof body.data.newPassword).toBe('string')
    expect(body.data.newPassword.length).toBeGreaterThanOrEqual(12)
  })
})
