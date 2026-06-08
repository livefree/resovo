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
  aggregateExternalRefMatch: vi.fn(),
}))
vi.mock('@/api/db/queries/douban-collections', () => ({
  listAllCollectionSyncState: vi.fn(),
}))

import { ExternalResourcesService } from '@/api/services/ExternalResourcesService'
import { aggregateFetchLog, queryFetchLog } from '@/api/db/queries/external-fetch-log'
import { getDoubanDataScale, aggregateExternalRefMatch } from '@/api/db/queries/external-resources-stats'
import { listAllCollectionSyncState } from '@/api/db/queries/douban-collections'

const db = {} as Pool
const svc = new ExternalResourcesService(db)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDoubanDataScale).mockResolvedValue({ collectionItems: 1294, doubanEntries: 140000 })
  vi.mocked(aggregateFetchLog).mockResolvedValue({ total: 10, ok: 8, fail: 1, timeout: 1, avgDurationMs: 500, byOperation: [], byMethod: [] })
  vi.mocked(aggregateExternalRefMatch).mockResolvedValue({ total: 5, byStatus: [], byMethod: [] })
  vi.mocked(listAllCollectionSyncState).mockResolvedValue([])
  vi.mocked(queryFetchLog).mockResolvedValue({ rows: [], total: 0 })
})

describe('getProviders', () => {
  it('覆盖全 4 provider；douban active 含 dataScale，planned 为 null', async () => {
    const list = await svc.getProviders()
    expect(list.map((p) => p.key)).toEqual(['douban', 'bangumi', 'imdb', 'tmdb'])
    const douban = list.find((p) => p.key === 'douban')!
    expect(douban.status).toBe('active')
    expect(douban.dataScale).toEqual({ collectionItems: 1294, doubanEntries: 140000 })
    expect(list.find((p) => p.key === 'bangumi')!.dataScale).toBeNull()
    // planned provider 不触发 douban dataScale 之外的查询（仅 douban 调一次）
    expect(getDoubanDataScale).toHaveBeenCalledTimes(1)
  })
})

describe('getOverview', () => {
  it('douban → 并发聚合 fetch/enrich/freshness/scale 四源', async () => {
    const r = await svc.getOverview('douban', '2026-06-06T00:00:00Z')
    expect('fetchStats' in r).toBe(true)
    if ('fetchStats' in r) {
      expect(r.fetchStats.total).toBe(10)
      expect(r.enrichStats.total).toBe(5)
      expect(r.dataScale.collectionItems).toBe(1294)
    }
    expect(aggregateFetchLog).toHaveBeenCalledWith(db, 'douban', '2026-06-06T00:00:00Z')
  })

  it('planned provider（bangumi）→ PLANNED_MARKER，零 DB 查询', async () => {
    const r = await svc.getOverview('bangumi', '2026-06-06T00:00:00Z')
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
