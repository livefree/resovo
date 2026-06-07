/**
 * tests/unit/api/home-shelf.test.ts — 公开 hot shelf 聚合（ADR-184 / CHG-HOME-FE-CONSUME-A）
 *
 * 覆盖：
 *   1. buildHomeShelves 投影（合成顺序 pinned→快照 auto→趋势兜底 / 阻断 flags / empty /
 *      非 video 卡 / missing_image 放行 / 读时复核丢弃不回填 / snapshotAt 透传 / rank 连续）
 *   2. HomeService.shelf() 缓存（命中跳过合成 / miss 一次填三键 / brand 隔离 / 缺行防御）
 *   3. 路由层 GET /home/shelf（200 / 422 枚举外 / 422 缺参）
 *   4. cache key builder（Phase 4 失效接口位守护，D-184-5.2）
 *
 * fetchAutoFill 快照接线的 admin preview 侧断言见 admin-home-sections.test.ts。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── hoisted mock fns ──────────────────────────────────────────────────────────

const {
  mockRedisGet,
  mockRedisSetex,
  mockListSettings,
  mockListAllBanners,
  mockListAdminModules,
  mockFindLatestSnapshot,
  mockTrending,
  mockByRating,
  mockCardsByIds,
} = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSetex: vi.fn(),
  mockListSettings: vi.fn(),
  mockListAllBanners: vi.fn(),
  mockListAdminModules: vi.fn(),
  mockFindLatestSnapshot: vi.fn(),
  mockTrending: vi.fn(),
  mockByRating: vi.fn(),
  mockCardsByIds: vi.fn(),
}))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: mockRedisGet, setex: mockRedisSetex },
}))
vi.mock('@/api/db/queries/home-section-settings', () => ({
  listHomeSectionSettings: mockListSettings,
}))
vi.mock('@/api/db/queries/home-banners', () => ({
  listAllBanners: mockListAllBanners,
}))
vi.mock('@/api/db/queries/home-modules', () => ({
  listAdminHomeModules: mockListAdminModules,
  listActiveHomeModules: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/db/queries/home-autofill-snapshots', () => ({
  findLatestHomeAutofillSnapshot: mockFindLatestSnapshot,
}))
vi.mock('@/api/db/queries/videos', () => ({
  listTrendingVideos: mockTrending,
  listVideosByRatingDesc: mockByRating,
  listVideoCardsByIds: mockCardsByIds,
}))
vi.mock('@/api/db/queries/videos.status', () => ({
  listVideosByRatingDesc: mockByRating,
  listVideoCardsByIds: mockCardsByIds,
}))

// ── 静态导入（vi.mock 已 hoisted）─────────────────────────────────────────────

import Fastify from 'fastify'
import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import type {
  AutofillCandidate,
  HomeAutofillSnapshot,
  HomeModule,
  HomeSectionKey,
  HomeSectionSettings,
  HomeShelfResponse,
  VideoCard,
} from '@resovo/types'
import { HOME_SECTION_KEYS } from '@resovo/types'
import {
  buildHomeShelves,
  buildHomeShelfCacheKey,
  HOME_SHELF_CACHE_PREFIX,
} from '@/api/services/home-curation.shelf'
import { HomeService } from '@/api/services/HomeService'
import { homeRoutes } from '@/api/routes/home'

// ── 测试数据工厂 ──────────────────────────────────────────────────────────────

function settingsRow(section: HomeSectionKey, over: Partial<HomeSectionSettings> = {}): HomeSectionSettings {
  return {
    id: `s-${section}`,
    section,
    autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60,
    displayCount: 3,
    allowDuplicates: false,
    pinnedLimit: null,
    settings: {},
    updatedAt: '2026-06-06T00:00:00Z',
    ...over,
  }
}

function moduleRow(over: Partial<HomeModule> = {}): HomeModule {
  return {
    id: 'm-1',
    slot: 'hot_movies',
    brandScope: 'all-brands',
    brandSlug: null,
    ordering: 0,
    contentRefType: 'video',
    contentRefId: 'v-pin1',
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

function makeCandidate(id: string, videoId: string, over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id,
    videoId,
    videoSummary: {
      title: `候选 ${videoId}`,
      slug: `slug-${videoId}`,
      coverUrl: `https://cdn.example.com/${videoId}.jpg`,
      type: 'movie',
      year: 2026,
      rating: 8.0,
      sourceCount: 2,
    },
    score: 0.9,
    rank: 1,
    origin: 'douban',
    filtered: false,
    ...over,
  }
}

function makeSnapshot(section: HomeSectionKey, candidates: AutofillCandidate[]): HomeAutofillSnapshot {
  return {
    id: `snap-${section}`,
    section,
    generatedAt: '2026-06-06T12:00:00Z',
    trigger: 'scheduled',
    policyVersion: 'v1',
    settingsSnapshot: {},
    candidates,
    gaps: [],
    createdAt: '2026-06-06T12:00:00Z',
  }
}

const mockDb = {} as unknown as Pool
const mockRedis = { get: mockRedisGet, setex: mockRedisSetex } as unknown as Redis

beforeEach(() => {
  vi.clearAllMocks()
  mockRedisGet.mockResolvedValue(null)
  mockRedisSetex.mockResolvedValue('OK')
  mockListSettings.mockResolvedValue([...HOME_SECTION_KEYS].map((s) => settingsRow(s)))
  mockListAllBanners.mockResolvedValue({ rows: [], total: 0 })
  mockListAdminModules.mockResolvedValue({ rows: [], total: 0 })
  mockFindLatestSnapshot.mockResolvedValue(null)
  mockTrending.mockResolvedValue([])
  mockByRating.mockResolvedValue([])
  // 默认：请求什么 id 给什么卡（读时复核全通过）
  mockCardsByIds.mockImplementation((_db: unknown, ids: string[]) =>
    Promise.resolve(ids.map((id) => videoCard(id))),
  )
})

// ═════════════════════════════════════════════════════════════════════════════
// buildHomeShelves() — 投影
// ═════════════════════════════════════════════════════════════════════════════

describe('buildHomeShelves()', () => {
  it('合成顺序：pinned 头部 → 快照 auto → rank 连续 + snapshotAt 透传（D-184-3/4）', async () => {
    mockListAdminModules.mockResolvedValue({ rows: [moduleRow()], total: 1 })
    mockFindLatestSnapshot.mockImplementation((_db: unknown, section: HomeSectionKey) =>
      Promise.resolve(
        section === 'hot_movies'
          ? makeSnapshot('hot_movies', [
              makeCandidate('c1', 'v-d1', { score: 0.91, rank: 1 }),
              makeCandidate('c2', 'v-d2', { filtered: true, filterReason: 'not_published' }),
              makeCandidate('c3', 'v-d3', { score: 0.85, rank: 3, origin: 'bangumi' }),
            ])
          : null,
      ),
    )

    const shelves = await buildHomeShelves(mockDb, null)
    const hotMovies = shelves.get('hot_movies')!

    // displayCount=3：pinned 1 + 快照 auto 2（filtered=true 的 c2 不消费——入口筛选）
    expect(hotMovies.items.map((i) => i.video.id)).toEqual(['v-pin1', 'v-d1', 'v-d3'])
    expect(hotMovies.items.map((i) => i.isPinned)).toEqual([true, false, false])
    expect(hotMovies.items.map((i) => i.rank)).toEqual([1, 2, 3])
    expect(hotMovies.snapshotAt).toBe('2026-06-06T12:00:00Z')
    // 其余 hot section 未读到快照 → snapshotAt null（纯趋势兜底语义）
    expect(shelves.get('hot_series')!.snapshotAt).toBeNull()
    // 非 shelf section 不出现在投影结果
    expect([...shelves.keys()].sort()).toEqual(['hot_anime', 'hot_movies', 'hot_series'])
  })

  it('投影过滤：阻断 flags（disabled/unplayable）与 empty 丢弃；missing_image 放行（D-184-3.2）', async () => {
    mockListAdminModules.mockResolvedValue({
      rows: [
        // disabled pinned → 阻断
        moduleRow({ id: 'm-dis', slot: 'hot_series', contentRefId: 'v-dis', enabled: false }),
        // 非 video 引用 → videoId null 跳过
        moduleRow({ id: 'm-vt', slot: 'hot_series', contentRefType: 'video_type', contentRefId: 'movie' }),
      ],
      total: 2,
    })
    // 趋势兜底：v-t1 正常；v-t2 无图（missing_image 放行）；v-t3 无可播源（unplayable 阻断）
    mockTrending.mockImplementation((_db: unknown, filters: { type?: string }) =>
      Promise.resolve(
        filters.type === 'series'
          ? [videoCard('v-t1'), videoCard('v-t2', { coverUrl: null }), videoCard('v-t3', { sourceCount: 0 })]
          : [],
      ),
    )
    mockCardsByIds.mockImplementation((_db: unknown, ids: string[]) =>
      Promise.resolve(ids.map((id) => videoCard(id, id === 'v-t2' ? { coverUrl: null } : {}))),
    )

    const shelves = await buildHomeShelves(mockDb, null)
    const hotSeries = shelves.get('hot_series')!

    // disabled pinned / video_type 卡 / unplayable 趋势卡 / empty 占位全部不入 items
    expect(hotSeries.items.map((i) => i.video.id)).toEqual(['v-t1', 'v-t2'])
    expect(hotSeries.items.map((i) => i.rank)).toEqual([1, 2])
  })

  it('读时复核丢弃不回填：合成通过但投影复核失败的卡被剔除（D-184-3.3 / 4.5）', async () => {
    // hot_anime 趋势返回 v-t8/v-t9；读时 listVideoCardsByIds 不返回 v-t9（已下线语义）
    mockTrending.mockImplementation((_db: unknown, filters: { type?: string }) =>
      Promise.resolve(filters.type === 'anime' ? [videoCard('v-t8'), videoCard('v-t9')] : []),
    )
    mockCardsByIds.mockImplementation((_db: unknown, ids: string[]) =>
      Promise.resolve(ids.filter((id) => id !== 'v-t9').map((id) => videoCard(id))),
    )

    const shelves = await buildHomeShelves(mockDb, null)
    const hotAnime = shelves.get('hot_anime')!

    // v-t9 丢弃且不回填（items < displayCount 合法）
    expect(hotAnime.items.map((i) => i.video.id)).toEqual(['v-t8'])
    expect(hotAnime.items).toHaveLength(1)
  })

  it('快照候选读时复核失败 → 丢弃并由趋势兜底（filtered 仅入口筛选，D-184-4.5）', async () => {
    mockFindLatestSnapshot.mockImplementation((_db: unknown, section: HomeSectionKey) =>
      Promise.resolve(
        section === 'hot_movies'
          ? makeSnapshot('hot_movies', [makeCandidate('c1', 'v-dead', { filtered: false })])
          : null,
      ),
    )
    // v-dead 读时不可见（listVideoCardsByIds 不返回）
    mockCardsByIds.mockImplementation((_db: unknown, ids: string[]) =>
      Promise.resolve(ids.filter((id) => id !== 'v-dead').map((id) => videoCard(id))),
    )
    mockTrending.mockImplementation((_db: unknown, filters: { type?: string }) =>
      Promise.resolve(filters.type === 'movie' ? [videoCard('v-fb1')] : []),
    )

    const shelves = await buildHomeShelves(mockDb, null)
    const hotMovies = shelves.get('hot_movies')!

    expect(hotMovies.items.map((i) => i.video.id)).toEqual(['v-fb1'])
    // 读到快照即回填 snapshotAt（无论候选最终通过几个，D-184-3.5）
    expect(hotMovies.snapshotAt).toBe('2026-06-06T12:00:00Z')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HomeService.shelf() — 缓存门面
// ═════════════════════════════════════════════════════════════════════════════

describe('HomeService.shelf()', () => {
  it('缓存命中：直接返回，不触发合成（D-184-5.1）', async () => {
    const cached: HomeShelfResponse = { items: [], snapshotAt: null, generatedAt: '2026-06-06T12:00:00Z' }
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cached))

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.shelf('hot_movies', null)

    expect(result.generatedAt).toBe('2026-06-06T12:00:00Z')
    expect(mockListSettings).not.toHaveBeenCalled()
    expect(mockRedisSetex).not.toHaveBeenCalled()
  })

  it('缓存 miss：一次合成填三键（TTL 60，同 brand 命名空间，D-184-5.4）', async () => {
    const svc = new HomeService(mockDb, mockRedis)
    await svc.shelf('hot_movies', null)

    expect(mockListSettings).toHaveBeenCalledTimes(1)
    const keys = mockRedisSetex.mock.calls.map((c) => c[0] as string).sort()
    expect(keys).toEqual([
      'home:shelf:hot_anime:b:none',
      'home:shelf:hot_movies:b:none',
      'home:shelf:hot_series:b:none',
    ])
    for (const call of mockRedisSetex.mock.calls) expect(call[1]).toBe(60)
  })

  it('brand 隔离：brand_slug=alpha 读写 b:alpha 命名空间（D-184-5.4 硬约束）', async () => {
    const svc = new HomeService(mockDb, mockRedis)
    await svc.shelf('hot_series', 'alpha')

    expect(mockRedisGet).toHaveBeenCalledWith('home:shelf:hot_series:b:alpha')
    const keys = mockRedisSetex.mock.calls.map((c) => c[0] as string)
    expect(keys).toHaveLength(3)
    for (const key of keys) expect(key.endsWith(':b:alpha')).toBe(true)
  })

  it('settings 缺行防御：该 section 未入合成 → 空 shelf（迁移漂移兜底）', async () => {
    mockListSettings.mockResolvedValue(
      [...HOME_SECTION_KEYS].filter((s) => s !== 'hot_series').map((s) => settingsRow(s)),
    )

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.shelf('hot_series', null)

    expect(result.items).toEqual([])
    expect(result.snapshotAt).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 路由层 GET /home/shelf
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /home/shelf', () => {
  async function buildApp() {
    const app = Fastify({ logger: false })
    await app.register(homeRoutes)
    await app.ready()
    return app
  }

  it('200 + HomeShelfResponse 信封', async () => {
    mockTrending.mockImplementation((_db: unknown, filters: { type?: string }) =>
      Promise.resolve(filters.type === 'movie' ? [videoCard('v-t1')] : []),
    )
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/home/shelf?section=hot_movies' })

    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.items[0].video.id).toBe('v-t1')
    expect(data.items[0].isPinned).toBe(false)
    expect(data.items[0].rank).toBe(1)
    expect(data.snapshotAt).toBeNull()
    expect(data.generatedAt).toBeTruthy()
  })

  it('section 枚举外值（含非 shelf 的合法 section）→ 422', async () => {
    const app = await buildApp()
    for (const bad of ['banner', 'top10', 'featured', 'unknown']) {
      const res = await app.inject({ method: 'GET', url: `/home/shelf?section=${bad}` })
      expect(res.statusCode).toBe(422)
      expect(res.json().error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('缺 section → 422', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/home/shelf' })
    expect(res.statusCode).toBe(422)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 缓存 key builder（Phase 4 失效接口位守护，D-184-5.2）
// ═════════════════════════════════════════════════════════════════════════════

describe('buildHomeShelfCacheKey()', () => {
  it('key 形状 = home:shelf:{section}:b:{brand|none}（CACHE_PREFIXES.home 命名空间）', () => {
    expect(HOME_SHELF_CACHE_PREFIX).toBe('home:shelf:')
    expect(buildHomeShelfCacheKey('hot_movies', null)).toBe('home:shelf:hot_movies:b:none')
    expect(buildHomeShelfCacheKey('hot_anime', 'alpha')).toBe('home:shelf:hot_anime:b:alpha')
  })
})
