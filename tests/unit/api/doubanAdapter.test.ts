/**
 * tests/unit/api/doubanAdapter.test.ts
 * CHG-DOUBAN-SEARCH-RESOLVER-WIRE（stop-time review 补丁）：
 *   回归守卫——searchDoubanRich 经真实 resolver 发出的搜索请求必须带 AbortSignal 超时，
 *   防止再次丢失旧 douban.ts 的请求超时保护（豆瓣挂起→无限等待）。
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchDoubanRich } from '@/api/lib/doubanAdapter'

// window.__DATA__ items 为空 → resolver 解析成功返回 0 候选（不抛错，专注校验 signal）
const EMPTY_SEARCH_HTML =
  '<html><body><script>window.__DATA__ = {"items": []};</script></body></html>'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('searchDoubanRich — 请求超时保护', () => {
  it('搜索 fetch 带 AbortSignal 超时（恢复旧 douban.ts timeout）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => EMPTY_SEARCH_HTML,
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchDoubanRich('流浪地球', 2019)

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('search.douban.com')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('fetch 抛出（含超时）→ 降级 []', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchDoubanRich('流浪地球', 2019)).toEqual([])
  })
})
