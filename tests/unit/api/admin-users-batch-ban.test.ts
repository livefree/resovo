/**
 * tests/unit/api/admin-users-batch-ban.test.ts —
 * ADR-143 / CHG-SN-8-FUP-USERS-BATCH-BAN-EP 端点单测
 *
 * 覆盖（ADR-143 §9 测试 surface，16 用例）：
 *   batch-ban:
 *     #1 happy path 3 valid ids → banned=3
 *     #2 admin 账号 → skip
 *     #3 自残（actor 自己）→ skip
 *     #4 不存在 id → skip
 *     #5 已 banned 用户 → skip（幂等）
 *     #6 ids 去重
 *     #7 每个成功 ban 写 Redis user:rca EX 900
 *     #8 每个成功 ban 写 user.ban audit
 *     #9 ids > 50 → 422
 *     #10 ids = [] → 422
 *     #11 非 UUID → 422
 *   batch-unban:
 *     #12 happy path 3 valid ids → unbanned=3
 *     #13 未 banned 用户 → skip
 *     #14 每个成功 unban 写 user.unban audit
 *     #15 不写 Redis
 *   权限:
 *     #16 非 admin → 403
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redisSet = vi.fn()
vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
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
import * as auditLogQueries from '@/api/db/queries/auditLog'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockFindAdminUserById = usersQueries.findAdminUserById as ReturnType<typeof vi.fn>
const mockBanUser = usersQueries.banUser as ReturnType<typeof vi.fn>
const mockUnbanUser = usersQueries.unbanUser as ReturnType<typeof vi.fn>
const mockInsertAuditLog = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001'
const NORMAL_USER_1 = '11111111-1111-4111-8111-111111111111'
const NORMAL_USER_2 = '22222222-2222-4222-8222-222222222222'
const NORMAL_USER_3 = '33333333-3333-4333-8333-333333333333'
const ADMIN_TARGET_ID = '44444444-4444-4444-8444-444444444444'

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
  mockVerify.mockReturnValue({ userId: ADMIN_USER_ID, role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

async function flushFireAndForget() {
  await new Promise((r) => setImmediate(r))
}

// ── batch-ban ────────────────────────────────────────────────────

describe('POST /admin/users/batch-ban (ADR-143)', () => {
  it('#1 happy path 3 valid ids → banned=3', async () => {
    mockFindAdminUserById.mockImplementation((_db, id: string) =>
      Promise.resolve({ id, role: 'user', banned_at: null }))
    mockBanUser.mockImplementation((_db, id: string) =>
      Promise.resolve({ id, banned_at: '2026-05-22T10:00:00.000Z', role_changed_at: '2026-05-22T10:00:00.000Z' }))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1, NORMAL_USER_2, NORMAL_USER_3] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ banned: 3, skipped: 0, failed: 0 })
    await app.close()
  })

  it('#2 admin 账号 → skip', async () => {
    mockFindAdminUserById.mockImplementation((_db, id: string) => {
      if (id === ADMIN_TARGET_ID) return Promise.resolve({ id, role: 'admin', banned_at: null })
      return Promise.resolve({ id, role: 'user', banned_at: null })
    })
    mockBanUser.mockResolvedValue({ id: NORMAL_USER_1, banned_at: '2026-05-22T10:00:00.000Z', role_changed_at: '2026-05-22T10:00:00.000Z' })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1, ADMIN_TARGET_ID] },
    })
    expect(res.json().data).toEqual({ banned: 1, skipped: 1, failed: 0 })
    expect(mockBanUser).toHaveBeenCalledTimes(1)  // 只 ban NORMAL_USER_1
    await app.close()
  })

  it('#3 自残（actor 自己）→ skip', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [ADMIN_USER_ID] },  // actor 自己
    })
    expect(res.json().data).toEqual({ banned: 0, skipped: 1, failed: 0 })
    expect(mockFindAdminUserById).not.toHaveBeenCalled()
    expect(mockBanUser).not.toHaveBeenCalled()
    await app.close()
  })

  it('#4 不存在 id → skip', async () => {
    mockFindAdminUserById.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1] },
    })
    expect(res.json().data).toEqual({ banned: 0, skipped: 1, failed: 0 })
    expect(mockBanUser).not.toHaveBeenCalled()
    await app.close()
  })

  it('#5 已 banned 用户 → skip（幂等）', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: NORMAL_USER_1, role: 'user', banned_at: '2026-05-20T10:00:00.000Z' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1] },
    })
    expect(res.json().data).toEqual({ banned: 0, skipped: 1, failed: 0 })
    expect(mockBanUser).not.toHaveBeenCalled()
    await app.close()
  })

  it('#6 ids 去重 — 重复 id 只处理 1 次', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: NORMAL_USER_1, role: 'user', banned_at: null })
    mockBanUser.mockResolvedValue({ id: NORMAL_USER_1, banned_at: '2026-05-22T10:00:00.000Z', role_changed_at: '2026-05-22T10:00:00.000Z' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1, NORMAL_USER_1, NORMAL_USER_1] },  // 重复
    })
    expect(res.json().data).toEqual({ banned: 1, skipped: 0, failed: 0 })
    expect(mockBanUser).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('#7 每个成功 ban 写 Redis user:rca EX 900', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: NORMAL_USER_1, role: 'user', banned_at: null })
    const rca = '2026-05-22T10:00:00.000Z'
    mockBanUser.mockResolvedValue({ id: NORMAL_USER_1, banned_at: rca, role_changed_at: rca })
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1] },
    })
    expect(redisSet).toHaveBeenCalledWith(`user:rca:${NORMAL_USER_1}`, rca, 'EX', 900)
    await app.close()
  })

  it('#8 每个成功 ban 写 user.ban audit', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: NORMAL_USER_1, role: 'user', banned_at: null })
    const rca = '2026-05-22T10:00:00.000Z'
    mockBanUser.mockResolvedValue({ id: NORMAL_USER_1, banned_at: rca, role_changed_at: rca })
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1] },
    })
    await flushFireAndForget()
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: ADMIN_USER_ID,
        actionType: 'user.ban',
        targetKind: 'user',
        targetId: NORMAL_USER_1,
        beforeJsonb: { banned_at: null },
        afterJsonb: { banned_at: rca },
      }),
    )
    await app.close()
  })

  it('#9 ids > 50 → 422', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#10 ids = [] → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: [] },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#11 非 UUID → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: adminAuth(),
      payload: { ids: ['not-a-uuid'] },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })
})

// ── batch-unban ──────────────────────────────────────────────────

describe('POST /admin/users/batch-unban (ADR-143)', () => {
  it('#12 happy path 3 valid ids → unbanned=3', async () => {
    mockFindAdminUserById.mockImplementation((_db, id: string) =>
      Promise.resolve({ id, role: 'user', banned_at: '2026-05-20T10:00:00.000Z' }))
    mockUnbanUser.mockImplementation((_db, id: string) =>
      Promise.resolve({ id, banned_at: null }))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-unban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1, NORMAL_USER_2, NORMAL_USER_3] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ unbanned: 3, skipped: 0, failed: 0 })
    await app.close()
  })

  it('#13 未 banned 用户 → skip', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: NORMAL_USER_1, role: 'user', banned_at: null })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-unban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1] },
    })
    expect(res.json().data).toEqual({ unbanned: 0, skipped: 1, failed: 0 })
    expect(mockUnbanUser).not.toHaveBeenCalled()
    await app.close()
  })

  it('#14 每个成功 unban 写 user.unban audit', async () => {
    const oldBan = '2026-05-20T10:00:00.000Z'
    mockFindAdminUserById.mockResolvedValue({ id: NORMAL_USER_1, role: 'user', banned_at: oldBan })
    mockUnbanUser.mockResolvedValue({ id: NORMAL_USER_1, banned_at: null })
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/users/batch-unban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1] },
    })
    await flushFireAndForget()
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: ADMIN_USER_ID,
        actionType: 'user.unban',
        targetKind: 'user',
        targetId: NORMAL_USER_1,
        beforeJsonb: { banned_at: oldBan },
        afterJsonb: { banned_at: null },
      }),
    )
    await app.close()
  })

  it('#15 batch-unban 不写 Redis', async () => {
    mockFindAdminUserById.mockResolvedValue({ id: NORMAL_USER_1, role: 'user', banned_at: '2026-05-20T10:00:00.000Z' })
    mockUnbanUser.mockResolvedValue({ id: NORMAL_USER_1, banned_at: null })
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/users/batch-unban',
      headers: adminAuth(),
      payload: { ids: [NORMAL_USER_1] },
    })
    expect(redisSet).not.toHaveBeenCalled()
    await app.close()
  })
})

// ── 权限 ─────────────────────────────────────────────────────────

describe('batch-ban/unban 权限 (ADR-143)', () => {
  it('#16 非 admin → 403', async () => {
    mockVerify.mockReturnValue({ userId: 'mod-1', role: 'moderator', iat: Math.floor(Date.now() / 1000) })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/users/batch-ban',
      headers: { Authorization: 'Bearer t' },
      payload: { ids: [NORMAL_USER_1] },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
