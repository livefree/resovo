/**
 * admin-home-sections.test.ts — Home Curation 门面端点 #2/#3
 * （CHG-HOME-PREVIEW-API-A / ADR-182 D-182-4）
 *
 * 覆盖：
 *   - GET  /admin/home/sections           7 区块枚举序 + 摘要字段（快照接入 / frontendWired）
 *   - PATCH /admin/home/sections/:section/settings
 *       happy path / 非法 section 422 / 空 body 422 / unknown key 422（.strict()）/
 *       settings 行缺失 404 / audit R-MID-1 内容断言 / 鉴权 401
 *   - GET  /admin/home/sections/:section/autofill-candidates（#4，CHG-HOME-AUTOFILL-CORE-B）
 *       未生成 null 语义 / include_filtered + gaps additive / limit / 422 / 404
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

// CHG-HOME-AUTOFILL-CORE-B：快照表 queries（端点 #4 + #2 摘要接入）
const mockSnapshotSummaries = vi.fn()
const mockFindLatestSnapshot = vi.fn()

vi.mock('@/api/db/queries/home-autofill-snapshots', () => ({
  listLatestSnapshotSummaries: (...args: unknown[]) => mockSnapshotSummaries(...args),
  findLatestHomeAutofillSnapshot: (...args: unknown[]) => mockFindLatestSnapshot(...args),
}))

// CHG-HOME-AUTOFILL-REFRESH：端点 #7 队列交互（429 主动检查 + 幂等键入队）
const mockQueueAdd = vi.fn()
const mockQueueGetJob = vi.fn()

vi.mock('@/api/lib/queue', () => ({
  homeAutofillQueue: {
    add: (...args: unknown[]) => mockQueueAdd(...args),
    getJob: (...args: unknown[]) => mockQueueGetJob(...args),
  },
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
    mockSnapshotSummaries.mockResolvedValue({})
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

  it('摘要字段：pinnedCount 取计数（缺省 0）/ 快照未生成 null / type_shortcuts frontendWired=false', async () => {
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

  it('快照摘要接入（CHG-HOME-AUTOFILL-CORE-B）：有快照的 section 填 lastSnapshotAt/candidateCount，与 #4 snapshotAt 同源语义', async () => {
    mockSnapshotSummaries.mockResolvedValue({
      hot_movies: { generatedAt: '2026-06-06T10:00:00Z', candidateCount: 12 },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections',
      headers: { authorization: await adminToken() },
    })
    const data = res.json().data as Array<{
      settings: { section: string }
      lastSnapshotAt: string | null
      candidateCount: number | null
    }>
    const byKey = new Map(data.map((d) => [d.settings.section, d]))
    expect(byKey.get('hot_movies')?.lastSnapshotAt).toBe('2026-06-06T10:00:00Z')
    expect(byKey.get('hot_movies')?.candidateCount).toBe(12)
    expect(byKey.get('hot_series')?.lastSnapshotAt).toBeNull()
    expect(byKey.get('hot_series')?.candidateCount).toBeNull()
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

// ── GET /admin/home/sections/:section/autofill-candidates（CHG-HOME-AUTOFILL-CORE-B / D-182-4 #4）──

import type { AutofillCandidate, ContentGap, HomeAutofillSnapshot } from '@resovo/types'

function candidateRow(id: string, over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id,
    videoId: `v-${id}`,
    videoSummary: {
      title: `视频 ${id}`, slug: `slug-${id}`, coverUrl: null,
      type: 'movie', year: 2026, rating: 8.1, sourceCount: 2,
    },
    score: 0.8,
    rank: 1,
    origin: 'douban',
    filtered: false,
    ...over,
  }
}

function snapshotRow(over: Partial<HomeAutofillSnapshot> = {}): HomeAutofillSnapshot {
  return {
    id: 'snap-1',
    section: 'hot_movies',
    generatedAt: '2026-06-06T10:00:00Z',
    trigger: 'scheduled',
    policyVersion: 'hp-v1',
    settingsSnapshot: {},
    candidates: [],
    gaps: [],
    createdAt: '2026-06-06T10:00:00Z',
    ...over,
  }
}

describe('GET /admin/home/sections/:section/autofill-candidates', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  const gap: ContentGap = {
    provider: 'douban', externalId: 'db-9', title: '未映射条目', score: 0.7, mediaTypeHint: 'movie',
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue(settingsRow('hot_movies'))
    mockFindLatestSnapshot.mockResolvedValue(snapshotRow({
      candidates: [
        candidateRow('c1', { rank: 1, score: 0.9 }),
        candidateRow('c2', { rank: 2, score: 0.8, filtered: true, filterReason: 'no_playable_source' }),
        candidateRow('c3', { rank: 3, score: 0.7 }),
      ],
      gaps: [gap],
    }))
    app = await buildApp()
  })

  it('默认（不含 filtered）：200 + 仅未过滤候选 + snapshotAt/policyVersion 顶层，无 gaps 键', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/hot_movies/autofill-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect((body.data as AutofillCandidate[]).map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(body.snapshotAt).toBe('2026-06-06T10:00:00Z')
    expect(body.policyVersion).toBe('hp-v1')
    expect('gaps' in body).toBe(false)
  })

  it('include_filtered=true：含 filtered 条目（带 filterReason）+ gaps additive（D-183-7.3）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/hot_movies/autofill-candidates?include_filtered=true',
      headers: { authorization: await adminToken() },
    })
    const body = res.json()
    expect((body.data as AutofillCandidate[]).map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
    expect((body.data as AutofillCandidate[])[1]?.filterReason).toBe('no_playable_source')
    expect(body.gaps).toEqual([gap])
  })

  it('include_filtered=false 字符串按 false 语义（z.coerce.boolean 陷阱防护）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/hot_movies/autofill-candidates?include_filtered=false',
      headers: { authorization: await adminToken() },
    })
    const body = res.json()
    expect((body.data as AutofillCandidate[]).map((c) => c.id)).toEqual(['c1', 'c3'])
    expect('gaps' in body).toBe(false)
  })

  it('limit 截断（过滤后切片）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/hot_movies/autofill-candidates?limit=1',
      headers: { authorization: await adminToken() },
    })
    expect((res.json().data as AutofillCandidate[]).map((c) => c.id)).toEqual(['c1'])
  })

  it('limit 越界（0 / 101）返回 422', async () => {
    for (const limit of [0, 101]) {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/admin/home/sections/hot_movies/autofill-candidates?limit=${limit}`,
        headers: { authorization: await adminToken() },
      })
      expect(res.statusCode).toBe(422)
    }
  })

  it('快照未生成：200 空数组 + snapshotAt/policyVersion null（非 404，D-182-4.4）', async () => {
    mockFindLatestSnapshot.mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/hot_movies/autofill-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toEqual([])
    expect(body.snapshotAt).toBeNull()
    expect(body.policyVersion).toBeNull()
    expect('gaps' in body).toBe(false)
  })

  it('非法 section 枚举外值返回 422（先于 404 判定，D-182-4 #9）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/not_a_section/autofill-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(422)
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('settings 行缺失（迁移漂移兜底）返回 404', async () => {
    mockFind.mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/hot_movies/autofill-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(404)
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/home/sections/hot_movies/autofill-candidates',
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── POST /admin/home/sections/:section/refresh-candidates（CHG-HOME-AUTOFILL-REFRESH / D-182-4 #7）──

describe('POST /admin/home/sections/:section/refresh-candidates', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue(settingsRow('hot_movies', { autofillMode: 'full_auto' }))
    mockQueueGetJob.mockResolvedValue(null)
    mockQueueAdd.mockResolvedValue({})
    app = await buildApp()
  })

  it('202 + enqueued + 固定 jobId 幂等键 + removeOnComplete/removeOnFail true（D-183-3.3 释放前提）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/hot_movies/refresh-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().data).toEqual({ enqueued: true })
    expect(mockQueueAdd).toHaveBeenCalledWith(
      { kind: 'recalculate', section: 'hot_movies', trigger: 'manual' },
      { jobId: 'autofill:hot_movies', removeOnComplete: true, removeOnFail: true },
    )
  })

  it('audit R-MID-1 内容断言：home_section.refresh_candidates 轻量载荷 { section, enqueuedAt }（D-182-4.7）', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/hot_movies/refresh-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_section.refresh_candidates',
      targetKind: 'home_section',
      targetId: 's-hot_movies',
      beforeJsonb: null,
      afterJsonb: { section: 'hot_movies', enqueuedAt: expect.any(String) },
    }))
  })

  it('同 section 进行中 job → 429 RATE_LIMITED（主动 getJob+getState 检查，不依赖 add 去重副作用）', async () => {
    for (const state of ['active', 'waiting', 'delayed']) {
      mockQueueGetJob.mockResolvedValue({ getState: async () => state })
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/home/sections/hot_movies/refresh-candidates',
        headers: { authorization: await adminToken() },
      })
      expect(res.statusCode).toBe(429)
      expect(res.json().error.code).toBe('RATE_LIMITED')
    }
    expect(mockQueueAdd).not.toHaveBeenCalled()
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })

  it('残留 completed/failed 态 job 不阻塞重入', async () => {
    mockQueueGetJob.mockResolvedValue({ getState: async () => 'completed' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/hot_movies/refresh-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(202)
    expect(mockQueueAdd).toHaveBeenCalledOnce()
  })

  it('manual_only section → 422（无候选可算，D-182-4.7）+ 不入队不记审计', async () => {
    mockFind.mockResolvedValue(settingsRow('type_shortcuts', { autofillMode: 'manual_only' }))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/type_shortcuts/refresh-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(422)
    expect(mockQueueAdd).not.toHaveBeenCalled()
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })

  it('入队失败异常上抛 → 500 不静默（D-183-3.6）+ 不记审计', async () => {
    mockQueueAdd.mockRejectedValue(new Error('redis down'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/hot_movies/refresh-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(res.statusCode).toBe(500)
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })

  it('非法 section 422（先于 404）/ settings 缺行 404 / 未登录 401', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/not_a_section/refresh-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(bad.statusCode).toBe(422)

    mockFind.mockResolvedValue(null)
    const missing = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/hot_movies/refresh-candidates',
      headers: { authorization: await adminToken() },
    })
    expect(missing.statusCode).toBe(404)

    const anon = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/hot_movies/refresh-candidates',
    })
    expect(anon.statusCode).toBe(401)
  })
})

// ── GET /admin/home/preview（CHG-HOME-PREVIEW-API-B / D-182-4 #1）────────────

import type { Banner, HomeModule, VideoCard } from '@resovo/types'

const mockListAllBanners = vi.fn()
const mockListAdminModules = vi.fn()
const mockTrending = vi.fn()
const mockByRating = vi.fn()
const mockCardsByIds = vi.fn()
// CHG-HOME-CARD-DND-A：端点 #6 reorder 门面依赖
const mockFindBanner = vi.fn()
const mockUpdateBannerSorts = vi.fn()
const mockFindModule = vi.fn()
const mockReorderModules = vi.fn()

vi.mock('@/api/db/queries/home-banners', () => ({
  listAllBanners: (...args: unknown[]) => mockListAllBanners(...args),
  findBannerById: (...args: unknown[]) => mockFindBanner(...args),
  updateBannerSortOrders: (...args: unknown[]) => mockUpdateBannerSorts(...args),
}))
vi.mock('@/api/db/queries/home-modules', () => ({
  listAdminHomeModules: (...args: unknown[]) => mockListAdminModules(...args),
  findHomeModuleById: (...args: unknown[]) => mockFindModule(...args),
  reorderHomeModules: (...args: unknown[]) => mockReorderModules(...args),
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

// ── POST /admin/home/sections/:section/reorder（CHG-HOME-CARD-DND-A / D-182-4 #6）──

describe('POST /admin/home/sections/:section/reorder', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  const UUID_A = '11111111-1111-4111-8111-111111111111'
  const UUID_B = '22222222-2222-4222-8222-222222222222'

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue(settingsRow('featured', { id: 's-featured' }))
    mockFindModule.mockImplementation((_db: unknown, id: string) =>
      Promise.resolve(moduleRow({ id, slot: 'featured', ordering: id === UUID_A ? 0 : 1 })))
    mockReorderModules.mockResolvedValue(2)
    mockFindBanner.mockImplementation((_db: unknown, id: string) =>
      Promise.resolve(bannerRow({ id, sortOrder: id === UUID_A ? 0 : 1 })))
    mockUpdateBannerSorts.mockResolvedValue(2)
    app = await buildApp()
  })

  function inject(section: string, body: unknown, token: string) {
    return app.inject({
      method: 'POST',
      url: `/v1/admin/home/sections/${section}/reorder`,
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const SWAP = { items: [{ id: UUID_A, ordering: 1 }, { id: UUID_B, ordering: 0 }] }

  it('featured：真源分派 home_modules（直调 reorderHomeModules）→ 200 { updated }', async () => {
    const res = await inject('featured', SWAP, await adminToken())
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(2)
    expect(mockReorderModules).toHaveBeenCalledWith(expect.anything(), SWAP.items)
    expect(mockUpdateBannerSorts).not.toHaveBeenCalled()
  })

  it('banner：真源分派 home_banners（ordering→sortOrder 映射）→ 200 { updated }', async () => {
    mockFind.mockResolvedValue(settingsRow('banner', { id: 's-banner' }))
    const res = await inject('banner', SWAP, await adminToken())
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(2)
    expect(mockUpdateBannerSorts).toHaveBeenCalledWith(expect.anything(), [
      { id: UUID_A, sortOrder: 1 },
      { id: UUID_B, sortOrder: 0 },
    ])
    expect(mockReorderModules).not.toHaveBeenCalled()
  })

  it('audit R-MID-1 内容断言（home_modules 分支）：D-182-4.6 载荷硬约束 + before 取 DB 原值', async () => {
    await inject('featured', SWAP, await adminToken())
    expect(mockAuditWrite).toHaveBeenCalledOnce() // 不嵌套触发 home_module.reorder（D-182-4.6）
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_section.reorder',
      targetKind: 'home_section',
      targetId: 's-featured', // D-182-5.3：锚定 settings 行 id
      beforeJsonb: {
        sectionKey: 'featured',
        source: 'home_modules',
        items: [{ id: UUID_A, ordering: 0 }, { id: UUID_B, ordering: 1 }], // DB 原值
      },
      afterJsonb: {
        sectionKey: 'featured',
        source: 'home_modules',
        ids: [UUID_A, UUID_B],
        items: SWAP.items,
      },
    }))
  })

  it('audit 内容断言（home_banners 分支）：source 真源标识 + before 取 sortOrder 原值', async () => {
    mockFind.mockResolvedValue(settingsRow('banner', { id: 's-banner' }))
    await inject('banner', SWAP, await adminToken())
    expect(mockAuditWrite).toHaveBeenCalledOnce()
    expect(mockAuditWrite).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'home_section.reorder',
      targetId: 's-banner',
      beforeJsonb: expect.objectContaining({
        sectionKey: 'banner',
        source: 'home_banners',
        items: [{ id: UUID_A, ordering: 0 }, { id: UUID_B, ordering: 1 }],
      }),
      afterJsonb: expect.objectContaining({ source: 'home_banners', ids: [UUID_A, UUID_B] }),
    }))
  })

  it('id 的 slot 不属于该 section（featured 传 top10 行）→ 422 且不写库不写 audit', async () => {
    mockFindModule.mockResolvedValue(moduleRow({ id: UUID_A, slot: 'top10' }))
    const res = await inject('featured', { items: [{ id: UUID_A, ordering: 0 }] }, await adminToken())
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockReorderModules).not.toHaveBeenCalled()
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })

  it('id 不存在于真源 → 422（banner section 传 home_modules id 同口径）', async () => {
    mockFind.mockResolvedValue(settingsRow('banner', { id: 's-banner' }))
    mockFindBanner.mockResolvedValue(null) // 冻结存量 home_modules banner 行不属 home_banners 真源
    const res = await inject('banner', { items: [{ id: UUID_A, ordering: 0 }] }, await adminToken())
    expect(res.statusCode).toBe(422)
    expect(mockUpdateBannerSorts).not.toHaveBeenCalled()
    expect(mockAuditWrite).not.toHaveBeenCalled()
  })

  it('非法 section 枚举外值 → 422（先于 404 判定，D-182-4 #9）', async () => {
    const res = await inject('not_a_section', SWAP, await adminToken())
    expect(res.statusCode).toBe(422)
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('body 校验：空 items / 超 200 项 / 非 uuid id → 422', async () => {
    const token = await adminToken()
    expect((await inject('featured', { items: [] }, token)).statusCode).toBe(422)
    expect((await inject('featured', {
      items: Array.from({ length: 201 }, (_, i) => ({ id: UUID_A, ordering: i })),
    }, token)).statusCode).toBe(422)
    expect((await inject('featured', { items: [{ id: 'not-uuid', ordering: 0 }] }, token)).statusCode).toBe(422)
    expect(mockReorderModules).not.toHaveBeenCalled()
  })

  it('settings 行缺失（迁移漂移兜底）→ 404', async () => {
    mockFind.mockResolvedValue(null)
    const res = await inject('featured', SWAP, await adminToken())
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/home/sections/featured/reorder',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(SWAP),
    })
    expect(res.statusCode).toBe(401)
  })
})
