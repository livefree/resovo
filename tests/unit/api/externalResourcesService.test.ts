/**
 * tests/unit/api/externalResourcesService.test.ts
 * CHG-EXT-RES-API-A（ADR-188 D-188-5）：ExternalResourcesService 聚合逻辑。
 *   getProviders（active 含 dataScale / planned null）/ getOverview（douban 聚合 4 源 / planned marker）
 *   / getActivity（合并 provider+filter / planned marker）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'

vi.mock('@/api/db/queries/external-fetch-log', () => ({
  aggregateFetchLog: vi.fn(),
  queryFetchLog: vi.fn(),
}))
vi.mock('@/api/db/queries/external-resources-stats', () => ({
  getDoubanDataScale: vi.fn(),
  getBangumiDataScale: vi.fn(),
  aggregateExternalRefMatch: vi.fn(),
}))
vi.mock('@/api/db/queries/douban-collections', () => ({
  listAllCollectionSyncState: vi.fn(),
  listCollectionItemsPaged: vi.fn(),
  listCollectionsSummary: vi.fn(),
}))
vi.mock('@/api/db/queries/externalData', () => ({
  searchDoubanEntries: vi.fn(),
}))
vi.mock('@/api/lib/doubanAdapter', () => ({
  searchDoubanRich: vi.fn(),
}))

import { ExternalResourcesService } from '@/api/services/ExternalResourcesService'
import { aggregateFetchLog, queryFetchLog } from '@/api/db/queries/external-fetch-log'
import { getDoubanDataScale, getBangumiDataScale, aggregateExternalRefMatch } from '@/api/db/queries/external-resources-stats'
import {
  listAllCollectionSyncState,
  listCollectionItemsPaged,
  listCollectionsSummary,
} from '@/api/db/queries/douban-collections'
import { searchDoubanEntries } from '@/api/db/queries/externalData'
import { searchDoubanRich } from '@/api/lib/doubanAdapter'

const db = {} as Pool
const svc = new ExternalResourcesService(db)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDoubanDataScale).mockResolvedValue({ collectionItems: 1294, doubanEntries: 140000 })
  vi.mocked(getBangumiDataScale).mockResolvedValue({ collectionItems: 50, dumpEntries: 9000, dumpRefreshedAt: null })
  vi.mocked(aggregateFetchLog).mockResolvedValue({ total: 10, ok: 8, fail: 1, timeout: 1, avgDurationMs: 500, byOperation: [], byMethod: [] })
  vi.mocked(aggregateExternalRefMatch).mockResolvedValue({ total: 5, byStatus: [], byMethod: [] })
  vi.mocked(listAllCollectionSyncState).mockResolvedValue([])
  vi.mocked(queryFetchLog).mockResolvedValue({ rows: [], total: 0 })
  vi.mocked(listCollectionItemsPaged).mockResolvedValue({ rows: [], total: 0 })
  vi.mocked(listCollectionsSummary).mockResolvedValue([])
  vi.mocked(searchDoubanEntries).mockResolvedValue({ rows: [], total: 0 })
  vi.mocked(searchDoubanRich).mockResolvedValue([])
})

describe('getProviders', () => {
  it('覆盖全 4 provider；douban+bangumi active 含 dataScale，imdb/tmdb planned 为 null（ADR-189）', async () => {
    const list = await svc.getProviders()
    expect(list.map((p) => p.key)).toEqual(['douban', 'bangumi', 'imdb', 'tmdb'])
    const douban = list.find((p) => p.key === 'douban')!
    expect(douban.status).toBe('active')
    // ADR-189 D-189-4：dataScale 泛化为 ProviderDataMetric[]
    expect(douban.dataScale).toEqual([
      { key: 'collectionItems', label: '热门合集条目', value: 1294 },
      { key: 'doubanEntries', label: '离线 dump 条目', value: 140000 },
    ])
    // ADR-189 D-189-1：bangumi active
    const bangumi = list.find((p) => p.key === 'bangumi')!
    expect(bangumi.status).toBe('active')
    expect(bangumi.dataScale).toEqual([
      { key: 'collectionItems', label: '派生合集条目', value: 50 },
      { key: 'dumpEntries', label: '离线 dump 条目', value: 9000 },
    ])
    // planned（imdb/tmdb）无 dataScale
    expect(list.find((p) => p.key === 'imdb')!.dataScale).toBeNull()
    expect(list.find((p) => p.key === 'tmdb')!.dataScale).toBeNull()
    expect(getDoubanDataScale).toHaveBeenCalledTimes(1)
    expect(getBangumiDataScale).toHaveBeenCalledTimes(1)
  })
})

describe('getOverview', () => {
  it('douban → 并发聚合 fetch/enrich/freshness/scale 四源', async () => {
    const r = await svc.getOverview('douban', '2026-06-06T00:00:00Z')
    expect('fetchStats' in r).toBe(true)
    if ('fetchStats' in r) {
      expect(r.fetchStats.total).toBe(10)
      expect(r.enrichStats.total).toBe(5)
      expect(r.dataScale.find((m) => m.key === 'collectionItems')!.value).toBe(1294)
    }
    expect(aggregateFetchLog).toHaveBeenCalledWith(db, 'douban', '2026-06-06T00:00:00Z')
  })

  it('planned provider（imdb）→ PLANNED_MARKER，零 DB 查询', async () => {
    const r = await svc.getOverview('imdb', '2026-06-06T00:00:00Z')
    expect(r).toEqual({ status: 'planned' })
    expect(aggregateFetchLog).not.toHaveBeenCalled()
    expect(aggregateExternalRefMatch).not.toHaveBeenCalled()
  })
})

describe('getActivity', () => {
  it('douban → queryFetchLog 合并 provider + filter', async () => {
    await svc.getActivity('douban', { operation: 'search', limit: 20, offset: 40 })
    expect(queryFetchLog).toHaveBeenCalledWith(db, { operation: 'search', limit: 20, offset: 40, provider: 'douban' })
  })

  it('planned（imdb）→ PLANNED_MARKER，不查 fetch_log', async () => {
    const r = await svc.getActivity('imdb', { limit: 50, offset: 0 })
    expect(r).toEqual({ status: 'planned' })
    expect(queryFetchLog).not.toHaveBeenCalled()
  })
})

describe('getCollections', () => {
  it('douban → items + total + summary', async () => {
    vi.mocked(listCollectionItemsPaged).mockResolvedValue({
      rows: [{ collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', doubanId: '1', rank: 0, title: 'A', originalTitle: null, year: 2026, ratingValue: 8.2, coverUrl: 'x' }],
      total: 345,
    })
    vi.mocked(listCollectionsSummary).mockResolvedValue([{ collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', count: 345 }])
    const r = await svc.getCollections('douban', { collection: 'movie_hot_gaia', limit: 50, offset: 0 })
    expect('items' in r).toBe(true)
    if ('items' in r) {
      expect(r.total).toBe(345)
      expect(r.items[0]!.externalId).toBe('1')
      expect(r.items[0]!.subtitle).toBeNull() // douban originalTitle → subtitle
      expect(r.summary[0]!.count).toBe(345)
    }
    expect(listCollectionItemsPaged).toHaveBeenCalledWith(db, { collection: 'movie_hot_gaia', limit: 50, offset: 0 })
  })

  it('planned（tmdb）→ PLANNED_MARKER', async () => {
    const r = await svc.getCollections('tmdb', { limit: 50, offset: 0 })
    expect(r).toEqual({ status: 'planned' })
    expect(listCollectionItemsPaged).not.toHaveBeenCalled()
  })
})

describe('unifiedSearch', () => {
  it('live=false → 仅 dump（offline），不调 searchDoubanRich', async () => {
    vi.mocked(searchDoubanEntries).mockResolvedValue({
      rows: [{ doubanId: '26266893', title: '流浪地球', year: 2019, rating: 7.9, coverUrl: 'x' }],
      total: 1,
    })
    const r = await svc.unifiedSearch('douban', { q: '流浪地球', live: false, limit: 20, offset: 0 })
    expect('rows' in r && r.rows).toEqual([{ source: 'offline', externalId: '26266893', title: '流浪地球', year: 2019, rating: 7.9 }])
    expect(searchDoubanRich).not.toHaveBeenCalled()
  })

  it('live=true → 追加 online 候选，按 externalId 去重（dump 已有不重复）', async () => {
    vi.mocked(searchDoubanEntries).mockResolvedValue({
      rows: [{ doubanId: '1', title: 'A', year: 2020, rating: 8, coverUrl: null }],
      total: 1,
    })
    vi.mocked(searchDoubanRich).mockResolvedValue([
      { id: '1', title: 'A', year: '2020', originalTitle: null } as never, // 已在 dump → 去重
      { id: '2', title: 'B', year: '2021', originalTitle: null } as never,
    ])
    const r = await svc.unifiedSearch('douban', { q: 'x', live: true, limit: 20, offset: 0 })
    if ('rows' in r) {
      expect(r.rows.map((h) => `${h.source}:${h.externalId}`)).toEqual(['offline:1', 'online:2'])
    }
    expect(searchDoubanRich).toHaveBeenCalledWith('x', undefined, 'admin_search')
  })

  it('live 并发 1 限流：第二个并发调用跳过在线 → liveError=busy', async () => {
    let releaseLive: (v: never[]) => void = () => {}
    vi.mocked(searchDoubanRich).mockReturnValueOnce(new Promise<never[]>((res) => { releaseLive = res }))
    const p1 = svc.unifiedSearch('douban', { q: 'x', live: true, limit: 10, offset: 0 })
    const r2 = await svc.unifiedSearch('douban', { q: 'x', live: true, limit: 10, offset: 0 })
    expect('liveError' in r2 && r2.liveError).toBe('busy')
    releaseLive([])
    await p1
  })

  it('planned（imdb）→ PLANNED_MARKER，不查 dump', async () => {
    const r = await svc.unifiedSearch('imdb', { q: 'x', live: true, limit: 20, offset: 0 })
    expect(r).toEqual({ status: 'planned' })
    expect(searchDoubanEntries).not.toHaveBeenCalled()
  })
})
