/**
 * @vitest-environment jsdom
 * admin-shell-notifications.test.ts —
 * ADR-147 EP-B / CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B hook 单测
 *
 * 覆盖（5 用例）：
 *   #1 useAdminNotifications mount fetch → items 填充
 *   #2 lastViewedAt 计算 read 状态（item.createdAt <= lastViewedAt → true）
 *   #3 markAllRead → 写 localStorage + items.read 重算为 true
 *   #4 markOneRead → 单条 read=true（不影响其他）
 *   #5 useAdminTasks degraded=true → 暴露 degraded 状态
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
  ApiClientError: class ApiClientError extends Error {
    constructor(public status: number, message: string) {
      super(message)
    }
  },
}))

import * as apiClientMod from '../../../apps/server-next/src/lib/api-client'
import {
  useAdminNotifications,
  useAdminTasks,
} from '../../../apps/server-next/src/lib/admin-shell-notifications'

const mockGet = apiClientMod.apiClient.get as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  try { window.localStorage.clear() } catch { /* jsdom 兜底 */ }
})

describe('useAdminNotifications', () => {
  it('#1 mount fetch → items 填充', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'n-1', title: '测试通知', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false },
      ],
      meta: { total: 1, limit: 50, since: '2026-05-13T00:00:00Z' },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0]?.title).toBe('测试通知')
    })
    expect(mockGet).toHaveBeenCalledWith('/admin/notifications')
  })

  it('#2 lastViewedAt 计算 read 状态（已读判定）', async () => {
    window.localStorage.setItem('admin_notification_lastViewedAt', '2026-05-21T00:00:00.000Z')
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'old', title: '旧通知', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false },
        { id: 'new', title: '新通知', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
      ],
      meta: { total: 2, limit: 50, since: '2026-05-13T00:00:00Z' },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    const oldItem = result.current.items.find((i) => i.id === 'old')
    const newItem = result.current.items.find((i) => i.id === 'new')
    expect(oldItem?.read).toBe(true)   // createdAt < lastViewedAt
    expect(newItem?.read).toBe(false)  // createdAt > lastViewedAt
  })

  it('#3 markAllRead → 写 localStorage + items 全部 read=true', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'n-1', title: 'A', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false },
      ],
      meta: { total: 1, limit: 50, since: '2026-05-13T00:00:00Z' },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.items[0]?.read).toBe(false)
    act(() => result.current.markAllRead())
    expect(window.localStorage.getItem('admin_notification_lastViewedAt')).toBeTruthy()
    expect(result.current.items[0]?.read).toBe(true)
  })

  it('#4 markOneRead → 单条 read=true（其他不变）', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'a', title: 'A', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
        { id: 'b', title: 'B', level: 'info', createdAt: '2026-05-22T11:00:00Z', read: false },
      ],
      meta: { total: 2, limit: 50, since: '2026-05-13T00:00:00Z' },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.markOneRead('a'))
    expect(result.current.items.find((i) => i.id === 'a')?.read).toBe(true)
    expect(result.current.items.find((i) => i.id === 'b')?.read).toBe(false)
  })
})

describe('useAdminTasks', () => {
  it('#5 meta.degraded=true → degraded 暴露给消费方', async () => {
    mockGet.mockResolvedValueOnce({
      data: [],
      meta: {
        total: 0,
        limit: 20,
        since: '2026-05-20T00:00:00Z',
        queueCounts: { crawler: { waiting: 0, active: 0 }, maintenance: { waiting: 0, active: 0 } },
        degraded: true,
      },
    })
    const { result } = renderHook(() => useAdminTasks())
    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.items).toHaveLength(0)
  })
})
