/**
 * tests/unit/api/admin-users-role-change.test.ts —
 * ADR-139 / CHG-SN-8-FUP-USERS-ROLE-INV-EP 端点 + middleware + refresh 集成单测
 *
 * 覆盖（ADR-139 §9 测试 surface）：
 *   #1 PATCH role → updateUserRole 写 role_changed_at = NOW() + RETURNING
 *   #2 PATCH role → Redis user:rca:{id} 写入 EX 900
 *   #3 middleware token.iat < role_changed_at → 401 ROLE_CHANGED
 *   #4 middleware token.iat >= role_changed_at → 放行 200
 *   #5 middleware cache miss → 放行
 *   #6 refresh refreshToken.iat < role_changed_at → 401 ROLE_CHANGED
 *   #7 refresh refreshToken.iat >= role_changed_at → 正常签发
 *   #8 refresh role_changed_at IS NULL → 正常签发
 *   audit-payload R-MID-1：actionType / targetKind / before/after jsonb 内容断言
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
  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN: '30d',
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
  signAccessToken: vi.fn(() => 'new-access-token'),
  signRefreshToken: vi.fn(() => 'new-refresh-token'),
  verifyRefreshToken: vi.fn(),
  hashToken: (t: string) => `hash:${t}`,
}))

vi.mock('@/api/db/queries/users', () => ({
  findUserById: vi.fn(),
  findAdminUserById: vi.fn(),
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
import * as auditLogQueries from '@/api/db/queries/auditLog'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockVerifyRefresh = authLib.verifyRefreshToken as ReturnType<typeof vi.fn>
const mockFindAdminUserById = usersQueries.findAdminUserById as ReturnType<typeof vi.fn>
const mockFindUserById = usersQueries.findUserById as ReturnType<typeof vi.fn>
const mockUpdateUserRole = usersQueries.updateUserRole as ReturnType<typeof vi.fn>
const mockInsertAuditLog = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  redisGet.mockReset().mockResolvedValue(null)
  redisSet.mockReset().mockResolvedValue('OK')
})

async function buildAdminApp() {
  const { adminUserRoutes } = await import('@/api/routes/admin/users')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminUserRoutes)
  await app.ready()
  return app
}

async function buildAuthApp() {
  const { authRoutes } = await import('@/api/routes/auth')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  await app.register(authRoutes)
  await app.ready()
  return app
}

describe('PATCH /admin/users/:id/role — Redis cache + R-MID-1 audit (ADR-139)', () => {
  it('#1+#2 role 变更 → updateUserRole 写 role_changed_at + Redis user:rca:{id} 写 EX 900', async () => {
    mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', role: 'user' })
    const rca = new Date().toISOString()
    mockUpdateUserRole.mockResolvedValue({ id: 'u-1', role: 'moderator', role_changed_at: rca })

    const app = await buildAdminApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/users/u-1/role',
      headers: { Authorization: 'Bearer t' },
      payload: { role: 'moderator' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdateUserRole).toHaveBeenCalledWith(expect.anything(), 'u-1', 'moderator')
    expect(redisSet).toHaveBeenCalledWith('user:rca:u-1', rca, 'EX', 900)
    await app.close()
  })

  it('R-MID-1 audit payload 内容断言：actionType + targetKind + beforeJsonb + afterJsonb', async () => {
    mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', role: 'user' })
    const rca = '2026-05-22T03:00:00.000Z'
    mockUpdateUserRole.mockResolvedValue({ id: 'u-1', role: 'moderator', role_changed_at: rca })

    const app = await buildAdminApp()
    await app.inject({
      method: 'PATCH',
      url: '/admin/users/u-1/role',
      headers: { Authorization: 'Bearer t' },
      payload: { role: 'moderator' },
    })

    // audit fire-and-forget — 等下一个 tick 让 .catch 链有机会 settle
    await new Promise((r) => setImmediate(r))
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'admin-1',
        actionType: 'user.role_change',
        targetKind: 'user',
        targetId: 'u-1',
        beforeJsonb: { role: 'user' },
        afterJsonb: { role: 'moderator', roleChangedAt: rca },
      }),
    )
    await app.close()
  })
})

describe('middleware authenticate — role_changed_at 校验 (ADR-139 D-139-7)', () => {
  // 用任意 admin 端点（GET /admin/users/:id）作为受 authenticate 守护的路径触发 middleware
  async function probe(app: Awaited<ReturnType<typeof buildAdminApp>>) {
    return app.inject({
      method: 'GET',
      url: '/admin/users/u-1',
      headers: { Authorization: 'Bearer t' },
    })
  }

  it('#3 token.iat < role_changed_at → 401 ROLE_CHANGED', async () => {
    // token 在 role 变更前签发：iat 早于 rca
    mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: 1_700_000_000 })
    redisGet.mockImplementation((key: string) => {
      if (key.startsWith('blacklist:')) return Promise.resolve(null)
      if (key === 'user:rca:admin-1') return Promise.resolve(new Date(1_700_000_500 * 1000).toISOString())
      return Promise.resolve(null)
    })

    const app = await buildAdminApp()
    const res = await probe(app)
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('ROLE_CHANGED')
    await app.close()
  })

  it('#4 token.iat >= role_changed_at → 放行', async () => {
    // token 在 role 变更后签发：iat 晚于 rca
    mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: 1_700_001_000 })
    redisGet.mockImplementation((key: string) => {
      if (key.startsWith('blacklist:')) return Promise.resolve(null)
      if (key === 'user:rca:admin-1') return Promise.resolve(new Date(1_700_000_500 * 1000).toISOString())
      return Promise.resolve(null)
    })
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', username: 'alice', email: 'a@b.com', role: 'user' })

    const app = await buildAdminApp()
    const res = await probe(app)
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('#5 Redis cache miss (key 不存在) → 放行', async () => {
    mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: 1_700_000_000 })
    redisGet.mockResolvedValue(null)  // 所有 key 都返回 null
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', username: 'alice', email: 'a@b.com', role: 'user' })

    const app = await buildAdminApp()
    const res = await probe(app)
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('UserService.refresh — role_changed_at 校验 (ADR-139 D-139-3)', () => {
  it('#6 refreshToken.iat < user.roleChangedAt → 401 ROLE_CHANGED', async () => {
    mockVerifyRefresh.mockReturnValue({ userId: 'u-1', iat: 1_700_000_000, exp: 1_800_000_000 })
    mockFindUserById.mockResolvedValue({
      id: 'u-1', role: 'user', username: 'alice', email: 'a@b.com',
      roleChangedAt: new Date(1_700_000_500 * 1000).toISOString(),
    })

    const app = await buildAuthApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'rt-stale' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('ROLE_CHANGED')
    await app.close()
  })

  it('#7 refreshToken.iat >= user.roleChangedAt → 正常签发新 access token', async () => {
    mockVerifyRefresh.mockReturnValue({ userId: 'u-1', iat: 1_700_001_000, exp: 1_800_000_000 })
    mockFindUserById.mockResolvedValue({
      id: 'u-1', role: 'user', username: 'alice', email: 'a@b.com',
      roleChangedAt: new Date(1_700_000_500 * 1000).toISOString(),
    })

    const app = await buildAuthApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'rt-fresh' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.accessToken).toBe('new-access-token')
    await app.close()
  })

  it('#8 user.roleChangedAt 为 null (从未改过) → 正常签发（向后兼容）', async () => {
    mockVerifyRefresh.mockReturnValue({ userId: 'u-1', iat: 1_700_000_000, exp: 1_800_000_000 })
    mockFindUserById.mockResolvedValue({
      id: 'u-1', role: 'user', username: 'alice', email: 'a@b.com',
      roleChangedAt: null,
    })

    const app = await buildAuthApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'rt-clean' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
