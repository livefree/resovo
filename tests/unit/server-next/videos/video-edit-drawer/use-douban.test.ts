// @vitest-environment jsdom

/**
 * use-douban.test.ts — useDoubanTab hook 单元测试（CHG-SN-4-08）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../../../../apps/server-next/src/lib/videos/api', () => ({
  searchDoubanForVideo: vi.fn(),
  confirmDoubanMatch: vi.fn(),
  ignoreDoubanMatch: vi.fn(),
  getDoubanCandidate: vi.fn(),
}))

import * as api from '../../../../../apps/server-next/src/lib/videos/api'
import { useDoubanTab } from '../../../../../apps/server-next/src/lib/videos/use-douban'
import type { DoubanCandidateData } from '../../../../../apps/server-next/src/lib/videos/use-douban'

function makeCandidate(overrides: Partial<DoubanCandidateData> = {}): DoubanCandidateData {
  return {
    externalRefId: 'ref1',
    externalId: '26277285',
    confidence: 0.92,
    matchMethod: 'title_year',
    breakdown: { title: 0.9, year: 1.0 },
    diffs: [
      { field: 'title', label: '标题', current: '本地标题', proposed: '豆瓣标题', changed: true },
      { field: 'year', label: '年份', current: '2023', proposed: '2023', changed: false },
    ],
    ...overrides,
  }
}

describe('useDoubanTab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('doubanStatus=candidate 时加载候选数据', async () => {
    const candidate = makeCandidate()
    vi.mocked(api.getDoubanCandidate).mockResolvedValue(candidate)

    const onConfirmed = vi.fn()
    const { result } = renderHook(() => useDoubanTab('v1', 'candidate', onConfirmed))
    expect(result.current[0].candidateLoading).toBe(true)

    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(result.current[0].candidateLoading).toBe(false)
    expect(result.current[0].candidate?.externalId).toBe('26277285')
  })

  it('doubanStatus=pending 时不加载候选数据', async () => {
    const onConfirmed = vi.fn()
    const { result } = renderHook(() => useDoubanTab('v1', 'pending', onConfirmed))

    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(api.getDoubanCandidate).not.toHaveBeenCalled()
    expect(result.current[0].candidate).toBeNull()
  })

  it('search：成功返回候选列表', async () => {
    vi.mocked(api.getDoubanCandidate).mockResolvedValue(null)
    vi.mocked(api.searchDoubanForVideo).mockResolvedValue({
      videoId: 'v1',
      candidates: [{ id: '1234', title: '测试影片', year: '2023', sub_title: '电影' }],
    })

    const onConfirmed = vi.fn()
    const { result } = renderHook(() => useDoubanTab('v1', 'pending', onConfirmed))

    await act(async () => { await result.current[1].search('测试影片') })

    expect(result.current[0].searchResults).toHaveLength(1)
    expect(result.current[0].searchResults[0]!.title).toBe('测试影片')
    expect(result.current[0].searching).toBe(false)
  })

  it('search：失败时 searchError 就位', async () => {
    vi.mocked(api.getDoubanCandidate).mockResolvedValue(null)
    vi.mocked(api.searchDoubanForVideo).mockRejectedValue(new Error('搜索失败'))

    const onConfirmed = vi.fn()
    const { result } = renderHook(() => useDoubanTab('v1', 'pending', onConfirmed))

    await act(async () => { await result.current[1].search('keyword') })

    expect(result.current[0].searchError).toBe('搜索失败')
  })

  it('confirm：成功时调用 onConfirmed 并清空搜索结果', async () => {
    vi.mocked(api.getDoubanCandidate).mockResolvedValue(null)
    vi.mocked(api.confirmDoubanMatch).mockResolvedValue(undefined)

    const onConfirmed = vi.fn()
    const { result } = renderHook(() => useDoubanTab('v1', 'pending', onConfirmed))

    await act(async () => { await result.current[1].confirm('26277285') })

    expect(api.confirmDoubanMatch).toHaveBeenCalledWith('v1', '26277285')
    expect(onConfirmed).toHaveBeenCalledOnce()
    expect(result.current[0].searchResults).toHaveLength(0)
  })

  it('ignore：成功时调用 onConfirmed', async () => {
    vi.mocked(api.getDoubanCandidate).mockResolvedValue(null)
    vi.mocked(api.ignoreDoubanMatch).mockResolvedValue(undefined)

    const onConfirmed = vi.fn()
    const { result } = renderHook(() => useDoubanTab('v1', 'pending', onConfirmed))

    await act(async () => { await result.current[1].ignore() })

    expect(api.ignoreDoubanMatch).toHaveBeenCalledWith('v1')
    expect(onConfirmed).toHaveBeenCalledOnce()
  })
})
