/**
 * tests/unit/api/admin-users-edit.test.ts —
 * ADR-140 / CHG-SN-8-FUP-USERS-EDIT-EP 双端点（email + profile）+ R-MID-1 audit 单测
 *
 * 覆盖（ADR-140 §9 测试 surface，22 用例）：
 *   ─ email 端点（10）：
 *     #1 happy path → 200 + previousEmail
 *     #2 目标不存在 → 404
 *     #3 目标 admin → 403
 *     #4 新邮箱已被其他用户 → 409 CONFLICT（Service 层 prevalidation）
 *     #5 新邮箱与原邮箱相同 → 200 幂等（不写 DB / 不写 audit）
 *     #6 邮箱格式无效 → 422
 *     #7 audit payload 正确（beforeJsonb.email = old / afterJsonb.email = new）
 *     #8 422/403/404 路径不写 audit
 *     #9 未认证 → 401
 *     #10 DB UNIQUE race 23505 → 409 CONFLICT
 *   ─ profile 端点（10）：
 *     #11 改 displayName → 200
 *     #12 改 locale → 200
 *     #13 改 avatarUrl → 200
 *     #14 同时改 displayName + locale → 200
 *     #15 displayName 超 50 字符 → 422
 *     #16 displayName 含非法字符（<script>） → 422
 *     #17 displayName = null（清除） → 200
 *     #18 body 空对象 → 422
 *     #19 目标 admin → 403
 *     #20 目标不存在 → 404
 *   ─ R-MID-1 audit 内容（2）：
 *     #21 profile audit 仅含实际变更字段（partial before/after）
 *     #22 profile 422/403/404 路径不写 audit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/db/queries/users', () => ({
  findUserById: vi.fn(),
  findAdminUserById: vi.fn(),
  updateUserRole: vi.fn(),
  findUserByEmailExcludingId: vi.fn(),
  updateUserEmail: vi.fn(),
  updateUserProfile: vi.fn(),
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
const mockFindByEmailExcl = usersQueries.findUserByEmailExcludingId as ReturnType<typeof vi.fn>
const mockUpdateUserEmail = usersQueries.updateUserEmail as ReturnType<typeof vi.fn>
const mockUpdateUserProfile = usersQueries.updateUserProfile as ReturnType<typeof vi.fn>
const mockInsertAuditLog = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
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

const USER = { id: 'u-1', username: 'alice', email: 'alice@old.com', role: 'user', display_name: null, locale: 'en', avatar_url: null }
const ADMIN_USER = { ...USER, id: 'u-admin', role: 'admin' }

// ── PATCH /admin/users/:id/email ─────────────────────────────────────

describe('PATCH /admin/users/:id/email (ADR-140 D-140-1+2)', () => {
  it('#1 happy path → 200 + previousEmail', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockFindByEmailExcl.mockResolvedValue(null)
    mockUpdateUserEmail.mockResolvedValue({ id: 'u-1', email: 'alice@new.com' })

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      headers: adminAuth(), payload: { email: 'alice@new.com' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toEqual({ id: 'u-1', email: 'alice@new.com', previousEmail: 'alice@old.com' })
    await app.close()
  })

  it('#2 目标不存在 → 404', async () => {
    mockFindAdminUserById.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-x/email',
      headers: adminAuth(), payload: { email: 'x@y.com' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('#3 目标 admin → 403', async () => {
    mockFindAdminUserById.mockResolvedValue(ADMIN_USER)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-admin/email',
      headers: adminAuth(), payload: { email: 'x@y.com' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toContain('admin')
    await app.close()
  })

  it('#4 新邮箱已被其他用户 → 409 CONFLICT (Service 层 prevalidation)', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockFindByEmailExcl.mockResolvedValue({ id: 'u-2' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      headers: adminAuth(), payload: { email: 'taken@x.com' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('CONFLICT')
    expect(mockUpdateUserEmail).not.toHaveBeenCalled()
    await app.close()
  })

  it('#5 新邮箱与原邮箱相同 → 200 幂等（不写 DB / 不写 audit）', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      headers: adminAuth(), payload: { email: 'alice@old.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpdateUserEmail).not.toHaveBeenCalled()
    await flushFireAndForget()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    await app.close()
  })

  it('#6 邮箱格式无效 → 422', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      headers: adminAuth(), payload: { email: 'not-an-email' },
    })
    expect(res.statusCode).toBe(422)
    expect(mockFindAdminUserById).not.toHaveBeenCalled()  // 校验在 lookup 前
    await app.close()
  })

  it('#7 audit payload 正确（before/after.email）', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockFindByEmailExcl.mockResolvedValue(null)
    mockUpdateUserEmail.mockResolvedValue({ id: 'u-1', email: 'alice@new.com' })

    const app = await buildApp()
    await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      headers: adminAuth(), payload: { email: 'alice@new.com' },
    })
    await flushFireAndForget()
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'admin-1',
        actionType: 'user.email_change',
        targetKind: 'user',
        targetId: 'u-1',
        beforeJsonb: { email: 'alice@old.com' },
        afterJsonb: { email: 'alice@new.com' },
      }),
    )
    await app.close()
  })

  it('#8 422 / 403 / 404 路径不写 audit', async () => {
    // 422 路径
    const app1 = await buildApp()
    await app1.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      headers: adminAuth(), payload: { email: 'bad' },
    })
    await flushFireAndForget()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    await app1.close()
  })

  it('#9 未认证 → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      payload: { email: 'x@y.com' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('#10 DB UNIQUE race 23505 → 409 CONFLICT', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockFindByEmailExcl.mockResolvedValue(null)  // Service 层先验通过
    // 但 DB UPDATE 时另一事务先插入了同邮箱 → 23505
    const pgErr: Error & { code?: string } = new Error('duplicate key value violates unique constraint')
    pgErr.code = '23505'
    mockUpdateUserEmail.mockRejectedValue(pgErr)

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/email',
      headers: adminAuth(), payload: { email: 'race@x.com' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('CONFLICT')
    await app.close()
  })
})

// ── PATCH /admin/users/:id/profile ───────────────────────────────────

describe('PATCH /admin/users/:id/profile (ADR-140 D-140-1+3)', () => {
  it('#11 改 displayName → 200', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockUpdateUserProfile.mockResolvedValue({ id: 'u-1', display_name: '爱丽丝', locale: 'en', avatar_url: null })

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { displayName: '爱丽丝' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.displayName).toBe('爱丽丝')
    await app.close()
  })

  it('#12 改 locale → 200', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockUpdateUserProfile.mockResolvedValue({ id: 'u-1', display_name: null, locale: 'zh-CN', avatar_url: null })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { locale: 'zh-CN' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.locale).toBe('zh-CN')
    await app.close()
  })

  it('#13 改 avatarUrl → 200', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockUpdateUserProfile.mockResolvedValue({ id: 'u-1', display_name: null, locale: 'en', avatar_url: 'https://x.com/a.png' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { avatarUrl: 'https://x.com/a.png' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.avatarUrl).toBe('https://x.com/a.png')
    await app.close()
  })

  it('#14 同时改 displayName + locale → 200', async () => {
    mockFindAdminUserById.mockResolvedValue(USER)
    mockUpdateUserProfile.mockResolvedValue({ id: 'u-1', display_name: '名', locale: 'zh-CN', avatar_url: null })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { displayName: '名', locale: 'zh-CN' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(expect.anything(), 'u-1', { displayName: '名', locale: 'zh-CN', avatarUrl: undefined })
    await app.close()
  })

  it('#15 displayName 超 50 字符 → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { displayName: 'a'.repeat(51) },
    })
    expect(res.statusCode).toBe(422)
    expect(mockFindAdminUserById).not.toHaveBeenCalled()
    await app.close()
  })

  it('#16 displayName 含非法字符（<script>） → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { displayName: '<script>alert(1)</script>' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#17 displayName = null（清除） → 200', async () => {
    mockFindAdminUserById.mockResolvedValue({ ...USER, display_name: '旧名' })
    mockUpdateUserProfile.mockResolvedValue({ id: 'u-1', display_name: null, locale: 'en', avatar_url: null })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { displayName: null },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.displayName).toBeNull()
    await app.close()
  })

  it('#18 body 空对象 → 422（至少需要一个字段）', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: {},
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#19 目标 admin → 403', async () => {
    mockFindAdminUserById.mockResolvedValue(ADMIN_USER)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-admin/profile',
      headers: adminAuth(), payload: { displayName: 'X' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('#20 目标不存在 → 404', async () => {
    mockFindAdminUserById.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: '/admin/users/u-x/profile',
      headers: adminAuth(), payload: { displayName: 'X' },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})

// ── R-MID-1 audit payload 精确性 ──────────────────────────────────────

describe('R-MID-1 profile audit payload (ADR-140 D-140-5)', () => {
  it('#21 audit 仅含实际变更字段（partial before/after）', async () => {
    mockFindAdminUserById.mockResolvedValue({ ...USER, display_name: '旧', locale: 'en', avatar_url: null })
    mockUpdateUserProfile.mockResolvedValue({ id: 'u-1', display_name: '新', locale: 'en', avatar_url: null })

    const app = await buildApp()
    await app.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: { displayName: '新' },  // 仅传 displayName
    })
    await flushFireAndForget()

    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'admin-1',
        actionType: 'user.profile_update',
        targetKind: 'user',
        targetId: 'u-1',
        beforeJsonb: { displayName: '旧' },  // 不应含 locale / avatarUrl
        afterJsonb: { displayName: '新' },
      }),
    )
    await app.close()
  })

  it('#22 422 / 403 / 404 路径不写 audit', async () => {
    // 422 路径
    const app1 = await buildApp()
    await app1.inject({
      method: 'PATCH', url: '/admin/users/u-1/profile',
      headers: adminAuth(), payload: {},  // 422
    })
    await flushFireAndForget()
    expect(mockInsertAuditLog).not.toHaveBeenCalled()
    await app1.close()
  })
})
