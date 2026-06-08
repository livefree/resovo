/**
 * tests/unit/api/doubanSearch.test.ts
 * CHG-DOUBAN-SEARCH-RESOLVER-WIRE:
 *   - mapResolvedToSuggest 纯映射（resolver 候选 → SuggestItem 契约）
 *   - searchDouban 接入 douban-adapter resolver + 降级 [] 行为
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DoubanResolvedCandidate } from '@/api/lib/doubanAdapter'

// 隔离 resolver：mock searchDoubanRich，断言 searchDouban 的换源接线与映射
vi.mock('@/api/lib/doubanAdapter', () => ({
  searchDoubanRich: vi.fn(),
}))

import { searchDouban, mapResolvedToSuggest } from '@/api/lib/douban'
import { searchDoubanRich } from '@/api/lib/doubanAdapter'

const mockRich = searchDoubanRich as ReturnType<typeof vi.fn>

function makeCandidate(overrides: Partial<DoubanResolvedCandidate> = {}): DoubanResolvedCandidate {
  return {
    id: '26266893',
    title: '流浪地球',
    originalTitle: 'The Wandering Earth',
    year: '2019',
    type: 'movie',
    url: null,
    coverUrl: null,
    rating: 7.9,
    abstract: null,
    raw: undefined,
    score: 105,
    scoreBreakdown: [],
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════
// mapResolvedToSuggest（纯映射，无网络）
// ═══════════════════════════════════════════════════════════════

describe('mapResolvedToSuggest', () => {
  it('完整候选 → SuggestItem 四字段', () => {
    expect(mapResolvedToSuggest(makeCandidate())).toEqual({
      id: '26266893',
      title: '流浪地球',
      year: '2019',
      sub_title: 'The Wandering Earth',
    })
  })

  it('year/originalTitle 缺失 → 空串（保持 SuggestItem 字段恒为 string）', () => {
    expect(
      mapResolvedToSuggest(makeCandidate({ year: null, originalTitle: null })),
    ).toEqual({ id: '26266893', title: '流浪地球', year: '', sub_title: '' })
  })

  it('year/originalTitle 为 undefined → 空串', () => {
    expect(
      mapResolvedToSuggest(makeCandidate({ year: undefined, originalTitle: undefined })),
    ).toMatchObject({ year: '', sub_title: '' })
  })
})

// ═══════════════════════════════════════════════════════════════
// searchDouban（接入 resolver + 降级）
// ═══════════════════════════════════════════════════════════════

describe('searchDouban', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function runSearch(title: string, year?: number) {
    const p = searchDouban(title, year)
    await vi.runAllTimersAsync() // 推进 delay() 的 setTimeout
    return p
  }

  it('透传 title/year 给 searchDoubanRich 并映射候选', async () => {
    mockRich.mockResolvedValue([
      makeCandidate(),
      makeCandidate({ id: '1', title: '别的', originalTitle: null, year: null }),
    ])

    const result = await runSearch('流浪地球', 2019)

    // CHG-EXT-RES-STORE-B：searchDouban 透传第 3 参 source 给 searchDoubanRich（此处未传 → undefined）
    expect(mockRich).toHaveBeenCalledWith('流浪地球', 2019, undefined)
    expect(result).toEqual([
      { id: '26266893', title: '流浪地球', year: '2019', sub_title: 'The Wandering Earth' },
      { id: '1', title: '别的', year: '', sub_title: '' },
    ])
  })

  it('无 year 时透传 undefined', async () => {
    mockRich.mockResolvedValue([])
    await runSearch('进击的巨人')
    expect(mockRich).toHaveBeenCalledWith('进击的巨人', undefined, undefined)
  })

  it('resolver 返回 [] → searchDouban 返回 []', async () => {
    mockRich.mockResolvedValue([])
    expect(await runSearch('不存在的片', 2099)).toEqual([])
  })

  it('resolver 抛异常 → 防御性降级 []', async () => {
    mockRich.mockRejectedValue(new Error('网络超时'))
    expect(await runSearch('流浪地球', 2019)).toEqual([])
  })
})
