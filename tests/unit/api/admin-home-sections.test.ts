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

// ── GET /admin/home/preview（CHG-HOME-PREVIEW-API-B / D-182-4 #1）────────────

import type { Banner, HomeModule, VideoCard } from '@resovo/types'

const mockListAllBanners = vi.fn()
const mockListAdminModules = vi.fn()
const mockTrending = vi.fn()
const mockByRating = vi.fn()
const mockCardsByIds = vi.fn()

vi.mock('@/api/db/queries/home-banners', () => ({
  listAllBanners: (...args: unknown[]) => mockListAllBanners(...args),
}))
vi.mock('@/api/db/queries/home-modules', () => ({
  listAdminHomeModules: (...args: unknown[]) => mockListAdminModules(...args),
}))
vi.mock('@/api/db/queries/videos', () => ({
  listTrendingVideos: (...args: unknown[]) => mockTrending(...args),
}))
vi.mock('@/api/db/queries/videos.status', () => ({
  listVideosByRatingDesc: (...args: unknown[]) => mockByRating(...args),
  listVideoCardsByIds: (...args: unknown[]) => mockCardsByIds(...args),
}))

function bannerRow(over: Partial<Banner> = {}): Banner {
  return {
    id: 'bn-1',
    title: { 'zh-CN': '首屏横幅' },
    imageUrl: 'https://cdn.example.com/hero.jpg',
    linkType: 'external',
    linkTarget: 'https://promo.example.com',
    sortOrder: 0,
    activeFrom: null,
    activeTo: null,
    isActive: true,
    brandScope: 'all-brands',
    brandSlug: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

function moduleRow(over: Partial<HomeModule> = {}): HomeModule {
  return {
    id: 'm-1',
    slot: 'featured',
    brandScope: 'all-brands',
    brandSlug: null,
    ordering: 0,
    contentRefType: 'video',
    contentRefId: 'v-1',
    title: {},
    imageUrl: null,
    startAt: null,
    endAt: null,
    enabled: true,
    metadata: {},
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

function videoCard(id: string, over: Partial<VideoCard> = {}): VideoCard {
  return {
    id,
    shortId: `s-${id}`,
    slug: `slug-${id}`,
    title: `视频 ${id}`,
    titleEn: null,
    coverUrl: `https://cdn.example.com/${id}.jpg`,
    posterBlurhash: null,
    posterStatus: 'ok',
    type: 'movie',
    rating: 8.5,
    year: 2026,
    status: 'completed',
    episodeCount: 1,
    sourceCount: 2,
    subtitleLangs: [],
    ...over,
  } as VideoCard
}

describe('GET /admin/home/preview', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockList.mockResolvedValue([...ALL_SECTIONS].map((s) => settingsRow(s, { displayCount: 3 })))
    mockListAllBanners.mockResolvedValue({ rows: [bannerRow()], total: 1 })
    mockListAdminModules.mockResolvedValue({ rows: [moduleRow()], total: 1 })
    mockCardsByIds.mockResolvedValue([videoCard('v-1')])
    mockTrending.mockResolvedValue([videoCard('v-t1'), videoCard('v-t2'), videoCard('v-t3')])
    mockByRating.mockResolvedValue([videoCard('v-r1'), videoCard('v-r2')])
    app = await buildApp()
  })

  it('200 + 7 区块枚举序 + generatedAt/context 回显', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview?device=mobile&brand_slug=alpha',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.sections.map((s: { key: string }) => s.key)).toEqual([...ALL_SECTIONS])
    expect(data.generatedAt).toBeTruthy()
    expect(data.context).toEqual({ brandSlug: 'alpha', locale: null, at: null, device: 'mobile' })
  })

  it('banner section：D-181-3 DTO 映射（activeFrom→startAt / isActive→enabled）+ source=pinned', async () => {
    mockListAllBanners.mockResolvedValue({
      rows: [bannerRow({ activeFrom: '2026-07-01T00:00:00Z', isActive: true })],
      total: 1,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview',
      headers: { authorization: await adminToken() },
    })
    const banner = res.json().data.sections.find((s: { key: string }) => s.key === 'banner')
    const card = banner.cards[0]
    expect(card.source).toBe('pinned')
    expect(card.startAt).toBe('2026-07-01T00:00:00Z')
    expect(card.enabled).toBe(true)
    expect(card.flags).toContain('pending') // at=now < activeFrom
  })

  it('pinned video 引用失效 → ref_broken flag；无图 → missing_image', async () => {
    mockCardsByIds.mockResolvedValue([]) // v-1 已下线
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview',
      headers: { authorization: await adminToken() },
    })
    const featured = res.json().data.sections.find((s: { key: string }) => s.key === 'featured')
    const card = featured.cards[0]
    expect(card.flags).toContain('ref_broken')
    expect(card.flags).toContain('missing_image') // module.imageUrl null + 无 video 回退
  })

  it('跨区块去重：featured trending 补位占用后，hot_movies fallback 跳过已占用 videoId', async () => {
    // featured 与 hot_movies 共用 trending mock 返回（v-t1/v-t2/v-t3）
    mockListAdminModules.mockResolvedValue({ rows: [], total: 0 }) // 无 pinned
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview',
      headers: { authorization: await adminToken() },
    })
    const sections = res.json().data.sections
    const featured = sections.find((s: { key: string }) => s.key === 'featured')
    const hotMovies = sections.find((s: { key: string }) => s.key === 'hot_movies')
    const featuredIds = featured.cards.filter((c: { videoId: string | null }) => c.videoId).map((c: { videoId: string }) => c.videoId)
    const hotIds = hotMovies.cards.filter((c: { videoId: string | null }) => c.videoId).map((c: { videoId: string }) => c.videoId)
    // 渲染序 featured 先占用 → hot_movies 不得重复
    for (const id of hotIds) expect(featuredIds).not.toContain(id)
  })

  it('hot_* 补位 source=fallback + explain.origin=trending；top10 source=auto + origin=rating', async () => {
    mockListAdminModules.mockResolvedValue({ rows: [], total: 0 })
    // 按 type 返回独立候选集（避免渲染序在前的 featured 把单一集合全部占用）
    mockTrending.mockImplementation((_db: unknown, filters: { type?: string }) => {
      const prefix = filters.type ?? 'all'
      return Promise.resolve([videoCard(`v-${prefix}-1`), videoCard(`v-${prefix}-2`)])
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview',
      headers: { authorization: await adminToken() },
    })
    const sections = res.json().data.sections
    const top10 = sections.find((s: { key: string }) => s.key === 'top10')
    const hotAnime = sections.find((s: { key: string }) => s.key === 'hot_anime')
    const top10Auto = top10.cards.find((c: { source: string }) => c.source === 'auto')
    expect(top10Auto?.explain?.origin).toBe('rating')
    const hotFallback = hotAnime.cards.find((c: { source: string }) => c.source === 'fallback')
    expect(hotFallback?.explain?.origin).toBe('trending')
    // hot_anime 走 type=anime 候选池
    expect(mockTrending).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'anime' }))
  })

  it('type_shortcuts 不自动补位（manual_only 语义）+ 空位 empty 卡补足 displayCount', async () => {
    mockListAdminModules.mockResolvedValue({ rows: [], total: 0 })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview',
      headers: { authorization: await adminToken() },
    })
    const shortcuts = res.json().data.sections.find((s: { key: string }) => s.key === 'type_shortcuts')
    expect(shortcuts.cards).toHaveLength(3) // displayCount=3 全 empty
    expect(shortcuts.cards.every((c: { source: string }) => c.source === 'empty')).toBe(true)
  })

  it('at 参数模拟时间窗：未来 at 使 startAt 已到 → 无 pending flag', async () => {
    mockListAllBanners.mockResolvedValue({
      rows: [bannerRow({ activeFrom: '2026-07-01T00:00:00Z' })],
      total: 1,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview?at=2026-07-02T00:00:00Z',
      headers: { authorization: await adminToken() },
    })
    const banner = res.json().data.sections.find((s: { key: string }) => s.key === 'banner')
    expect(banner.cards[0].flags).not.toContain('pending')
  })

  it('非法 at 返回 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/preview?at=not-a-date',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(422)
  })
})
