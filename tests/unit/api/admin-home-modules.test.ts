/**
 * admin-home-modules.test.ts — CHG-SN-5-05
 *
 * 覆盖：
 *   - GET  /admin/home-modules        happy path + 参数验证
 *   - POST /admin/home-modules        happy path + 业务规则校验 + audit log
 *   - PATCH /admin/home-modules/:id   happy path + NOT_FOUND + enabled 禁止 + audit log
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))

const mockListAdmin = vi.fn()
const mockFindById = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockReorder = vi.fn()

vi.mock('@/api/db/queries/home-modules', () => ({
  listAdminHomeModules: (...args: unknown[]) => mockListAdmin(...args),
  findHomeModuleById: (...args: unknown[]) => mockFindById(...args),
  createHomeModule: (...args: unknown[]) => mockCreate(...args),
  updateHomeModule: (...args: unknown[]) => mockUpdate(...args),
  deleteHomeModule: (...args: unknown[]) => mockDelete(...args),
  reorderHomeModules: (...args: unknown[]) => mockReorder(...args),
}))

const mockAuditWrite = vi.fn()
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: class {
    write = mockAuditWrite
  },
}))

// ── Test Fixtures ──────────────────────────────────────────────────────────

const MODULE = {
  id: 'a0000000-0000-0000-0000-000000000001',
  slot: 'featured' as const,
  brandScope: 'all-brands' as const,
  brandSlug: null,
  ordering: 0,
  contentRefType: 'video' as const,
  contentRefId: 'vid-001',
  startAt: null,
  endAt: null,
  enabled: true,
  metadata: {},
  createdAt: '2026-05-12T00:00:00Z',
  updatedAt: '2026-05-12T00:00:00Z',
}

async function buildApp() {
  const { adminHomeModulesRoutes } = await import('@/api/routes/admin/home-modules')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminHomeModulesRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function adminToken() {
  return `Bearer ${await signAccessToken({ userId: 'u-admin', role: 'admin' })}`
}

// ── GET /admin/home-modules ────────────────────────────────────────────────

describe('GET /admin/home-modules', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockListAdmin.mockResolvedValue({ rows: [MODULE], total: 1 })
    app = await buildApp()
  })

  it('返回分页列表 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('slot 过滤参数传入 query 层', async () => {
    await app.inject({
      method: 'GET',
      url: '/v1/admin/home-modules?slot=featured&enabled=true',
      headers: { authorization: await adminToken() },
    })
    expect(mockListAdmin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slot: 'featured', enabled: true }),
    )
  })

  it('invalid slot 返回 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home-modules?slot=invalid',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('未认证返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/home-modules' })
    expect(res.statusCode).toBe(401)
  })
})

// ── POST /admin/home-modules ───────────────────────────────────────────────

describe('POST /admin/home-modules', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue(MODULE)
    app = await buildApp()
  })

  it('创建成功返回 201 + data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'featured',
        brandScope: 'all-brands',
        contentRefType: 'video',
        contentRefId: 'vid-001',
      }),
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.id).toBe(MODULE.id)
  })

  it('audit log fire-and-forget 调用一次', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'featured',
        brandScope: 'all-brands',
        contentRefType: 'video',
        contentRefId: 'vid-001',
      }),
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_module.create',
      targetKind: 'home_module',
      targetId: MODULE.id,
    }))
  })

  it('brand-specific 无 brandSlug 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'featured',
        brandScope: 'brand-specific',
        contentRefType: 'video',
        contentRefId: 'vid-001',
      }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(res.json().error.message).toContain('brand-specific')
  })

  it('all-brands 有 brandSlug 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'featured',
        brandScope: 'all-brands',
        brandSlug: 'alpha',
        contentRefType: 'video',
        contentRefId: 'vid-001',
      }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toContain('all-brands')
  })

  it('startAt >= endAt 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'featured',
        brandScope: 'all-brands',
        contentRefType: 'video',
        contentRefId: 'vid-001',
        startAt: '2026-06-01T00:00:00Z',
        endAt: '2026-05-01T00:00:00Z',
      }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toContain('startAt')
  })

  it('slot × contentRefType 不兼容返回 422（type_shortcuts + video）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'type_shortcuts',
        brandScope: 'all-brands',
        contentRefType: 'video',
        contentRefId: 'vid-001',
      }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toContain('slot × contentRefType')
  })

  // ── ADR-181 D-181-4（migration 094）：hot slot × video compat ─────────────

  it.each(['hot_movies', 'hot_series', 'hot_anime'] as const)(
    'hot slot 创建成功返回 201（%s + video，ADR-181）',
    async (slot) => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/home-modules',
        headers: { authorization: await adminToken(), 'content-type': 'application/json' },
        body: JSON.stringify({
          slot,
          brandScope: 'all-brands',
          contentRefType: 'video',
          contentRefId: 'vid-001',
        }),
      })
      expect(res.statusCode).toBe(201)
    },
  )

  it.each(['external_url', 'custom_html', 'video_type'] as const)(
    'hot slot 仅允许 video：hot_movies + %s 返回 422（ADR-181 compat 第 3 处同源规则）',
    async (contentRefType) => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/home-modules',
        headers: { authorization: await adminToken(), 'content-type': 'application/json' },
        body: JSON.stringify({
          slot: 'hot_movies',
          brandScope: 'all-brands',
          contentRefType,
          contentRefId: contentRefType === 'video_type' ? 'movie' : 'https://x.example.com',
        }),
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().error.message).toContain('slot × contentRefType')
    },
  )

  // ── CHG-HOME-UX-01-B（ADR-104 AMENDMENT D-104-9）title / imageUrl ─────────

  it('title / imageUrl 透传到 query 层；缺省时 title={} / imageUrl=null', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'banner',
        brandScope: 'all-brands',
        contentRefType: 'external_url',
        contentRefId: 'https://promo.example.com',
        title: { 'zh-CN': '暑期专题', en: 'Summer' },
        imageUrl: 'https://cdn.example.com/b.jpg',
      }),
    })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: { 'zh-CN': '暑期专题', en: 'Summer' },
        imageUrl: 'https://cdn.example.com/b.jpg',
      }),
    )

    // 缺省分支：default({}) / ?? null
    mockCreate.mockClear()
    await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'featured',
        brandScope: 'all-brands',
        contentRefType: 'video',
        contentRefId: 'vid-001',
      }),
    })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: {}, imageUrl: null }),
    )
  })

  it('imageUrl 非法 URL 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'banner',
        brandScope: 'all-brands',
        contentRefType: 'external_url',
        contentRefId: 'https://promo.example.com',
        imageUrl: 'not-a-url',
      }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('title 值非 string 返回 422（z.record(z.string()) 收紧）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        slot: 'banner',
        brandScope: 'all-brands',
        contentRefType: 'external_url',
        contentRefId: 'https://promo.example.com',
        title: { 'zh-CN': 123 },
      }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })
})

// ── PATCH /admin/home-modules/:id ─────────────────────────────────────────

describe('PATCH /admin/home-modules/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

    beforeEach(async () => {
    vi.clearAllMocks()
    mockFindById.mockResolvedValue(MODULE)
    mockUpdate.mockResolvedValue({ ...MODULE, ordering: 5 })
    app = await buildApp()
  })

  it('部分更新成功返回 200 + data', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/home-modules/${MODULE.id}`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ ordering: 5 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.ordering).toBe(5)
  })

  it('audit log fire-and-forget 调用一次（update）', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/v1/admin/home-modules/${MODULE.id}`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ ordering: 5 }),
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_module.update',
      targetKind: 'home_module',
      targetId: MODULE.id,
    }))
  })

  it('id 不存在返回 404', async () => {
    mockFindById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home-modules/nonexistent-id',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ ordering: 1 }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('body 含 enabled 返回 422（协议层禁止，走 publish-toggle）', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/home-modules/${MODULE.id}`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('publish-toggle')
  })

  it('空 body 返回 422（至少一字段）', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/home-modules/${MODULE.id}`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toContain('至少一字段')
  })

  // ── CHG-HOME-UX-01-B：title / imageUrl 进 PATCH 白名单（.strict() 不误拒）──

  it('PATCH title / imageUrl 通过 .strict() 白名单并透传 query 层', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/home-modules/${MODULE.id}`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ title: { en: 'Summer' }, imageUrl: null }),
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      MODULE.id,
      expect.objectContaining({ title: { en: 'Summer' }, imageUrl: null }),
    )
  })
})

// ── DELETE /admin/home-modules/:id ────────────────────────────────────────

describe('DELETE /admin/home-modules/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('删除成功返回 204', async () => {
    mockFindById.mockResolvedValue(MODULE)
    mockDelete.mockResolvedValue(true)
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/home-modules/${MODULE.id}`,
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })

  it('audit log fire-and-forget 调用一次（delete）', async () => {
    mockFindById.mockResolvedValue(MODULE)
    mockDelete.mockResolvedValue(true)
    await app.inject({
      method: 'DELETE',
      url: `/v1/admin/home-modules/${MODULE.id}`,
      headers: { authorization: await adminToken() },
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_module.delete',
      targetKind: 'home_module',
      targetId: MODULE.id,
      afterJsonb: null,
    }))
  })

  it('id 不存在返回 404', async () => {
    mockFindById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/admin/home-modules/nonexistent-id',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })
})

// ── POST /admin/home-modules/reorder ──────────────────────────────────────

describe('POST /admin/home-modules/reorder', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockReorder.mockResolvedValue(2)
    // R-MID-1 修复：reorder 先并发读 oldOrdering，默认 mock 返回原模块（与 newOrdering 不同）
    mockFindById.mockResolvedValue(MODULE)
    app = await buildApp()
  })

  it('批量排序成功返回 200 + { updated }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules/reorder',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: 'a0000000-0000-0000-0000-000000000001', ordering: 0 },
          { id: 'a0000000-0000-0000-0000-000000000002', ordering: 1 },
        ],
      }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ updated: 2 })
  })

  it('audit log fire-and-forget 调用一次（reorder）', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules/reorder',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: 'a0000000-0000-0000-0000-000000000001', ordering: 0 }],
      }),
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_module.reorder',
      targetKind: 'home_module',
      targetId: null,
    }))
  })

  // R-MID-1 修复（中期审计 2026-05-12）：ADR-104 §audit log 协议表第 4 行
  // beforeJsonb 必须含 oldOrdering（DB 原值）/ afterJsonb 必须含 newOrdering（入参）
  it('audit log beforeJsonb 含 oldOrdering / afterJsonb 含 newOrdering（R-MID-1）', async () => {
    // 模拟 DB 原值 ordering=10（与入参 newOrdering=0/1 不同）
    mockFindById.mockResolvedValue({ ...MODULE, ordering: 10 })

    await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules/reorder',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: 'a0000000-0000-0000-0000-000000000001', ordering: 0 },
          { id: 'a0000000-0000-0000-0000-000000000002', ordering: 1 },
        ],
      }),
    })

    const auditCall = mockAuditWrite.mock.calls[0]?.[0]
    expect(auditCall).toBeDefined()
    // beforeJsonb.items[*].ordering === oldOrdering（10，DB 原值，mock 返回）
    expect(auditCall.beforeJsonb).toEqual({
      items: [
        { id: MODULE.id, ordering: 10 },
        { id: MODULE.id, ordering: 10 },
      ],
    })
    // afterJsonb.items[*].ordering === newOrdering（入参）
    expect(auditCall.afterJsonb).toEqual({
      items: [
        { id: 'a0000000-0000-0000-0000-000000000001', ordering: 0 },
        { id: 'a0000000-0000-0000-0000-000000000002', ordering: 1 },
      ],
    })
    // 关键：beforeJsonb !== afterJsonb（修复前两者等价，是 R-MID-1 缺陷信号）
    expect(auditCall.beforeJsonb).not.toEqual(auditCall.afterJsonb)
  })

  it('audit log 跳过不存在的 id（findById 返回 null 不进 beforeItems）', async () => {
    // 第 1 条 id 返回原模块（ordering=5），第 2 条 id 返回 null（已被删除 / 不存在）
    mockFindById
      .mockResolvedValueOnce({ ...MODULE, ordering: 5 })
      .mockResolvedValueOnce(null)

    await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules/reorder',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: 'a0000000-0000-0000-0000-000000000001', ordering: 0 },
          { id: 'a0000000-0000-0000-0000-000000000099', ordering: 1 },
        ],
      }),
    })

    const auditCall = mockAuditWrite.mock.calls[0]?.[0]
    // beforeJsonb 仅含找到的那条（与 reorderHomeModules 静默忽略行为一致）
    expect(auditCall.beforeJsonb).toEqual({
      items: [{ id: MODULE.id, ordering: 5 }],
    })
    // afterJsonb 含全部入参 items（无论是否找到 oldOrdering）
    expect(auditCall.afterJsonb.items).toHaveLength(2)
  })

  it('空 items 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules/reorder',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('items 超 200 返回 422', async () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      id: `a0000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      ordering: i,
    }))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules/reorder',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    expect(res.statusCode).toBe(422)
  })
})

// ── POST /admin/home-modules/:id/publish-toggle ───────────────────────────

describe('POST /admin/home-modules/:id/publish-toggle', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindById.mockResolvedValue(MODULE)
    mockUpdate.mockResolvedValue({ ...MODULE, enabled: false })
    app = await buildApp()
  })

  it('切换 enabled 成功返回 200 + data（含新 enabled 值）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/home-modules/${MODULE.id}/publish-toggle`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.enabled).toBe(false)
  })

  it('audit log fire-and-forget 调用一次（publish_toggle）', async () => {
    await app.inject({
      method: 'POST',
      url: `/v1/admin/home-modules/${MODULE.id}/publish-toggle`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_module.publish_toggle',
      targetKind: 'home_module',
      targetId: MODULE.id,
      beforeJsonb: { enabled: true },
      afterJsonb: { enabled: false },
    }))
  })

  it('id 不存在返回 404', async () => {
    mockFindById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home-modules/nonexistent-id/publish-toggle',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('body 缺少 enabled 字段返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/home-modules/${MODULE.id}/publish-toggle`,
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })
})
