/**
 * @vitest-environment jsdom
 *
 * use-rejected-queue.test.ts — CHG-SN-9-REJECTED-ENHANCE-A
 *
 * 覆盖 RejectedTabContent 抽出的队列 hook 核心 contract：
 *   #1 enabled=true 初始 fetch → videos 填充 + total 正确
 *   #2 loadMore → page+1 + 追加新行
 *   #3 hasMore 推导：videos.length < total
 *   #4 reopenAt 成功 → 本地 splice 移除 + total - 1
 *   #5 reopenAt 失败 → setError + throw
 *   #6 near-end 自动 loadMore：activeIdx >= length - 5 + hasMore
 *   #7 refetch → 重置 page=1 + 替换 videos
 *
 * 实现注意：
 *   - mockResolvedValue（持久）防 React 18 strict mode 双调用耗尽
 *   - 不精确断言 mockFetch 调用次数
 *   - waitFor 等 async effect 沉淀
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../../../apps/server-next/src/lib/moderation/api', () => ({
  fetchRejectedVideos: vi.fn(),
  reopenVideo: vi.fn(),
}))

import * as api from '../../../../apps/server-next/src/lib/moderation/api'
import { useRejectedQueue } from '../../../../apps/server-next/src/app/admin/moderation/_client/useRejectedQueue'

const mockFetch = api.fetchRejectedVideos as ReturnType<typeof vi.fn>
const mockReopen = api.reopenVideo as ReturnType<typeof vi.fn>

function makeRejectedRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Rejected ${id}`,
    type: 'movie',
    year: 2024,
    cover_url: null,
    visibility_status: 'rejected',
    source_check_status: null,
    review_label_key: null,
    updated_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeApiResponse(rows: ReturnType<typeof makeRejectedRow>[], total = rows.length) {
  return {
    data: rows,
    total,
    page: 1,
    limit: 30,
  }
}

describe('useRejectedQueue — CHG-SN-9-REJECTED-ENHANCE-A 分页 hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    // 默认空响应防初始 fetch undefined.then
    mockFetch.mockResolvedValue(makeApiResponse([]))
  })

  it('#1 enabled=true 初始 fetch → videos 填充 + total 正确', async () => {
    const rows = [makeRejectedRow('r-1'), makeRejectedRow('r-2')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 50))

    const { result } = renderHook(() => useRejectedQueue(true))

    await waitFor(() => expect(result.current.videos.length).toBe(2))
    expect(result.current.videos[0].id).toBe('r-1')
    expect(result.current.total).toBe(50)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.page).toBe(1)
    expect(result.current.error).toBeNull()
    expect(mockFetch).toHaveBeenCalled()
  })

  it('#2 loadMore → page+1 + 追加新行 + total 更新', async () => {
    // 初始 fetch 2 行 / total=50；loadMore fetch 2 行 / total=50
    const firstRows = [makeRejectedRow('r-1'), makeRejectedRow('r-2')]
    const secondRows = [makeRejectedRow('r-3'), makeRejectedRow('r-4')]
    mockFetch
      .mockResolvedValueOnce(makeApiResponse(firstRows, 50))
      .mockResolvedValue(makeApiResponse(secondRows, 50))

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(2))

    await act(async () => {
      result.current.loadMore()
    })
    await waitFor(() => expect(result.current.videos.length).toBe(4))

    expect(result.current.page).toBe(2)
    expect(result.current.videos.map(v => v.id)).toEqual(['r-1', 'r-2', 'r-3', 'r-4'])
    expect(result.current.hasMore).toBe(true)
  })

  it('#3 hasMore 推导：videos.length < total / 全部加载完后 hasMore=false', async () => {
    const rows = [makeRejectedRow('r-1'), makeRejectedRow('r-2')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 2))  // total === length

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(2))

    expect(result.current.hasMore).toBe(false)
  })

  it('#4 reopenAt 成功 → 本地 splice 移除 + total - 1', async () => {
    const rows = [makeRejectedRow('r-1'), makeRejectedRow('r-2'), makeRejectedRow('r-3')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 3))
    mockReopen.mockResolvedValue(undefined)

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(3))

    await act(async () => {
      await result.current.reopenAt(1)  // 重审 r-2
    })

    expect(result.current.videos.map(v => v.id)).toEqual(['r-1', 'r-3'])
    expect(result.current.total).toBe(2)
    expect(mockReopen).toHaveBeenCalledWith('r-2')
  })

  it('#5 reopenAt 失败 → setError + throw', async () => {
    const rows = [makeRejectedRow('r-1')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 1))
    mockReopen.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(1))

    await act(async () => {
      await result.current.reopenAt().catch(() => { /* expected throw */ })
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    // 原视频未被本地移除（失败回滚 / try/catch 内 setVideos 在 catch 前未触发）
    expect(result.current.videos.length).toBe(1)
  })

  it('#6 near-end 自动 loadMore：activeIdx 推到末尾 - 4 (< length - 5 阈值) → 触发 loadMore', async () => {
    // 6 条 first / 5 条 second / total=50
    const firstRows = Array.from({ length: 6 }, (_, i) => makeRejectedRow(`r-${i + 1}`))
    const secondRows = Array.from({ length: 5 }, (_, i) => makeRejectedRow(`r-${i + 7}`))
    mockFetch
      .mockResolvedValueOnce(makeApiResponse(firstRows, 50))
      .mockResolvedValue(makeApiResponse(secondRows, 50))

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(6))

    // setActiveIdx 到 length - 5 = 1（near-end 阈值）→ 应触发 loadMore
    act(() => {
      result.current.setActiveIdx(1)
    })
    await waitFor(() => expect(result.current.videos.length).toBe(11))
  })

  it('#7 refetch → 重置 page=1 + 替换 videos', async () => {
    const initialRows = [makeRejectedRow('r-1'), makeRejectedRow('r-2')]
    mockFetch
      .mockResolvedValueOnce(makeApiResponse(initialRows, 2))
      .mockResolvedValue(makeApiResponse([makeRejectedRow('r-99')], 1))

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(2))

    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.videos.length).toBe(1))

    expect(result.current.videos[0].id).toBe('r-99')
    expect(result.current.page).toBe(1)
    expect(result.current.total).toBe(1)
  })

  it('#8 enabled=false → 不自动 fetch', async () => {
    const { result } = renderHook(() => useRejectedQueue(false))

    // 等 1 个 microtask 让 useEffect 跑
    await act(async () => { await Promise.resolve() })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.videos.length).toBe(0)
    expect(result.current.loading).toBe(false)
  })

  // ── CHG-SN-9-REJECTED-ENHANCE-B / Wave 4 #1 ────────────────────
  it('#9 toggleSelect → selectedIds 添加 / 再次切换 → 移除', async () => {
    const rows = [makeRejectedRow('r-1'), makeRejectedRow('r-2')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 2))

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(2))

    act(() => result.current.toggleSelect('r-1'))
    expect(result.current.selectedIds.has('r-1')).toBe(true)
    expect(result.current.selectedIds.size).toBe(1)

    act(() => result.current.toggleSelect('r-2'))
    expect(result.current.selectedIds.size).toBe(2)

    act(() => result.current.toggleSelect('r-1'))
    expect(result.current.selectedIds.has('r-1')).toBe(false)
    expect(result.current.selectedIds.size).toBe(1)

    act(() => result.current.clearSelection())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('#10 batchReopen 全部成功 → videos splice + total 减 + selectedIds 清空 + result.success 含全部', async () => {
    const rows = [makeRejectedRow('r-1'), makeRejectedRow('r-2'), makeRejectedRow('r-3')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 3))
    mockReopen.mockResolvedValue(undefined)

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(3))

    act(() => {
      result.current.toggleSelect('r-1')
      result.current.toggleSelect('r-2')
    })
    expect(result.current.selectedIds.size).toBe(2)

    let batchResult: { success: ReadonlyArray<string>; failed: ReadonlyArray<{ id: string; error: string }> } = { success: [], failed: [] }
    await act(async () => {
      batchResult = await result.current.batchReopen()
    })

    expect(batchResult.success).toEqual(expect.arrayContaining(['r-1', 'r-2']))
    expect(batchResult.success.length).toBe(2)
    expect(batchResult.failed).toEqual([])
    expect(result.current.videos.map(v => v.id)).toEqual(['r-3'])
    expect(result.current.total).toBe(1)
    expect(result.current.selectedIds.size).toBe(0)
    expect(result.current.batchPending).toBe(false)
    expect(mockReopen).toHaveBeenCalledTimes(2)
  })

  it('#10b WAVE4-VALIDATION-FIX-2 P2：单条 reopenAt 成功 → 同步从 selectedIds 删除（防 phantom selection）', async () => {
    const rows = [makeRejectedRow('r-1'), makeRejectedRow('r-2'), makeRejectedRow('r-3')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 3))
    mockReopen.mockResolvedValue(undefined)

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(3))

    // 用户勾选 r-1 + r-2
    act(() => {
      result.current.toggleSelect('r-1')
      result.current.toggleSelect('r-2')
    })
    expect(result.current.selectedIds.size).toBe(2)

    // 单条 reopenAt 移除 r-1（之前会留 phantom: selectedIds 仍含 r-1）
    await act(async () => {
      await result.current.reopenAt(0) // r-1
    })

    expect(result.current.videos.map(v => v.id)).toEqual(['r-2', 'r-3'])
    // P2 修复：selectedIds 必须同步删除 r-1（防 phantom + 后续 batchReopen 对已移除 id 再请求）
    expect(result.current.selectedIds.has('r-1')).toBe(false)
    // r-2 仍勾选（不动其他）
    expect(result.current.selectedIds.has('r-2')).toBe(true)
    expect(result.current.selectedIds.size).toBe(1)
  })

  it('#11 batchReopen 部分失败 → 仅成功项移除 / failed 保留勾选 / 不抛错', async () => {
    const rows = [makeRejectedRow('r-1'), makeRejectedRow('r-2')]
    mockFetch.mockResolvedValue(makeApiResponse(rows, 2))
    // r-1 成功 / r-2 失败（按 Set 迭代顺序 = 插入顺序）
    mockReopen
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useRejectedQueue(true))
    await waitFor(() => expect(result.current.videos.length).toBe(2))

    act(() => {
      result.current.toggleSelect('r-1')
      result.current.toggleSelect('r-2')
    })

    let batchResult: { success: ReadonlyArray<string>; failed: ReadonlyArray<{ id: string; error: string }> } = { success: [], failed: [] }
    await act(async () => {
      batchResult = await result.current.batchReopen()
    })

    expect(batchResult.success).toEqual(['r-1'])
    expect(batchResult.failed.length).toBe(1)
    expect(batchResult.failed[0].id).toBe('r-2')
    expect(batchResult.failed[0].error).toBe('boom')
    expect(result.current.videos.map(v => v.id)).toEqual(['r-2'])
    expect(result.current.total).toBe(1)
    // 成功项从勾选中移除 / 失败项仍勾选让用户可重试
    expect(result.current.selectedIds.has('r-1')).toBe(false)
    expect(result.current.selectedIds.has('r-2')).toBe(true)
    expect(result.current.batchPending).toBe(false)
  })
})
