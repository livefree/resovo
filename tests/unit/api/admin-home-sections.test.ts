/**
 * admin-home-sections.test.ts — Home Curation 门面端点 #2/#3
 * （CHG-HOME-PREVIEW-API-A / ADR-182 D-182-4）
 *
 * 覆盖：
 *   - GET  /admin/home/sections           7 区块枚举序 + 摘要字段（快照 null / frontendWired）
 *   - PATCH /admin/home/sections/:section/settings
 *       happy path / 非法 section 422 / 空 body 422 / unknown key 422（.strict()）/
 *       settings 行缺失 404 / audit R-MID-1 内容断言 / 鉴权 401
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'
import type { HomeSectionSettings } from '@resovo/types'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))

const mockList = vi.fn()
const mockFind = vi.fn()
const mockUpdate = vi.fn()
const mockCountPinned = vi.fn()

vi.mock('@/api/db/queries/home-section-settings', () => ({
  listHomeSectionSettings: (...args: unknown[]) => mockList(...args),
  findHomeSectionSettings: (...args: unknown[]) => mockFind(...args),
  updateHomeSectionSettings: (...args: unknown[]) => mockUpdate(...args),
  countPinnedBySection: (...args: unknown[]) => mockCountPinned(...args),
}))

const mockAuditWrite = vi.fn()
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: class {
    write = mockAuditWrite
  },
}))

// ── Fixtures ───────────────────────────────────────────────────────────────

function settingsRow(section: HomeSectionSettings['section'], over: Partial<HomeSectionSettings> = {}): HomeSectionSettings {
  return {
    id: `s-${section}`,
    section,
    autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60,
    displayCount: 10,
    allowDuplicates: false,
    pinnedLimit: null,
    settings: {},
    updatedAt: '2026-06-06T00:00:00Z',
    ...over,
  }
}

const ALL_SECTIONS = ['banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime'] as const

async function buildApp() {
  const { adminHomeRoutes } = await import('@/api/routes/admin/home')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminHomeRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function adminToken() {
  return `Bearer ${await signAccessToken({ userId: 'u-admin', role: 'admin' })}`
}

// ── GET /admin/home/sections ───────────────────────────────────────────────

describe('GET /admin/home/sections', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    // DB 字典序返回（hot_anime 在前）——断言 Service 重排为枚举序
    mockList.mockResolvedValue([...ALL_SECTIONS].sort().map((s) => settingsRow(s)))
    mockCountPinned.mockResolvedValue({ banner: 3, featured: 4 })
    app = await buildApp()
  })

  it('200 + 7 区块按 HOME_SECTION_KEYS 枚举序（非 DB 字典序）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as Array<{ settings: { section: string } }>
    expect(data.map((d) => d.settings.section)).toEqual([...ALL_SECTIONS])
  })

  it('摘要字段：pinnedCount 取计数（缺省 0）/ 快照字段恒 null（ADR-183 前）/ type_shortcuts frontendWired=false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections',
      headers: { authorization: await adminToken() },
    })
    const data = res.json().data as Array<{
      settings: { section: string }
      pinnedCount: number
      lastSnapshotAt: string | null
      candidateCount: number | null
      frontendWired: boolean
    }>
    const byKey = new Map(data.map((d) => [d.settings.section, d]))
    expect(byKey.get('banner')?.pinnedCount).toBe(3)
    expect(byKey.get('top10')?.pinnedCount).toBe(0)
    expect(byKey.get('featured')?.lastSnapshotAt).toBeNull()
    expect(byKey.get('featured')?.candidateCount).toBeNull()
    expect(byKey.get('type_shortcuts')?.frontendWired).toBe(false)
    expect(byKey.get('featured')?.frontendWired).toBe(true)
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/home/sections' })
    expect(res.statusCode).toBe(401)
  })
})

// ── PATCH /admin/home/sections/:section/settings ───────────────────────────

describe('PATCH /admin/home/sections/:section/settings', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue(settingsRow('featured'))
    mockUpdate.mockResolvedValue(settingsRow('featured', { displayCount: 8 }))
    app = await buildApp()
  })

  it('部分更新成功返回 200 + data', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home/sections/featured/settings',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ displayCount: 8 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.displayCount).toBe(8)
    expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), 'featured', expect.objectContaining({ displayCount: 8 }))
  })

  it('audit R-MID-1 内容断言：actionType/targetKind/targetId=settings 行 id + before/after', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home/sections/featured/settings',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ displayCount: 8 }),
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_section.settings_update',
      targetKind: 'home_section',
      targetId: 's-featured',
      beforeJsonb: expect.objectContaining({ displayCount: 10 }),
      afterJsonb: expect.objectContaining({ displayCount: 8 }),
    }))
  })

  it('非法 section 枚举外值返回 422（先于 404 判定，D-182-4 #9）', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home/sections/not_a_section/settings',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ displayCount: 8 }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('空 body 返回 422（≥1 字段）', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home/sections/featured/settings',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.message).toContain('至少一字段')
  })

  it('unknown key 返回 422（.strict()）', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home/sections/featured/settings',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ nonsenseKey: 1 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('settings 行缺失（迁移漂移兜底）返回 404', async () => {
    mockFind.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home/sections/featured/settings',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ displayCount: 8 }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('refreshIntervalMinutes 可显式置 null（停用自动重算）', async () => {
    mockUpdate.mockResolvedValue(settingsRow('featured', { refreshIntervalMinutes: null }))
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/home/sections/featured/settings',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ refreshIntervalMinutes: null }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.refreshIntervalMinutes).toBeNull()
  })
})
