// @vitest-environment jsdom

/**
 * use-review-history.test.ts — useReviewHistory hook 单元测试（CHG-SN-4-FIX-C）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../../../apps/server-next/src/lib/moderation/api', () => ({
  fetchVideoAuditLog: vi.fn(),
}))

import * as api from '../../../../apps/server-next/src/lib/moderation/api'
import { useReviewHistory } from '../../../../apps/server-next/src/lib/moderation/use-review-history'
import type { AuditLogQueryRow } from '../../../../apps/server-next/src/lib/moderation/api'

function makeEvent(overrides: Partial<AuditLogQueryRow> = {}): AuditLogQueryRow {
  return {
    id: '1',
    actorId: 'u1',
    actorUsername: 'alice',
    actionType: 'video.approve',
    targetKind: 'video',
    targetId: 'v1',
    beforeJsonb: null,
    afterJsonb: null,
    requestId: null,
    createdAt: '2026-05-02T00:00:00Z',
    ...overrides,
  }
}

describe('useReviewHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('videoId=null → 不发请求，state 保持空', async () => {
    const { result } = renderHook(() => useReviewHistory(null))
    expect(result.current[0].events).toEqual([])
    expect(result.current[0].loading).toBe(false)
    expect(api.fetchVideoAuditLog).not.toHaveBeenCalled()
  })

  it('videoId 提供 → 自动加载首页 → events / total / page 写入', async () => {
    const events = [makeEvent({ id: '1' }), makeEvent({ id: '2', actionType: 'video.reject_labeled' })]
    vi.mocked(api.fetchVideoAuditLog).mockResolvedValueOnce({
      data: events,
      pagination: { total: 2, page: 1, limit: 20, hasNext: false },
    })

    const { result } = renderHook(() => useReviewHistory('v1'))

    await waitFor(() => {
      expect(result.current[0].loading).toBe(false)
    })

    expect(result.current[0].events).toHaveLength(2)
    expect(result.current[0].total).toBe(2)
    expect(result.current[0].page).toBe(1)
    expect(result.current[0].error).toBeNull()
    expect(api.fetchVideoAuditLog).toHaveBeenCalledWith('v1', 1, 20)
  })

  it('fetchVideoAuditLog 失败 → error="加载失败"，loading=false', async () => {
    vi.mocked(api.fetchVideoAuditLog).mockRejectedValueOnce(new Error('network'))

    const { result } = renderHook(() => useReviewHistory('v1'))

    await waitFor(() => {
      expect(result.current[0].loading).toBe(false)
    })

    expect(result.current[0].error).toBe('加载失败')
    expect(result.current[0].events).toEqual([])
  })

  it('loadPage(2) → 切到第 2 页 + 携带正确 page param', async () => {
    vi.mocked(api.fetchVideoAuditLog)
      .mockResolvedValueOnce({
        data: [makeEvent({ id: '1' })],
        pagination: { total: 25, page: 1, limit: 20, hasNext: true },
      })
      .mockResolvedValueOnce({
        data: [makeEvent({ id: '21' })],
        pagination: { total: 25, page: 2, limit: 20, hasNext: false },
      })

    const { result } = renderHook(() => useReviewHistory('v1'))

    await waitFor(() => {
      expect(result.current[0].page).toBe(1)
    })

    await act(async () => {
      await result.current[1].loadPage(2)
    })

    expect(api.fetchVideoAuditLog).toHaveBeenLastCalledWith('v1', 2, 20)
    expect(result.current[0].page).toBe(2)
    expect(result.current[0].hasNext).toBe(false)
  })

  it('videoId 切换 → 自动重置 events 并加载新视频', async () => {
    vi.mocked(api.fetchVideoAuditLog)
      .mockResolvedValueOnce({
        data: [makeEvent({ id: '1', targetId: 'v1' })],
        pagination: { total: 1, page: 1, limit: 20, hasNext: false },
      })
      .mockResolvedValueOnce({
        data: [makeEvent({ id: '99', targetId: 'v2' })],
        pagination: { total: 1, page: 1, limit: 20, hasNext: false },
      })

    const { result, rerender } = renderHook(({ id }) => useReviewHistory(id), {
      initialProps: { id: 'v1' as string | null },
    })

    await waitFor(() => {
      expect(result.current[0].events[0]?.targetId).toBe('v1')
    })

    rerender({ id: 'v2' })

    await waitFor(() => {
      expect(result.current[0].events[0]?.targetId).toBe('v2')
    })

    expect(api.fetchVideoAuditLog).toHaveBeenCalledTimes(2)
  })
})
