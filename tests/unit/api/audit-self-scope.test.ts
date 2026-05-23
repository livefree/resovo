/**
 * tests/unit/api/audit-self-scope.test.ts —
 * ADR-142 / CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP 端点权限 + scope 单测
 *
 * 覆盖（ADR-142 §9 测试 surface，12 用例）：
 *   #1 moderator GET logs 不传 actorId → 200 + Service 收到 actorId = moderatorUserId
 *   #2 admin GET logs 不传 actorId → 200 + Service 收到 actorId undefined（全量）
 *   #3 admin GET logs?actorId=X → 200 + Service 收到 actorId = X（按 X 过滤）
 *   #4 moderator GET logs?actorId=<other-id> → 200 + Service 收到 actorId = moderatorUserId（强制覆盖）
 *   #5 moderator GET logs?actorId=<self-id> → 200 + 正常（覆盖结果相同）
 *   #6 moderator GET logs + actionType filter → Service 同时收到 actorId override + actionType
 *   #7 moderator GET logs/:id（自己的） → 200 + detail
 *   #8 moderator GET logs/:id（他人的） → 404 NOT_FOUND
 *   #9 moderator GET enums → 200 + actionTypes + targetKinds
 *   #10 moderator POST rollback → 403 FORBIDDEN
 *   #11 未认证 GET logs → 401
 *   #12 user 角色 GET logs → 403
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

const listAdminAuditLogsMock = vi.fn()
const getAdminAuditLogDetailMock = vi.fn()
const getAdminAuditEnumsMock = vi.fn()
vi.mock('@/api/services/AuditLogService', async () => {
  const actual = await vi.importActual<typeof import('@/api/services/AuditLogService')>('@/api/services/AuditLogService')
  return {
    ...actual,
    AuditLogService: class {
      listAdminAuditLogs = (params: unknown) => listAdminAuditLogsMock(params)
      getAdminAuditLogDetail = (id: string) => getAdminAuditLogDetailMock(id)
      getAdminAuditEnums = () => getAdminAuditEnumsMock()
    },
  }
})

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  listAdminAuditLogsMock.mockReset().mockResolvedValue({ rows: [], total: 0, page: 1, limit: 20 })
  getAdminAuditLogDetailMock.mockReset()
  getAdminAuditEnumsMock.mockReset().mockReturnValue({ actionTypes: ['video.approve'], targetKinds: ['video'] })
})

async function buildApp() {
  const { adminAuditRoutes } = await import('@/api/routes/admin/audit')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminAuditRoutes)
  await app.ready()
  return app
}

function auth(role: 'admin' | 'moderator' | 'user', userId: string = `${role}-1`) {
  mockVerify.mockReturnValue({ userId, role, iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

// 真 UUID 格式（ListAdminAuditLogsSchema actorId 校验需要）
const MOD_USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222'

describe('GET /admin/audit/logs — self-scope (ADR-142 D-142-2/3)', () => {
  it('#1 moderator 不传 actorId → Service 收到 actorId = moderatorUserId', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: '/admin/audit/logs',
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(listAdminAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: MOD_USER_ID }))
    await app.close()
  })

  it('#2 admin 不传 actorId → Service 收到 actorId undefined（全量）', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: '/admin/audit/logs',
      headers: auth('admin'),
    })
    const callArgs = listAdminAuditLogsMock.mock.calls[0][0]
    expect(callArgs.actorId).toBeUndefined()
    await app.close()
  })

  it('#3 admin?actorId=X → Service 收到 actorId = X', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: `/admin/audit/logs?actorId=${OTHER_USER_ID}`,
      headers: auth('admin'),
    })
    expect(listAdminAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: OTHER_USER_ID }))
    await app.close()
  })

  it('#4 moderator?actorId=<other> → Service 收到 actorId = moderatorUserId（强制覆盖）', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: `/admin/audit/logs?actorId=${OTHER_USER_ID}`,
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(listAdminAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: MOD_USER_ID }))
    // 验证 OTHER_USER_ID 被覆盖（不在 params 内）
    const callArgs = listAdminAuditLogsMock.mock.calls[0][0]
    expect(callArgs.actorId).not.toBe(OTHER_USER_ID)
    await app.close()
  })

  it('#5 moderator?actorId=<self> → 正常（覆盖结果相同）', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: `/admin/audit/logs?actorId=${MOD_USER_ID}`,
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(listAdminAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: MOD_USER_ID }))
    await app.close()
  })

  it('#6 moderator + actionType filter → Service 同时收到 actorId override + actionType', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'GET', url: '/admin/audit/logs?actionType=video.approve',
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(listAdminAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({
      actorId: MOD_USER_ID,
      actionType: 'video.approve',
    }))
    await app.close()
  })
})

describe('GET /admin/audit/logs/:id — self-scope detail (ADR-142 D-142-2)', () => {
  it('#7 moderator detail（自己的条目）→ 200 + detail', async () => {
    getAdminAuditLogDetailMock.mockResolvedValue({
      id: '100', actorId: MOD_USER_ID, actionType: 'video.approve', targetKind: 'video',
      targetId: 'v-1', beforeJsonb: null, afterJsonb: null,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/audit/logs/100',
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.actorId).toBe(MOD_USER_ID)
    await app.close()
  })

  it('#8 moderator detail（他人条目）→ 404 NOT_FOUND（防枚举）', async () => {
    getAdminAuditLogDetailMock.mockResolvedValue({
      id: '101', actorId: OTHER_USER_ID, actionType: 'video.approve', targetKind: 'video',
      targetId: 'v-1', beforeJsonb: null, afterJsonb: null,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/audit/logs/101',
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
    await app.close()
  })
})

describe('GET /admin/audit/enums — moderator 开放 (ADR-142 D-142-2)', () => {
  it('#9 moderator GET enums → 200 + actionTypes + targetKinds', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/audit/enums',
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.actionTypes).toContain('video.approve')
    expect(body.data.targetKinds).toContain('video')
    await app.close()
  })
})

describe('POST /admin/audit/logs/:id/rollback — admin only 不变 (ADR-138 D-138-2)', () => {
  it('#10 moderator POST rollback → 403 FORBIDDEN', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/100/rollback',
      headers: auth('moderator', MOD_USER_ID),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

describe('权限边界 (ADR-142 D-142-2)', () => {
  it('#11 未认证 GET logs → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/audit/logs' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('#12 user 角色 GET logs → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/audit/logs',
      headers: auth('user'),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
