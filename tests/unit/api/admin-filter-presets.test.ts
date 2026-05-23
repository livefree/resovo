/**
 * tests/unit/api/admin-filter-presets.test.ts —
 * ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-A 端点单测
 *
 * 覆盖（ADR-144 §7 测试 surface，18 用例）：
 *   CRUD happy:
 *     #1 POST 创建 private preset
 *     #2 POST 创建 shared preset
 *     #3 GET list 返回 own + 他人 shared
 *     #4 PATCH 更新 name
 *     #5 DELETE 删除 own preset
 *   scope filter:
 *     #6 GET ?scope=shared 仅返回 shared
 *     #7 GET ?tab=pending 仅返回 pending tab
 *   is_default 互斥:
 *     #8 POST isDefault=true 清同 owner+tab 旧 default
 *     #9 PATCH isDefault=true 清同 owner+tab 旧 default
 *     #10 并发 23505 → 409 STATE_CONFLICT
 *   跨 owner 权限:
 *     #11 moderator PATCH 他人 → 403
 *     #12 moderator DELETE 他人 → 403
 *     #13 admin DELETE 他人 shared → 204
 *     #14 admin DELETE 他人 private → 403
 *   shared 跨 role:
 *     #15 moderator B 可读 moderator A 的 shared
 *   R-MID-1 audit:
 *     #16 POST 后 audit 有 filter_preset.create + after_jsonb 含 name/scope/tab/queryKeys
 *   422 validation:
 *     #17 POST body name 超 100 字符
 *     #18 POST body tab 非法值
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

vi.mock('@/api/db/queries/filterPresets', () => ({
  listFilterPresets: vi.fn(),
  findFilterPresetById: vi.fn(),
  insertFilterPreset: vi.fn(),
  updateFilterPreset: vi.fn(),
  clearDefaultForOwnerTab: vi.fn().mockResolvedValue(undefined),
  deleteFilterPreset: vi.fn(),
}))

vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as q from '@/api/db/queries/filterPresets'
import * as auditLogQueries from '@/api/db/queries/auditLog'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockList = q.listFilterPresets as ReturnType<typeof vi.fn>
const mockFindById = q.findFilterPresetById as ReturnType<typeof vi.fn>
const mockInsert = q.insertFilterPreset as ReturnType<typeof vi.fn>
const mockUpdate = q.updateFilterPreset as ReturnType<typeof vi.fn>
const mockClearDefault = q.clearDefaultForOwnerTab as ReturnType<typeof vi.fn>
const mockDelete = q.deleteFilterPreset as ReturnType<typeof vi.fn>
const mockInsertAuditLog = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

const MODERATOR_A = '11111111-1111-4111-8111-111111111111'
const MODERATOR_B = '22222222-2222-4222-8222-222222222222'
const ADMIN_ID    = '33333333-3333-4333-8333-333333333333'
const PRESET_ID_A = '44444444-4444-4444-8444-444444444444'
const PRESET_ID_B = '55555555-5555-4555-8555-555555555555'

beforeEach(() => {
  vi.clearAllMocks()
  mockClearDefault.mockResolvedValue(undefined)
})

async function buildApp() {
  const { adminFilterPresetRoutes } = await import('@/api/routes/admin/filter-presets')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminFilterPresetRoutes)
  await app.ready()
  return app
}

function moderatorAuth(id = MODERATOR_A) {
  mockVerify.mockReturnValue({ userId: id, role: 'moderator', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: ADMIN_ID, role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRESET_ID_A,
    owner_user_id: MODERATOR_A,
    owner_username: 'alice',
    name: 'my preset',
    scope: 'private',
    tab: 'pending',
    query_jsonb: { type: 'movie' },
    is_default: false,
    created_at: '2026-05-22T10:00:00.000Z',
    updated_at: '2026-05-22T10:00:00.000Z',
    ...overrides,
  }
}

async function flush() {
  await new Promise((r) => setImmediate(r))
}

// ── CRUD happy ──────────────────────────────────────────────────

describe('POST /admin/filter-presets (ADR-144)', () => {
  it('#1 happy path 创建 private preset', async () => {
    const row = makeRow()
    mockInsert.mockResolvedValueOnce(row)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/filter-presets',
      headers: moderatorAuth(),
      payload: { name: 'my preset', tab: 'pending', query: { type: 'movie' } },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data).toMatchObject({ id: PRESET_ID_A, scope: 'private', tab: 'pending' })
    await app.close()
  })

  it('#2 happy path 创建 shared preset', async () => {
    const row = makeRow({ scope: 'shared' })
    mockInsert.mockResolvedValueOnce(row)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/filter-presets',
      headers: moderatorAuth(),
      payload: { name: 'team preset', scope: 'shared', tab: 'pending', query: {} },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.scope).toBe('shared')
    await app.close()
  })

  it('#16 audit filter_preset.create 含 name/scope/tab/queryKeys', async () => {
    const row = makeRow()
    mockInsert.mockResolvedValueOnce(row)
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/filter-presets',
      headers: moderatorAuth(),
      payload: { name: 'my preset', tab: 'pending', query: { type: 'movie', sourceCheckStatus: 'ok' } },
    })
    await flush()
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: MODERATOR_A,
        actionType: 'filter_preset.create',
        targetKind: 'filter_preset',
        targetId: PRESET_ID_A,
        beforeJsonb: null,
        afterJsonb: expect.objectContaining({
          id: PRESET_ID_A,
          name: 'my preset',
          scope: 'private',
          tab: 'pending',
          queryKeys: expect.arrayContaining(['type']),
        }),
      }),
    )
    await app.close()
  })
})

describe('GET /admin/filter-presets', () => {
  it('#3 list 返回 own + 他人 shared', async () => {
    mockList.mockResolvedValueOnce([
      makeRow(),
      makeRow({ id: PRESET_ID_B, owner_user_id: MODERATOR_B, owner_username: 'bob', scope: 'shared' }),
    ])
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/filter-presets',
      headers: moderatorAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(2)
    await app.close()
  })

  it('#6 ?scope=shared 仅 shared', async () => {
    mockList.mockResolvedValueOnce([makeRow({ scope: 'shared' })])
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/filter-presets?scope=shared', headers: moderatorAuth() })
    expect(res.statusCode).toBe(200)
    expect(mockList).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scope: 'shared' }))
    await app.close()
  })

  it('#7 ?tab=pending 仅 pending', async () => {
    mockList.mockResolvedValueOnce([makeRow({ tab: 'pending' })])
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/filter-presets?tab=pending', headers: moderatorAuth() })
    expect(res.statusCode).toBe(200)
    expect(mockList).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tab: 'pending' }))
    await app.close()
  })

  it('#15 moderator B 可读 moderator A 的 shared', async () => {
    mockList.mockResolvedValueOnce([
      makeRow({ owner_user_id: MODERATOR_A, scope: 'shared' }),
    ])
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/filter-presets', headers: moderatorAuth(MODERATOR_B) })
    expect(res.statusCode).toBe(200)
    expect(res.json().data[0].ownerUserId).toBe(MODERATOR_A)
    expect(res.json().data[0].scope).toBe('shared')
    await app.close()
  })
})

describe('PATCH /admin/filter-presets/:id', () => {
  it('#4 happy path 更新 name', async () => {
    mockFindById.mockResolvedValueOnce(makeRow())
    mockUpdate.mockResolvedValueOnce(makeRow({ name: 'updated' }))
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: `/admin/filter-presets/${PRESET_ID_A}`,
      headers: moderatorAuth(),
      payload: { name: 'updated' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.name).toBe('updated')
    await flush()
    // R-MID-1 第 22 次：filter_preset.update audit diff-only 内容断言
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: MODERATOR_A,
        actionType: 'filter_preset.update',
        targetKind: 'filter_preset',
        targetId: PRESET_ID_A,
        beforeJsonb: expect.objectContaining({ name: 'my preset' }),
        afterJsonb: expect.objectContaining({ name: 'updated' }),
      }),
    )
    await app.close()
  })

  it('#9 PATCH isDefault=true 清同 owner+tab 旧 default', async () => {
    mockFindById.mockResolvedValueOnce(makeRow())
    mockUpdate.mockResolvedValueOnce(makeRow({ is_default: true }))
    const app = await buildApp()
    await app.inject({
      method: 'PATCH', url: `/admin/filter-presets/${PRESET_ID_A}`,
      headers: moderatorAuth(),
      payload: { isDefault: true },
    })
    expect(mockClearDefault).toHaveBeenCalledWith(expect.anything(), MODERATOR_A, 'pending', PRESET_ID_A)
    await app.close()
  })

  it('#11 moderator PATCH 他人 → 403', async () => {
    mockFindById.mockResolvedValueOnce(makeRow({ owner_user_id: MODERATOR_B }))
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH', url: `/admin/filter-presets/${PRESET_ID_A}`,
      headers: moderatorAuth(MODERATOR_A),
      payload: { name: 'hack' },
    })
    expect(res.statusCode).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('DELETE /admin/filter-presets/:id', () => {
  it('#5 owner DELETE → 204', async () => {
    mockFindById.mockResolvedValueOnce(makeRow())
    mockDelete.mockResolvedValueOnce(true)
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: `/admin/filter-presets/${PRESET_ID_A}`,
      headers: moderatorAuth(MODERATOR_A),
    })
    expect(res.statusCode).toBe(204)
    await flush()
    // R-MID-1 第 23 次：filter_preset.delete audit 含 id/name/scope/tab before snapshot
    expect(mockInsertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: MODERATOR_A,
        actionType: 'filter_preset.delete',
        targetKind: 'filter_preset',
        targetId: PRESET_ID_A,
        beforeJsonb: expect.objectContaining({ id: PRESET_ID_A, name: 'my preset', scope: 'private', tab: 'pending' }),
        afterJsonb: null,
      }),
    )
    await app.close()
  })

  it('#12 moderator DELETE 他人 → 403', async () => {
    mockFindById.mockResolvedValueOnce(makeRow({ owner_user_id: MODERATOR_B }))
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: `/admin/filter-presets/${PRESET_ID_A}`,
      headers: moderatorAuth(MODERATOR_A),
    })
    expect(res.statusCode).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
    await app.close()
  })

  it('#13 admin DELETE 他人 shared → 204', async () => {
    mockFindById.mockResolvedValueOnce(makeRow({ owner_user_id: MODERATOR_A, scope: 'shared' }))
    mockDelete.mockResolvedValueOnce(true)
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: `/admin/filter-presets/${PRESET_ID_A}`,
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(204)
    await app.close()
  })

  it('#14 admin DELETE 他人 private → 403', async () => {
    mockFindById.mockResolvedValueOnce(makeRow({ owner_user_id: MODERATOR_A, scope: 'private' }))
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: `/admin/filter-presets/${PRESET_ID_A}`,
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

// ── is_default 互斥 ──────────────────────────────────────────────

describe('is_default 互斥（ADR-144 D-144-7）', () => {
  it('#8 POST isDefault=true 清同 owner+tab 旧 default', async () => {
    const row = makeRow({ is_default: true })
    mockInsert.mockResolvedValueOnce(row)
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/filter-presets',
      headers: moderatorAuth(),
      payload: { name: 'p', tab: 'pending', isDefault: true },
    })
    expect(mockClearDefault).toHaveBeenCalledWith(expect.anything(), MODERATOR_A, 'pending')
    await app.close()
  })

  it('#10 并发 23505 部分唯一索引违反 → 409 STATE_CONFLICT', async () => {
    const err = new Error('duplicate') as Error & { code?: string }
    err.code = '23505'
    mockInsert.mockRejectedValueOnce(err)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/filter-presets',
      headers: moderatorAuth(),
      payload: { name: 'p', tab: 'pending', isDefault: true },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('STATE_CONFLICT')
    await app.close()
  })
})

// ── 422 validation ──────────────────────────────────────────────

describe('422 validation', () => {
  it('#17 POST body name 超 100 字符 → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/filter-presets',
      headers: moderatorAuth(),
      payload: { name: 'a'.repeat(101), tab: 'pending' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('#18 POST body tab 非法值 → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/filter-presets',
      headers: moderatorAuth(),
      payload: { name: 'p', tab: 'invalid' },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })
})
