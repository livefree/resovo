/**
 * tests/unit/api/bangumiResourceAdapter.test.ts
 * CHG-BNG-RES-API-3B（ADR-189 D-189-1/4）：BangumiResourceAdapter
 *   getDataScale / getOverview（含 dump 重导 freshness 行）/ getCollections（中性 DTO map）/ unifiedSearch（dump+live+busy）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'

vi.mock('@/api/db/queries/external-fetch-log', () => ({ aggregateFetchLog: vi.fn(), queryFetchLog: vi.fn() }))
vi.mock('@/api/db/queries/external-resources-stats', () => ({ getBangumiDataScale: vi.fn(), aggregateExternalRefMatch: vi.fn() }))
vi.mock('@/api/db/queries/bangumi-collections', () => ({
  listAllBangumiCollectionSyncState: vi.fn(),
  listBangumiCollectionItemsPaged: vi.fn(),
  listBangumiCollectionsSummary: vi.fn(),
}))
vi.mock('@/api/db/queries/externalData', () => ({ searchBangumiEntries: vi.fn() }))
vi.mock('@/api/lib/bangumi', () => ({ searchSubjects: vi.fn() }))
vi.mock('@/api/services/bangumi-config', () => ({ loadBangumiClientConfig: vi.fn().mockResolvedValue({}) }))

import { BangumiResourceAdapter } from '@/api/services/external-resources/BangumiResourceAdapter'
import { aggregateFetchLog, queryFetchLog } from '@/api/db/queries/external-fetch-log'
import { getBangumiDataScale, aggregateExternalRefMatch } from '@/api/db/queries/external-resources-stats'
import {
  listAllBangumiCollectionSyncState,
  listBangumiCollectionItemsPaged,
  listBangumiCollectionsSummary,
} from '@/api/db/queries/bangumi-collections'
import { searchBangumiEntries } from '@/api/db/queries/externalData'
import { searchSubjects } from '@/api/lib/bangumi'

const db = {} as Pool
const adapter = new BangumiResourceAdapter(db)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBangumiDataScale).mockResolvedValue({ collectionItems: 50, dumpEntries: 9000, dumpRefreshedAt: '2026-06-01T04:00:00Z' })
  vi.mocked(aggregateFetchLog).mockResolvedValue({ total: 7, ok: 6, fail: 1, timeout: 0, avgDurationMs: 300, byOperation: [], byMethod: [] })
  vi.mocked(aggregateExternalRefMatch).mockResolvedValue({ total: 3, byStatus: [], byMethod: [] })
  vi.mocked(listAllBangumiCollectionSyncState).mockResolvedValue([])
  vi.mocked(queryFetchLog).mockResolvedValue({ rows: [], total: 0 })
  vi.mocked(listBangumiCollectionItemsPaged).mockResolvedValue({ rows: [], total: 0 })
  vi.mocked(listBangumiCollectionsSummary).mockResolvedValue([])
  vi.mocked(searchBangumiEntries).mockResolvedValue({ rows: [], total: 0 })
  vi.mocked(searchSubjects).mockResolvedValue([])
})

describe('getDataScale', () => {
  it('→ 2 指标（派生合集 + dump 条目）', async () => {
    expect(await adapter.getDataScale()).toEqual([
      { key: 'collectionItems', label: '派生合集条目', value: 50 },
      { key: 'dumpEntries', label: '离线 dump 条目', value: 9000 },
    ])
  })
})

describe('getOverview', () => {
  it('聚合 provider=bangumi + dump 重导 freshness 行追加（D-189-6）', async () => {
    vi.mocked(listAllBangumiCollectionSyncState).mockResolvedValue([
      { collection: 'bgm_trending', lastAttemptAt: null, lastSuccessAt: '2026-06-07T00:00:00Z', lastStatus: 'ok', lastError: null, itemCount: 200 },
    ])
    const r = await adapter.getOverview('2026-06-06T00:00:00Z')
    expect(aggregateFetchLog).toHaveBeenCalledWith(db, 'bangumi', '2026-06-06T00:00:00Z')
    expect(aggregateExternalRefMatch).toHaveBeenCalledWith(db, 'bangumi')
    expect(r.fetchStats.total).toBe(7)
    // freshness = 1 合集 + 1 dump 重导行
    expect(r.collectionFreshness).toHaveLength(2)
    const dumpRow = r.collectionFreshness.find((f) => f.collection.includes('dump'))!
    expect(dumpRow.lastSuccessAt).toBe('2026-06-01T04:00:00Z')
    expect(dumpRow.itemCount).toBe(9000)
    expect(r.dataScale[0]!.value).toBe(50)
  })

  it('dumpRefreshedAt 为 null → 不追加 dump freshness 行', async () => {
    vi.mocked(getBangumiDataScale).mockResolvedValue({ collectionItems: 0, dumpEntries: 0, dumpRefreshedAt: null })
    const r = await adapter.getOverview('2026-06-06T00:00:00Z')
    expect(r.collectionFreshness.some((f) => f.collection.includes('dump'))).toBe(false)
  })
})

describe('getActivity', () => {
  it('→ queryFetchLog 合并 provider=bangumi', async () => {
    await adapter.getActivity({ operation: 'collection', limit: 20, offset: 0 })
    expect(queryFetchLog).toHaveBeenCalledWith(db, { operation: 'collection', limit: 20, offset: 0, provider: 'bangumi' })
  })
})

describe('getCollections', () => {
  it('map 中性 DTO（bangumiId→externalId / nameCn→subtitle / domain null / airWeekday）', async () => {
    vi.mocked(listBangumiCollectionItemsPaged).mockResolvedValue({
      rows: [{ collection: 'bgm_calendar_mon', category: 'calendar', bangumiId: '326125', rank: 0, title: '芙莉莲', nameCn: '葬送的芙莉莲', year: 2023, rating: 9.1, airWeekday: 1, coverUrl: 'x' }],
      total: 12,
    })
    vi.mocked(listBangumiCollectionsSummary).mockResolvedValue([{ collection: 'bgm_calendar_mon', category: 'calendar', count: 12 }])
    const r = await adapter.getCollections({ collection: 'bgm_calendar_mon', limit: 50, offset: 0 })
    expect(r.total).toBe(12)
    expect(r.items[0]).toEqual({
      collection: 'bgm_calendar_mon', category: 'calendar', domain: null, externalId: '326125', rank: 0,
      title: '芙莉莲', subtitle: '葬送的芙莉莲', year: 2023, rating: 9.1, coverUrl: 'x', airWeekday: 1,
    })
    expect(r.summary[0]).toEqual({ collection: 'bgm_calendar_mon', category: 'calendar', domain: null, count: 12 })
  })
})

describe('unifiedSearch', () => {
  it('live=false → 仅 dump（offline），不调 searchSubjects', async () => {
    vi.mocked(searchBangumiEntries).mockResolvedValue({ rows: [{ bangumiId: '1', title: '番A', year: 2020, rating: 8, coverUrl: null }], total: 1 })
    const r = await adapter.unifiedSearch({ q: '番', live: false, limit: 20, offset: 0 })
    expect(r.rows).toEqual([{ source: 'offline', externalId: '1', title: '番A', year: 2020, rating: 8 }])
    expect(searchSubjects).not.toHaveBeenCalled()
  })

  it('live=true → 追加 online（searchSubjects），按 externalId 去重', async () => {
    vi.mocked(searchBangumiEntries).mockResolvedValue({ rows: [{ bangumiId: '1', title: 'A', year: 2020, rating: 8, coverUrl: null }], total: 1 })
    vi.mocked(searchSubjects).mockResolvedValue([
      { id: 1, name: 'A', name_cn: 'A', date: '2020-01-01', images: null, rating: null }, // 去重
      { id: 2, name: 'B', name_cn: '乙', date: '2021-05-01', images: null, rating: { rank: 1, total: 1, score: 7.5 } },
    ])
    const r = await adapter.unifiedSearch({ q: 'x', live: true, limit: 20, offset: 0 })
    expect(r.rows.map((h) => `${h.source}:${h.externalId}`)).toEqual(['offline:1', 'online:2'])
    expect(r.rows[1]).toMatchObject({ externalId: '2', title: '乙', year: 2021, rating: 7.5 })
    expect(searchSubjects).toHaveBeenCalledWith('x', 10, {}, 'admin_search')
  })

  it('live 并发 1 限流：第二个并发跳过在线 → liveError=busy', async () => {
    let release: (v: never[]) => void = () => {}
    vi.mocked(searchSubjects).mockReturnValueOnce(new Promise<never[]>((res) => { release = res }))
    const p1 = adapter.unifiedSearch({ q: 'x', live: true, limit: 10, offset: 0 })
    const r2 = await adapter.unifiedSearch({ q: 'x', live: true, limit: 10, offset: 0 })
    expect(r2.liveError).toBe('busy')
    release([])
    await p1
  })
})
