/**
 * tests/unit/api/admin-users-ban-audit.test.ts —
 * CHG-SN-8-FUP-USERS-BAN-AUDIT / R-MID-1 第 20 次系统化
 *
 * 覆盖（R-MID-1 PAYLOAD_ASSERTION_REQUIRED 守卫）：
 *   #1 ban audit payload：actionType 'user.ban' + targetKind 'user' + before {banned_at: null} + after {banned_at: NEW}
 *   #2 unban audit payload：actionType 'user.unban' + before {banned_at: OLD} + after {banned_at: null}
 *   #3 ban admin 403 不写 audit
 *   #4 unban 用户不存在 404 不写 audit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redisSet = vi.fn().mockResolvedValue('OK')
vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: (...args: unknown[]) => redisSet(...args) },
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
import * as auditLogQueries from '@/api/db/queries/auditLog'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockFindAdminUserById = usersQueries.findAdminUserById as ReturnType<typeof vi.fn>
const mockBanUser = usersQueries.banUser as ReturnType<typeof vi.fn>
const mockUnbanUser = usersQueries.unbanUser as ReturnType<typeof vi.fn>
const mockInsertAuditLog = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
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

async function flushFireAndForget() {
  await new Promise((r) => setImmediate(r))
}

describe('R-MID-1 user.ban / user.unban audit payload (CHG-SN-8-FUP-USERS-BAN-AUDIT)', () => {
  it('#1 ban audit payload：actionType + targetKind + before/after.banned_at 正确', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', role: 'user', banned_at: null })
    const newBan = '2026-05-22T15:00:00.000Z'
    mockBanUser.mockResolvedValue({ id: 'u-1', banned_at: newBan, role_changed_at: newBan })

    const app = await buildApp()
    await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/ban',
      headers: adminAuth(),
    })
    await flushFireAndForget()

    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'admin-1',
        actionType: 'user.ban',
        targetKind: 'user',
        targetId: 'u-1',
        beforeJsonb: { banned_at: null },
        afterJsonb: { banned_at: newBan },
      }),
    )
    await app.close()
  })

  it('#2 unban audit payload：before {banned_at: OLD} + after {banned_at: null}', async () => {
    const oldBan = '2026-05-20T10:00:00.000Z'
    // unban handler 先 findAdminUserById 取 before；再 unbanUser 返 after
    mockFindAdminUserById.mockResolvedValue({ id: 'u-1', role: 'user', banned_at: oldBan })
    mockUnbanUser.mockResolvedValue({ id: 'u-1', banned_at: null })

    const app = await buildApp()
    await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/unban',
      headers: adminAuth(),
    })
    await flushFireAndForget()

    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'admin-1',
        actionType: 'user.unban',
        targetKind: 'user',
        targetId: 'u-1',
        beforeJsonb: { banned_at: oldBan },
        afterJsonb: { banned_at: null },
      }),
    )
    await app.close()
  })

  it('#3 ban admin → 403 不写 audit', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: 'u-admin', role: 'admin', banned_at: null })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-admin/ban',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(403)
    await flushFireAndForget()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    await app.close()
  })

  it('#4 unban 用户不存在 → 404 不写 audit', async () => {
    mockFindAdminUserById.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-x/unban',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(404)
    await flushFireAndForget()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    await app.close()
  })
})
