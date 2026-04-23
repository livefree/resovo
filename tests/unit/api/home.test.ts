/**
 * tests/unit/api/home.test.ts — HANDOFF-04
 *
 * 覆盖：
 *   1. HomeService.topTen()  编排逻辑（缓存 / 置顶 / 补位 / rank / offline）
 *   2. HomeService.listActiveBySlot()  透传验证
 *   3. 路由层（Fastify inject）：GET /home/top10 / GET /home/modules / GET /videos/count-by-type
 *
 * DB 查询层测试见 home-queries.test.ts（不 mock query module，测实际 SQL 实现）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── hoisted mock fns ──────────────────────────────────────────────────────────

const {
  mockListActiveHomeModules,
  mockListVideoCardsByIds,
  mockListVideosByRatingDesc,
  mockCountVideosByType,
  mockRedisGet,
  mockRedisSetex,
} = vi.hoisted(() => ({
  mockListActiveHomeModules: vi.fn(),
  mockListVideoCardsByIds: vi.fn(),
  mockListVideosByRatingDesc: vi.fn(),
  mockCountVideosByType: vi.fn(),
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockRedisSetex: vi.fn().mockResolvedValue('OK'),
}))

vi.mock('@/api/db/queries/home-modules', () => ({
  listActiveHomeModules: mockListActiveHomeModules,
}))

vi.mock('@/api/db/queries/videos', () => ({
  listVideosByRatingDesc: mockListVideosByRatingDesc,
  listVideoCardsByIds: mockListVideoCardsByIds,
  countVideosByType: mockCountVideosByType,
  listVideos: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  listTrendingVideos: vi.fn().mockResolvedValue([]),
  findVideoByShortId: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn(), connect: vi.fn() },
}))

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    scan: vi.fn().mockResolvedValue(['0', []]),
  },
}))

vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

// ── 静态导入（vi.mock 已 hoisted，拿到 mock 版本） ────────────────────────────

import { HomeService } from '@/api/services/HomeService'
import Fastify from 'fastify'
import { homeRoutes } from '@/api/routes/home'
import { videoRoutes } from '@/api/routes/videos'
import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import type { VideoCard, HomeModuleSlot } from '@resovo/types'

// ── 共享测试数据工厂 ──────────────────────────────────────────────────────────

function makeVideoCard(id: string, rating = 8.0): VideoCard {
  return {
    id,
    shortId: id.slice(0, 8),
    slug: null,
    title: `video-${id}`,
    titleEn: null,
    coverUrl: null,
    type: 'movie',
    rating,
    year: 2024,
    status: 'completed',
    episodeCount: 1,
    sourceCount: 1,
    posterBlurhash: null,
    posterStatus: null,
    subtitleLangs: [],
  }
}

function makeTopModule(videoId: string, ordering: number) {
  return {
    id: `mod-${ordering}`,
    slot: 'top10' as HomeModuleSlot,
    brandScope: 'all-brands' as const,
    brandSlug: null,
    ordering,
    contentRefType: 'video' as const,
    contentRefId: videoId,
    startAt: null,
    endAt: null,
    enabled: true,
    metadata: {},
    createdAt: '2026-04-22T00:00:00Z',
    updatedAt: '2026-04-22T00:00:00Z',
  }
}

const ALL_VIDEO_TYPES = [
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
] as const

const mockRedis = {
  get: mockRedisGet,
  setex: mockRedisSetex,
} as unknown as Redis

const mockDb = { query: vi.fn(), connect: vi.fn() } as unknown as Pool

beforeEach(() => {
  vi.clearAllMocks()
  mockRedisGet.mockResolvedValue(null)
  mockRedisSetex.mockResolvedValue('OK')
})

// ── Fastify 构建函数 ──────────────────────────────────────────────────────────

async function buildHomeApp() {
  const app = Fastify({ logger: false })
  await app.register(homeRoutes)
  await app.ready()
  return app
}

async function buildVideoApp() {
  const app = Fastify({ logger: false })
  await app.register(videoRoutes)
  await app.ready()
  return app
}

// ═════════════════════════════════════════════════════════════════════════════
// HomeService.topTen()
// ═════════════════════════════════════════════════════════════════════════════

describe('HomeService.topTen()', () => {
  it('Redis 缓存命中时直接返回，DB 查询不被调用', async () => {
    const cached = { items: [], sortStrategy: 'manual_plus_rating' }
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cached))

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.topTen(null)

    expect(result.sortStrategy).toBe('manual_plus_rating')
    expect(mockListActiveHomeModules).not.toHaveBeenCalled()
    expect(mockListVideoCardsByIds).not.toHaveBeenCalled()
  })

  it('3 置顶 + 7 补位 = 10 items（核心场景）', async () => {
    const pinIds = ['p1-id', 'p2-id', 'p3-id']
    const pinCards = pinIds.map((id) => makeVideoCard(id, 9.0))
    const fillCards = Array.from({ length: 7 }, (_, i) => makeVideoCard(`fill-${i}`, 8.0))

    mockListActiveHomeModules.mockResolvedValueOnce(
      pinIds.map((id, i) => makeTopModule(id, i + 1)),
    )
    mockListVideoCardsByIds.mockResolvedValueOnce(pinCards)
    mockListVideosByRatingDesc.mockResolvedValueOnce(fillCards)

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.topTen(null)

    expect(result.items).toHaveLength(10)
    expect(result.items.filter((item) => item.isPinned)).toHaveLength(3)
    expect(result.items.filter((item) => !item.isPinned)).toHaveLength(7)
  })

  it('0 置顶：10 项全部来自 rating 补位', async () => {
    const fillCards = Array.from({ length: 10 }, (_, i) => makeVideoCard(`fill-${i}`, 8.0))
    mockListActiveHomeModules.mockResolvedValueOnce([])
    mockListVideoCardsByIds.mockResolvedValueOnce([])
    mockListVideosByRatingDesc.mockResolvedValueOnce(fillCards)

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.topTen(null)

    expect(result.items).toHaveLength(10)
    expect(result.items.every((item) => !item.isPinned)).toBe(true)
  })

  it('10 置顶满位：listVideosByRatingDesc 不被调用', async () => {
    const pinned = Array.from({ length: 10 }, (_, i) => makeVideoCard(`pin-${i}`, 9.0))
    mockListActiveHomeModules.mockResolvedValueOnce(
      pinned.map((v, i) => makeTopModule(v.id, i + 1)),
    )
    mockListVideoCardsByIds.mockResolvedValueOnce(pinned)

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.topTen(null)

    expect(result.items).toHaveLength(10)
    expect(mockListVideosByRatingDesc).not.toHaveBeenCalled()
    expect(result.items.every((item) => item.isPinned)).toBe(true)
  })

  it('置顶 video 已下线（listVideoCardsByIds 不返回）→ 自动丢弃，补位填充', async () => {
    const onlinePin = makeVideoCard('online-pin', 9.5)
    const offlinePinId = 'offline-pin-id'
    const fillCards = Array.from({ length: 9 }, (_, i) => makeVideoCard(`fill-${i}`, 8.0))

    mockListActiveHomeModules.mockResolvedValueOnce([
      makeTopModule(onlinePin.id, 1),
      makeTopModule(offlinePinId, 2),
    ])
    mockListVideoCardsByIds.mockResolvedValueOnce([onlinePin]) // offline 不在结果中
    mockListVideosByRatingDesc.mockResolvedValueOnce(fillCards)

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.topTen(null)

    expect(result.items).toHaveLength(10)
    expect(result.items[0].video.id).toBe(onlinePin.id)
    expect(result.items[0].isPinned).toBe(true)
    expect(result.items.slice(1).every((item) => !item.isPinned)).toBe(true)
  })

  it('rank 为 1-based，连续递增', async () => {
    const pinned = [makeVideoCard('pin1', 9.0)]
    const fillCards = Array.from({ length: 9 }, (_, i) => makeVideoCard(`fill-${i}`, 8.0))
    mockListActiveHomeModules.mockResolvedValueOnce([makeTopModule('pin1', 1)])
    mockListVideoCardsByIds.mockResolvedValueOnce(pinned)
    mockListVideosByRatingDesc.mockResolvedValueOnce(fillCards)

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.topTen(null)

    result.items.forEach((item, i) => {
      expect(item.rank).toBe(i + 1)
    })
  })

  it('sortStrategy 固定为 manual_plus_rating', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    mockListVideoCardsByIds.mockResolvedValueOnce([])
    mockListVideosByRatingDesc.mockResolvedValueOnce([])

    const svc = new HomeService(mockDb, mockRedis)
    const result = await svc.topTen(null)
    expect(result.sortStrategy).toBe('manual_plus_rating')
  })

  it('brandSlug=null → 缓存键为 home:top10:none', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    mockListVideoCardsByIds.mockResolvedValueOnce([])
    mockListVideosByRatingDesc.mockResolvedValueOnce([])

    const svc = new HomeService(mockDb, mockRedis)
    await svc.topTen(null)

    expect(mockRedisGet).toHaveBeenCalledWith('home:top10:none')
    expect(mockRedisSetex).toHaveBeenCalledWith('home:top10:none', 60, expect.any(String))
  })

  it('brandSlug="alpha" → 缓存键为 home:top10:b:alpha', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    mockListVideoCardsByIds.mockResolvedValueOnce([])
    mockListVideosByRatingDesc.mockResolvedValueOnce([])

    const svc = new HomeService(mockDb, mockRedis)
    await svc.topTen('alpha')

    expect(mockRedisGet).toHaveBeenCalledWith('home:top10:b:alpha')
    expect(mockRedisSetex).toHaveBeenCalledWith('home:top10:b:alpha', 60, expect.any(String))
  })

  it('listVideosByRatingDesc 收到已置顶 id 列表作为 excludeIds', async () => {
    const pinCards = ['pid-1', 'pid-2'].map((id) => makeVideoCard(id, 9.0))
    mockListActiveHomeModules.mockResolvedValueOnce(
      pinCards.map((v, i) => makeTopModule(v.id, i + 1)),
    )
    mockListVideoCardsByIds.mockResolvedValueOnce(pinCards)
    mockListVideosByRatingDesc.mockResolvedValueOnce([])

    const svc = new HomeService(mockDb, mockRedis)
    await svc.topTen(null)

    const [, , passedExcludeIds] = mockListVideosByRatingDesc.mock.calls[0]
    expect(passedExcludeIds).toEqual(expect.arrayContaining(['pid-1', 'pid-2']))
  })

  it('结果写入 Redis（setex TTL=60）', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    mockListVideoCardsByIds.mockResolvedValueOnce([])
    mockListVideosByRatingDesc.mockResolvedValueOnce([])

    const svc = new HomeService(mockDb, mockRedis)
    await svc.topTen(null)

    expect(mockRedisSetex).toHaveBeenCalledTimes(1)
    expect(mockRedisSetex.mock.calls[0][1]).toBe(60)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HomeService.listActiveBySlot()
// ═════════════════════════════════════════════════════════════════════════════

describe('HomeService.listActiveBySlot()', () => {
  it('透传 slot 和 brandSlug 给 listActiveHomeModules', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    const svc = new HomeService(mockDb, mockRedis)
    await svc.listActiveBySlot('featured', 'alpha')
    expect(mockListActiveHomeModules).toHaveBeenCalledWith(mockDb, 'featured', 'alpha')
  })

  it('brandSlug=null 时透传 null', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    const svc = new HomeService(mockDb, mockRedis)
    await svc.listActiveBySlot('banner', null)
    expect(mockListActiveHomeModules).toHaveBeenCalledWith(mockDb, 'banner', null)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 路由层：GET /home/top10
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /home/top10', () => {
  it('200 + { data: { items, sortStrategy } }', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    mockListVideoCardsByIds.mockResolvedValueOnce([])
    mockListVideosByRatingDesc.mockResolvedValueOnce([])

    const app = await buildHomeApp()
    const res = await app.inject({ method: 'GET', url: '/home/top10' })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { items: unknown[]; sortStrategy: string } }>()
    expect(Array.isArray(body.data.items)).toBe(true)
    expect(body.data.sortStrategy).toBe('manual_plus_rating')
  })

  it('brand_slug 参数传入时正常返回 200', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    mockListVideoCardsByIds.mockResolvedValueOnce([])
    mockListVideosByRatingDesc.mockResolvedValueOnce([])

    const app = await buildHomeApp()
    const res = await app.inject({ method: 'GET', url: '/home/top10?brand_slug=alpha' })
    expect(res.statusCode).toBe(200)
  })

  it('brand_slug 超过 64 字符时返回 422', async () => {
    const app = await buildHomeApp()
    const res = await app.inject({ method: 'GET', url: `/home/top10?brand_slug=${'a'.repeat(65)}` })
    expect(res.statusCode).toBe(422)
  })

  it('缓存命中时 listActiveHomeModules 不被调用', async () => {
    const cached = { items: [], sortStrategy: 'manual_plus_rating' }
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cached))

    const app = await buildHomeApp()
    const res = await app.inject({ method: 'GET', url: '/home/top10' })
    expect(res.statusCode).toBe(200)
    expect(mockListActiveHomeModules).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 路由层：GET /home/modules
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /home/modules', () => {
  it('200 + { data: [] }（空结果也正常）', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    const app = await buildHomeApp()
    const res = await app.inject({ method: 'GET', url: '/home/modules?slot=featured' })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: unknown[] }>()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('缺少 slot 时返回 422', async () => {
    const app = await buildHomeApp()
    const res = await app.inject({ method: 'GET', url: '/home/modules' })
    expect(res.statusCode).toBe(422)
  })

  it('slot 非法枚举值时返回 422', async () => {
    const app = await buildHomeApp()
    const res = await app.inject({ method: 'GET', url: '/home/modules?slot=invalid_slot' })
    expect(res.statusCode).toBe(422)
  })

  it('brand_slug 未传时 listActiveHomeModules 收到 null', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    const app = await buildHomeApp()
    await app.inject({ method: 'GET', url: '/home/modules?slot=top10' })
    expect(mockListActiveHomeModules).toHaveBeenCalledWith(expect.anything(), 'top10', null)
  })

  it('传入 brand_slug 时透传给 service', async () => {
    mockListActiveHomeModules.mockResolvedValueOnce([])
    const app = await buildHomeApp()
    await app.inject({ method: 'GET', url: '/home/modules?slot=banner&brand_slug=beta' })
    expect(mockListActiveHomeModules).toHaveBeenCalledWith(expect.anything(), 'banner', 'beta')
  })

  it('所有合法 slot 枚举值均返回 200', async () => {
    const slots: HomeModuleSlot[] = ['banner', 'featured', 'top10', 'type_shortcuts']
    const app = await buildHomeApp()
    for (const slot of slots) {
      mockListActiveHomeModules.mockResolvedValueOnce([])
      const res = await app.inject({ method: 'GET', url: `/home/modules?slot=${slot}` })
      expect(res.statusCode).toBe(200)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 路由层：GET /videos/count-by-type
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /videos/count-by-type', () => {
  it('200 + { data: CountByTypeItem[] }（11 种类型）', async () => {
    mockCountVideosByType.mockResolvedValueOnce(
      [...ALL_VIDEO_TYPES].map((type) => ({ type, count: type === 'movie' ? 100 : 0 })),
    )
    const app = await buildVideoApp()
    const res = await app.inject({ method: 'GET', url: '/videos/count-by-type' })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: Array<{ type: string; count: number }> }>()
    expect(body.data).toHaveLength(11)
    expect(body.data.find((r) => r.type === 'movie')?.count).toBe(100)
  })

  it('Redis 缓存命中时 countVideosByType 不被调用', async () => {
    const cached = [...ALL_VIDEO_TYPES].map((type) => ({ type, count: 5 }))
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cached))
    const app = await buildVideoApp()
    const res = await app.inject({ method: 'GET', url: '/videos/count-by-type' })
    expect(res.statusCode).toBe(200)
    expect(mockCountVideosByType).not.toHaveBeenCalled()
  })

  it('Redis miss 时调用 countVideosByType 并写缓存（TTL 300s）', async () => {
    mockRedisGet.mockResolvedValueOnce(null)
    mockCountVideosByType.mockResolvedValueOnce(
      [...ALL_VIDEO_TYPES].map((type) => ({ type, count: 0 })),
    )
    const app = await buildVideoApp()
    await app.inject({ method: 'GET', url: '/videos/count-by-type' })
    expect(mockCountVideosByType).toHaveBeenCalledTimes(1)
    expect(mockRedisSetex).toHaveBeenCalledWith('home:count-by-type', 300, expect.any(String))
  })
})
