/**
 * tests/unit/api/doubanAdapterRecord.test.ts
 * CHG-EXT-RES-STORE-B（ADR-188 D-188-4）：豆瓣三在线出口埋点旁路。
 *   searchDoubanRich(search) / getDoubanDetailRich(detail) / getDoubanCollectionItems(collection)
 *   成功/失败均经 recordFetch 记一行（provider=douban / method=scrape / source 透传），
 *   且返回值与降级语义（[] / null）逐字不变。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted：mock 工厂提升到 import 之前，外层 fn 引用须经 hoisted
const { recordFetch, searchSubjects, getById, getItems } = vi.hoisted(() => ({
  recordFetch: vi.fn().mockResolvedValue(undefined),
  searchSubjects: vi.fn(),
  getById: vi.fn(),
  getItems: vi.fn(),
}))
vi.mock('@/api/lib/external-fetch-recorder', async (orig) => ({
  ...(await orig<typeof import('@/api/lib/external-fetch-recorder')>()),
  recordFetch,
}))
vi.mock('douban-adapter', () => ({
  createHostRuntime: vi.fn(() => ({})),
  createDoubanDetailsService: vi.fn(() => ({ getById })),
  createDoubanResolverService: vi.fn(() => ({ searchSubjects })),
  createDoubanSubjectCollectionService: vi.fn(() => ({ getItems })),
}))

import {
  searchDoubanRich,
  getDoubanDetailRich,
  getDoubanCollectionItems,
} from '@/api/lib/doubanAdapter'

beforeEach(() => vi.clearAllMocks())

describe('searchDoubanRich 埋点', () => {
  it('成功 → recordFetch ok + operation=search + source 透传 + 返回候选', async () => {
    searchSubjects.mockResolvedValue({ candidates: [{ id: '1', title: 'a' }, { id: '2', title: 'b' }] })
    const out = await searchDoubanRich('流浪地球', 2019, 'enrich_worker')
    expect(out).toHaveLength(2)
    expect(recordFetch).toHaveBeenCalledOnce()
    expect(recordFetch.mock.calls[0][0]).toMatchObject({
      provider: 'douban',
      operation: 'search',
      method: 'scrape',
      status: 'ok',
      source: 'enrich_worker',
      target: '流浪地球',
      itemCount: 2,
    })
    expect(typeof recordFetch.mock.calls[0][0].durationMs).toBe('number')
  })

  it('抛错 → recordFetch status=fail + error 摘要 + 返回 [] 降级不变', async () => {
    searchSubjects.mockRejectedValue(new Error('boom'))
    const out = await searchDoubanRich('x')
    expect(out).toEqual([])
    expect(recordFetch.mock.calls[0][0]).toMatchObject({ operation: 'search', status: 'fail', itemCount: 0 })
    expect(recordFetch.mock.calls[0][0].error).toContain('boom')
  })
})

describe('getDoubanDetailRich 埋点', () => {
  it('成功有 data → ok item_count 1 + operation=detail + target=id', async () => {
    getById.mockResolvedValue({ data: { id: '26266893', title: '流浪地球' } })
    const out = await getDoubanDetailRich('26266893', 'enrich_worker')
    expect(out).toMatchObject({ id: '26266893' })
    expect(recordFetch.mock.calls[0][0]).toMatchObject({
      operation: 'detail',
      status: 'ok',
      itemCount: 1,
      source: 'enrich_worker',
      target: '26266893',
    })
  })

  it('成功无 data → ok item_count 0 + 返回 null', async () => {
    getById.mockResolvedValue({ data: null })
    expect(await getDoubanDetailRich('x')).toBeNull()
    expect(recordFetch.mock.calls[0][0]).toMatchObject({ operation: 'detail', status: 'ok', itemCount: 0 })
  })
})

describe('getDoubanCollectionItems 埋点', () => {
  it('成功 → ok operation=collection item_count + source=collections_worker', async () => {
    getItems.mockResolvedValue({ collection: 'movie_hot_gaia', total: 345, items: [{}, {}, {}] })
    const out = await getDoubanCollectionItems('movie_hot_gaia', 0, 50, 'collections_worker')
    expect(out?.total).toBe(345)
    expect(recordFetch.mock.calls[0][0]).toMatchObject({
      operation: 'collection',
      status: 'ok',
      itemCount: 3,
      source: 'collections_worker',
      target: 'movie_hot_gaia',
    })
  })

  it('抛错 → 返回 null（区分 fetch 失败保留旧数据）+ status=fail', async () => {
    getItems.mockRejectedValue(new Error('net'))
    expect(await getDoubanCollectionItems('tv_hot')).toBeNull()
    expect(recordFetch.mock.calls[0][0]).toMatchObject({ operation: 'collection', status: 'fail' })
  })
})
