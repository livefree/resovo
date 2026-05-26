/**
 * @vitest-environment jsdom
 * admin-shell-notifications.test.ts —
 * ADR-147 EP-B + ADR-155 D-155-2 EP-2 hook 单测
 *
 * 覆盖（10 用例）：
 *   #1 useAdminNotifications mount fetch → general items 填充 + category='general'
 *   #2 lastViewedAt 计算 read 状态（item.createdAt <= lastViewedAt → true）
 *   #3 markAllRead → 写 localStorage + items.read 重算
 *   #4 markOneRead → 单条 read=true（不影响其他）
 *   #5 useAdminTasks degraded=true → 暴露 degraded 状态
 *   ── ADR-155 D-155-2 EP-2 新增 ──
 *   #6 useAdminNotifications 合并 background events upcoming + finished → category='background'
 *   #7 useAdminNotifications merge 按 createdAt DESC 排序
 *   #8 useAdminTasks 合并 background events active → source='crawler'
 *   #9 useAdminTasks merge 按 startedAt DESC 排序
 *   #10 background-events 端点失败 → general items 仍正常显示（Promise.allSettled 容错）
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

/** ADR-155 D-155-2 EP-2：两端点 mock router 按 URL 路由 */
function setupRouterMock(handlers: {
  notifications?: unknown
  jobs?: unknown
  background?: unknown
}) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/admin/notifications') {
      return Promise.resolve(
        handlers.notifications ?? { data: [], meta: { total: 0, limit: 50, since: '' } },
      )
    }
    if (url === '/admin/system/jobs') {
      return Promise.resolve(
        handlers.jobs ?? {
          data: [],
          meta: { total: 0, limit: 20, since: '', queueCounts: { crawler: { waiting: 0, active: 0 }, maintenance: { waiting: 0, active: 0 } } },
        },
      )
    }
    if (url === '/admin/system/background-events') {
      return Promise.resolve(
        handlers.background ?? { data: [], meta: { total: 0, limit: 20, windowHours: 24, generatedAt: '' } },
      )
    }
    return Promise.reject(new Error(`unexpected mock URL: ${url}`))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  try { window.localStorage.clear() } catch { /* jsdom 兜底 */ }
})

