/**
 * tests/unit/api/doubanCollectionsRefresh.test.ts
 * CHG-DOUBAN-HOT-STORE-B：refreshCollection 编排
 *   - 单页/分页全量累积 rank → replaceCollectionItems
 *   - 抓取失败（null）→ recordCollectionSyncState(failed)，不替换
 *   - empty_guard（空 / 相对上轮骤降）→ 不替换
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Pool } from 'pg'
import type { DoubanCollectionItem, DoubanCollectionItemsResult } from 'douban-adapter'

vi.mock('@/api/lib/doubanAdapter', () => ({ getDoubanCollectionItems: vi.fn() }))
vi.mock('@/api/db/queries/douban-collections', () => ({
  replaceCollectionItems: vi.fn().mockResolvedValue(0),
  recordCollectionSyncState: vi.fn().mockResolvedValue(undefined),
  getCollectionSyncState: vi.fn().mockResolvedValue(null),
}))

import { refreshCollection, refreshAllCollections } from '@/api/services/douban-collections/refresh'
import { getDoubanCollectionItems } from '@/api/lib/doubanAdapter'
import {
  replaceCollectionItems,
  recordCollectionSyncState,
  getCollectionSyncState,
} from '@/api/db/queries/douban-collections'

const mockFetch = getDoubanCollectionItems as ReturnType<typeof vi.fn>
const mockReplace = replaceCollectionItems as ReturnType<typeof vi.fn>
const mockRecord = recordCollectionSyncState as ReturnType<typeof vi.fn>
const mockSyncState = getCollectionSyncState as ReturnType<typeof vi.fn>

const db = {} as Pool
const ENTRY = { key: 'movie_hot_gaia', domain: 'movie', category: 'trending' } as const

function makeItem(id: string): DoubanCollectionItem {
  return {
    id, title: `片${id}`, originalTitle: null, cardSubtitle: null, info: null,
    year: '2026', ratingValue: 8.0, ratingCount: 100, coverUrl: null, uri: null,
    releaseDate: null, subjectType: 'movie', hasLinewatch: false, raw: { id },
  }
}
function page(items: DoubanCollectionItem[], total: number): DoubanCollectionItemsResult {
  return { collection: 'movie_hot_gaia', total, items }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSyncState.mockResolvedValue(null)
})

describe('refreshCollection', () => {
  it('单页全量 → replaceCollectionItems（rank 连续，domain/category 注入）', async () => {
    mockFetch.mockResolvedValueOnce(page([makeItem('a'), makeItem('b'), makeItem('c')], 3))

    const res = await refreshCollection(db, ENTRY)

    expect(res).toEqual({ collection: 'movie_hot_gaia', status: 'ok', count: 3 })
    expect(mockReplace).toHaveBeenCalledOnce()
    const rows = mockReplace.mock.calls[0][2] as Array<{ rank: number; domain: string; category: string; item: DoubanCollectionItem }>
    expect(rows.map((r) => r.rank)).toEqual([0, 1, 2])
    expect(rows[0].domain).toBe('movie')
    expect(rows[0].category).toBe('trending')
    expect(rows[2].item.id).toBe('c')
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('分页全量 → 跨页累积 rank 连续', async () => {
    vi.useFakeTimers()
    const p0 = Array.from({ length: 50 }, (_, i) => makeItem(`p0-${i}`))
    const p1 = Array.from({ length: 10 }, (_, i) => makeItem(`p1-${i}`))
    mockFetch.mockResolvedValueOnce(page(p0, 60)).mockResolvedValueOnce(page(p1, 60))

    const promise = refreshCollection(db, ENTRY)
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe('ok')
    expect(res.count).toBe(60)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const rows = mockReplace.mock.calls[0][2] as Array<{ rank: number }>
    expect(rows[0].rank).toBe(0)
    expect(rows[59].rank).toBe(59)
    vi.useRealTimers()
  })

  it('抓取失败（null）→ recordCollectionSyncState(failed)，不替换', async () => {
    mockFetch.mockResolvedValueOnce(null)

    const res = await refreshCollection(db, ENTRY)

    expect(res.status).toBe('failed')
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockRecord).toHaveBeenCalledWith(db, 'movie_hot_gaia', 'failed', expect.any(String))
  })

  it('empty_guard：返回空 → 不替换保留旧数据', async () => {
    mockSyncState.mockResolvedValue({ collection: 'movie_hot_gaia', itemCount: 200, lastStatus: 'ok', lastAttemptAt: null, lastSuccessAt: null, lastError: null })
    mockFetch.mockResolvedValueOnce(page([], 0))

    const res = await refreshCollection(db, ENTRY)

    expect(res.status).toBe('empty_guard')
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockRecord).toHaveBeenCalledWith(db, 'movie_hot_gaia', 'empty_guard', expect.any(String))
  })

  it('empty_guard：相对上轮骤降（<50%）→ 不替换', async () => {
    mockSyncState.mockResolvedValue({ collection: 'movie_hot_gaia', itemCount: 100, lastStatus: 'ok', lastAttemptAt: null, lastSuccessAt: null, lastError: null })
    mockFetch.mockResolvedValueOnce(page([makeItem('a'), makeItem('b')], 2))

    const res = await refreshCollection(db, ENTRY)

    expect(res.status).toBe('empty_guard')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('首轮（无 prev）少量条目不触发 guard（baseline 0）', async () => {
    mockSyncState.mockResolvedValue(null)
    mockFetch.mockResolvedValueOnce(page([makeItem('a')], 1))

    const res = await refreshCollection(db, ENTRY)
    expect(res.status).toBe('ok')
    expect(mockReplace).toHaveBeenCalledOnce()
  })
})

describe('refreshAllCollections', () => {
  it('遍历全 16 合集 + 单合集异常隔离记 failed', async () => {
    vi.useFakeTimers()
    // 所有合集首页正常但 replace 抛错 → 走 catch 记 failed
    mockFetch.mockResolvedValue(page([makeItem('a'), makeItem('b')], 2))
    mockReplace.mockRejectedValue(new Error('db down'))

    const promise = refreshAllCollections(db)
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toHaveLength(16)
    expect(results.every((r) => r.status === 'failed')).toBe(true)
    expect(mockRecord).toHaveBeenCalled()
    vi.useRealTimers()
  })
})

afterEach(() => {
  vi.useRealTimers()
})
