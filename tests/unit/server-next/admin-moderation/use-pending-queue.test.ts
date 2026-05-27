/**
 * @vitest-environment jsdom
 *
 * use-pending-queue.test.ts — CHG-347 / SPLIT-A
 *
 * 覆盖 ModerationConsole 抽出的队列 hook 核心 contract：
 *   #1 enabled=true 初始 fetch → videos 填充
 *   #2 approveAt 失败 → 视频 splice 回原位置 + error 显示
 *   #3 batchApprove 成功 → 批量从队列移除 + 清 error
 *   #4 refetch → 重新拉取
 *
 * 实现注意：
 *   - mockResolvedValue（持久）而非 mockResolvedValueOnce（避免 React 18 strict mode 双调用耗尽 mock）
 *   - 所有 fetch 用 nextCursor=null 避免 auto-load more 触发额外调用
 *   - 不精确断言 mockFetch 调用次数（strict mode 双调用）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../../../apps/server-next/src/lib/moderation/api', () => ({
  fetchPendingQueue: vi.fn(),
  approveVideo: vi.fn(),
  rejectVideo: vi.fn(),
  batchApproveVideos: vi.fn(),
  batchRejectVideos: vi.fn(),
}))

import * as api from '../../../../apps/server-next/src/lib/moderation/api'
import { usePendingQueue } from '../../../../apps/server-next/src/app/admin/moderation/_client/usePendingQueue'

const mockFetch = api.fetchPendingQueue as ReturnType<typeof vi.fn>
const mockApprove = api.approveVideo as ReturnType<typeof vi.fn>
const mockBatchApprove = api.batchApproveVideos as ReturnType<typeof vi.fn>

// outer-scope 稳定引用 — 防止每次 render 创建新 {} 触发 useEffect 死循环
const STABLE_FILTERS = {}

function makeQueueRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Video ${id}`,
    type: 'movie',
    year: 2024,
    country: 'CN',
    rating: 8.0,
    coverUrl: null,
    episodeCount: 1,
    visibilityStatus: 'internal',
    reviewStatus: 'pending_review',
    isPublished: false,
    staffNote: null,
    badges: [],
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeApiResponse(rows: ReturnType<typeof makeQueueRow>[]) {
  return {
    data: rows,
    nextCursor: null,
    total: rows.length,
    todayStats: { reviewed: 0, approveRate: null as number | null },
  }
}

describe('usePendingQueue — CHG-347 SPLIT-A 抽 hook 核心 contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    // 仅 fetch 设默认持久 mock（避免初始 fetch 报 undefined.then）；其余每测试自设
    mockFetch.mockResolvedValue(makeApiResponse([]))
  })

  it('#1 enabled=true 初始 fetch → videos 填充', async () => {
    const rows = [makeQueueRow('v-1'), makeQueueRow('v-2')]
    mockFetch.mockResolvedValue(makeApiResponse(rows))

    const { result } = renderHook(() =>
      usePendingQueue(STABLE_FILTERS, { tab: 'pending', approveAndPublishOn: false, enabled: true })
    )

    await waitFor(() => expect(result.current.videos.length).toBe(2))

    expect(result.current.videos[0].id).toBe('v-1')
    expect(result.current.total).toBe(2)
    expect(result.current.nextCursor).toBeNull()
    expect(result.current.error).toBeNull()
    expect(mockFetch).toHaveBeenCalled()
  })

  it('#2 approveAt 失败 → 视频 splice 回原位置 + error 显示', async () => {
    const rows = [makeQueueRow('v-1'), makeQueueRow('v-2'), makeQueueRow('v-3')]
    mockFetch.mockResolvedValue(makeApiResponse(rows))
    mockApprove.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() =>
      usePendingQueue(STABLE_FILTERS, { tab: 'pending', approveAndPublishOn: false, enabled: true })
    )
    await waitFor(() => expect(result.current.videos.length).toBe(3))

    await act(async () => {
      try {
        await result.current.approveAt(1)
      } catch { /* approveAt 内部 catch，不会 throw 出来；这里只是兜底 */ }
    })

    expect(mockApprove).toHaveBeenCalledWith('v-2', false)
    expect(result.current.videos.map(v => v.id)).toEqual(['v-1', 'v-2', 'v-3'])
    expect(result.current.total).toBe(3)
    expect(result.current.error).not.toBeNull()
  })

  it('#3 batchApprove 成功 → 批量从队列移除 + 清 error', async () => {
    const rows = [makeQueueRow('v-1'), makeQueueRow('v-2'), makeQueueRow('v-3')]
    mockFetch.mockResolvedValue(makeApiResponse(rows))
    mockBatchApprove.mockResolvedValue({ ok: 2, failed: 0 }) // 持久 resolve

    const { result } = renderHook(() =>
      usePendingQueue(STABLE_FILTERS, { tab: 'pending', approveAndPublishOn: false, enabled: true })
    )
    await waitFor(() => expect(result.current.videos.length).toBe(3))

    let approveResult: { ok: number; failed: number } | undefined
    act(() => {
      result.current.batchApprove(['v-1', 'v-2']).then(r => { approveResult = r })
    })

    await waitFor(() => expect(result.current.videos.length).toBe(1))

    expect(approveResult).toEqual({ ok: 2, failed: 0 })
    expect(result.current.videos.map(v => v.id)).toEqual(['v-3'])
    expect(result.current.total).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('#4 refetch → fetchPendingQueue 再次触发并替换数据', async () => {
    mockFetch.mockResolvedValue(makeApiResponse([makeQueueRow('v-1')]))
    const { result } = renderHook(() =>
      usePendingQueue(STABLE_FILTERS, { tab: 'pending', approveAndPublishOn: false, enabled: true })
    )
    await waitFor(() => expect(result.current.videos.length).toBe(1))

    mockFetch.mockResolvedValue(makeApiResponse([makeQueueRow('v-100'), makeQueueRow('v-200')]))

    act(() => {
      void result.current.refetch()
    })

    await waitFor(() => expect(result.current.videos.length).toBe(2))

    expect(result.current.videos.map(v => v.id)).toEqual(['v-100', 'v-200'])
    expect(result.current.total).toBe(2)
  })
})