describe('useAdminNotifications', () => {
  it('#1 mount fetch → items 填充 + category="general"', async () => {
    setupRouterMock({
      notifications: {
        data: [
          { id: 'n-1', title: '测试通知', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false },
        ],
        meta: { total: 1, limit: 50, since: '2026-05-13T00:00:00Z' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0]?.title).toBe('测试通知')
      expect(result.current.items[0]?.category).toBe('general')
    })
  })

  it('#2 lastViewedAt 计算 read 状态（已读判定）', async () => {
    window.localStorage.setItem('admin_notification_lastViewedAt', '2026-05-21T00:00:00.000Z')
    setupRouterMock({
      notifications: {
        data: [
          { id: 'old', title: '旧通知', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false },
          { id: 'new', title: '新通知', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
        ],
        meta: { total: 2, limit: 50, since: '2026-05-13T00:00:00Z' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    const oldItem = result.current.items.find((i) => i.id === 'old')
    const newItem = result.current.items.find((i) => i.id === 'new')
    expect(oldItem?.read).toBe(true)   // createdAt < lastViewedAt
    expect(newItem?.read).toBe(false)  // createdAt > lastViewedAt
  })

  it('#3 markAllRead → 写 localStorage + items 全部 read=true', async () => {
    setupRouterMock({
      notifications: {
        data: [
          { id: 'n-1', title: 'A', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false },
        ],
        meta: { total: 1, limit: 50, since: '2026-05-13T00:00:00Z' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.items[0]?.read).toBe(false)
    act(() => result.current.markAllRead())
    expect(window.localStorage.getItem('admin_notification_lastViewedAt')).toBeTruthy()
    expect(result.current.items[0]?.read).toBe(true)
  })

  it('#4 markOneRead → 单条 read=true（其他不变）', async () => {
    setupRouterMock({
      notifications: {
        data: [
          { id: 'a', title: 'A', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
          { id: 'b', title: 'B', level: 'info', createdAt: '2026-05-22T11:00:00Z', read: false },
        ],
        meta: { total: 2, limit: 50, since: '2026-05-13T00:00:00Z' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.markOneRead('a'))
    expect(result.current.items.find((i) => i.id === 'a')?.read).toBe(true)
    expect(result.current.items.find((i) => i.id === 'b')?.read).toBe(false)
  })

  // ── ADR-155 D-155-2 EP-2：合并 background events upcoming + finished ──
  it('#6 合并 background events upcoming + finished → category="background"', async () => {
    setupRouterMock({
      notifications: {
        data: [
          { id: 'n-1', title: '通知', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
        ],
        meta: { total: 1, limit: 50, since: '' },
      },
      background: {
        data: [
          {
            lane: 'upcoming', id: 'evt-1', kind: 'auto_crawl', status: 'scheduled', level: 'info',
            title: '下次自动采集', scheduledAt: '2026-05-23T03:00:00Z',
          },
          {
            lane: 'finished', id: 'evt-2', kind: 'crawler_run', status: 'success', level: 'info',
            title: 'crawler run success', finishedAt: '2026-05-22T09:00:00Z', runId: 'r-1', href: '/admin/crawler/runs/r-1',
          },
          // active lane 不应进入通知（→ 任务）
          {
            lane: 'active', id: 'evt-3', kind: 'crawler_run', status: 'running', level: 'info',
            title: 'active run', startedAt: '2026-05-22T08:00:00Z', runId: 'r-2', href: '/admin/crawler/runs/r-2',
          },
        ],
        meta: { total: 3, limit: 20, windowHours: 24, generatedAt: '' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items.length).toBe(3))  // 1 general + 2 background（active 排除）
    const generalItem = result.current.items.find((i) => i.id === 'n-1')
    const upcomingItem = result.current.items.find((i) => i.id === 'bg-evt-1')
    const finishedItem = result.current.items.find((i) => i.id === 'bg-evt-2')
    const activeItem = result.current.items.find((i) => i.id === 'bg-evt-3')
    expect(generalItem?.category).toBe('general')
    expect(upcomingItem?.category).toBe('background')
    expect(finishedItem?.category).toBe('background')
    expect(activeItem).toBeUndefined()  // active lane 不映射为通知
  })

  it('#7 merge 按 createdAt DESC 排序', async () => {
    setupRouterMock({
      notifications: {
        data: [
          { id: 'general-1', title: 'G1', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
        ],
        meta: { total: 1, limit: 50, since: '' },
      },
      background: {
        data: [
          {
            lane: 'upcoming', id: 'u-1', kind: 'auto_crawl', status: 'scheduled', level: 'info',
            title: 'upcoming', scheduledAt: '2026-05-23T03:00:00Z',
          },
          {
            lane: 'finished', id: 'f-1', kind: 'crawler_run', status: 'success', level: 'info',
            title: 'finished', finishedAt: '2026-05-22T05:00:00Z', runId: 'r-1', href: '/x',
          },
        ],
        meta: { total: 2, limit: 20, windowHours: 24, generatedAt: '' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items.length).toBe(3))
    const order = result.current.items.map((i) => i.id)
    expect(order).toEqual(['bg-u-1', 'general-1', 'bg-f-1'])  // 23:03 > 22:10 > 22:05
  })

  it('#G-EP2-3a markOneRead 与 bg-${id} 交互：标记 background item 单条已读', async () => {
    setupRouterMock({
      background: {
        data: [
          {
            lane: 'upcoming', id: 'bg1', kind: 'auto_crawl', status: 'scheduled', level: 'info',
            title: 'upcoming bg', scheduledAt: '2026-05-23T03:00:00Z',
          },
        ],
        meta: { total: 1, limit: 20, windowHours: 24, generatedAt: '' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items.length).toBe(1))
    expect(result.current.items[0]?.id).toBe('bg-bg1')
    expect(result.current.items[0]?.read).toBe(false)
    // markOneRead 用 background item 的完整 id（含 'bg-' 前缀）
    act(() => result.current.markOneRead('bg-bg1'))
    expect(result.current.items.find((i) => i.id === 'bg-bg1')?.read).toBe(true)
  })

  it('#G-EP2-3b lastViewedAt 对 background finished 自动 mark-read（read 计算覆盖 bg items）', async () => {
    window.localStorage.setItem('admin_notification_lastViewedAt', '2026-05-23T00:00:00.000Z')
    setupRouterMock({
      background: {
        data: [
          // finished.finishedAt 早于 lastViewedAt → 应 read=true
          {
            lane: 'finished', id: 'old-f', kind: 'crawler_run', status: 'success', level: 'info',
            title: '已完成的旧批次', finishedAt: '2026-05-22T10:00:00Z', runId: 'r-1', href: '/x',
          },
          // upcoming.scheduledAt 在未来 → read=false（永远）
          {
            lane: 'upcoming', id: 'future-u', kind: 'auto_crawl', status: 'scheduled', level: 'info',
            title: '未来事件', scheduledAt: '2026-05-25T03:00:00Z',
          },
        ],
        meta: { total: 2, limit: 20, windowHours: 24, generatedAt: '' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items.length).toBe(2))
    const finishedItem = result.current.items.find((i) => i.id === 'bg-old-f')
    const upcomingItem = result.current.items.find((i) => i.id === 'bg-future-u')
    expect(finishedItem?.read).toBe(true)  // finishedAt < lastViewedAt
    expect(upcomingItem?.read).toBe(false) // scheduledAt > lastViewedAt (未来事件永不自动已读)
  })

  it('#10 background-events 端点失败 → general items 仍正常显示（Promise.allSettled 容错）', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/admin/notifications') {
        return Promise.resolve({
          data: [
            { id: 'n-1', title: 'A', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
          ],
          meta: { total: 1, limit: 50, since: '' },
        })
      }
      if (url === '/admin/system/background-events') {
        return Promise.reject(new Error('500 background-events failed'))
      }
      return Promise.reject(new Error('unexpected'))
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items.length).toBe(1))
    expect(result.current.items[0]?.id).toBe('n-1')
    expect(result.current.items[0]?.category).toBe('general')
  })
})

describe('useAdminTasks', () => {
  it('#5 meta.degraded=true → degraded 暴露给消费方', async () => {
    setupRouterMock({
      jobs: {
        data: [],
        meta: {
          total: 0, limit: 20, since: '',
          queueCounts: { crawler: { waiting: 0, active: 0 }, maintenance: { waiting: 0, active: 0 } },
          degraded: true,
        },
      },
    })
    const { result } = renderHook(() => useAdminTasks())
    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.items).toHaveLength(0)
  })

  it('#8 合并 background events active → source="crawler"', async () => {
    setupRouterMock({
      jobs: {
        data: [
          {
            id: 't-1', title: 'general job', status: 'running',
            startedAt: '2026-05-22T08:00:00Z',
          },
        ],
        meta: { total: 1, limit: 20, since: '', queueCounts: { crawler: { waiting: 0, active: 0 }, maintenance: { waiting: 0, active: 0 } } },
      },
      background: {
        data: [
          {
            lane: 'active', id: 'r-1', kind: 'crawler_run', status: 'running', level: 'info',
            title: 'crawler running', startedAt: '2026-05-22T09:00:00Z', runId: 'r-1', href: '/x',
          },
          // upcoming/finished 不应进入任务
          {
            lane: 'upcoming', id: 'u-1', kind: 'auto_crawl', status: 'scheduled', level: 'info',
            title: 'u', scheduledAt: '2026-05-23T03:00:00Z',
          },
        ],
        meta: { total: 2, limit: 20, windowHours: 24, generatedAt: '' },
      },
    })
    const { result } = renderHook(() => useAdminTasks())
    await waitFor(() => expect(result.current.items.length).toBe(2))
    const generalTask = result.current.items.find((i) => i.id === 't-1')
    const crawlerTask = result.current.items.find((i) => i.id === 'bg-r-1')
    expect(generalTask?.source).toBe('general')
    expect(crawlerTask?.source).toBe('crawler')
    expect(crawlerTask?.status).toBe('running')
  })

  it('#9 merge 按 startedAt DESC 排序', async () => {
    setupRouterMock({
      jobs: {
        data: [
          { id: 't-old', title: 'old', status: 'running', startedAt: '2026-05-22T05:00:00Z' },
        ],
        meta: { total: 1, limit: 20, since: '', queueCounts: { crawler: { waiting: 0, active: 0 }, maintenance: { waiting: 0, active: 0 } } },
      },
      background: {
        data: [
          {
            lane: 'active', id: 'newer', kind: 'crawler_run', status: 'running', level: 'info',
            title: 'newer', startedAt: '2026-05-22T10:00:00Z', runId: 'r-1', href: '/x',
          },
        ],
        meta: { total: 1, limit: 20, windowHours: 24, generatedAt: '' },
      },
    })
    const { result } = renderHook(() => useAdminTasks())
    await waitFor(() => expect(result.current.items.length).toBe(2))
    expect(result.current.items.map((i) => i.id)).toEqual(['bg-newer', 't-old'])
  })
})
