/**
 * @vitest-environment jsdom
 * admin-shell-notifications.test.ts —
 * ADR-147 EP-B + ADR-155 D-155-2 EP-2 hook 单测
 *
 * 覆盖（10 用例）：
 *   #1 useAdminNotifications mount fetch → general items 填充 + category='general'
 *   #2 服务端 meta.readAt 计算 read 状态（item.createdAt <= readAt → true；NTLG-P1-c-C 替 localStorage）
 *   #3 markAllRead → POST /admin/notifications/read + 乐观 readAt + reload 重算
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
  apiClient: { get: vi.fn(), post: vi.fn() },
  ApiClientError: class ApiClientError extends Error {
    constructor(public status: number, message: string) {
      super(message)
    }
  },
}))

// NTLG-P2-c-B-2：useAdminNotifications 新增 SSE effect → mock 为 no-op controller
// （不调 onStateChange → sseConnected 恒 false → 走 60s 轮询，等价旧行为；SSE 客户端自有单测覆盖）
vi.mock('../../../apps/server-next/src/lib/notification-stream-client', () => ({
  connectNotificationStream: vi.fn(() => ({ close: vi.fn() })),
}))

import * as apiClientMod from '../../../apps/server-next/src/lib/api-client'
import { connectNotificationStream } from '../../../apps/server-next/src/lib/notification-stream-client'
import {
  useAdminNotifications,
  useAdminTasks,
} from '../../../apps/server-next/src/lib/admin-shell-notifications'

const mockGet = apiClientMod.apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClientMod.apiClient.post as ReturnType<typeof vi.fn>
const mockConnect = connectNotificationStream as ReturnType<typeof vi.fn>

/** ADR-155 D-155-2 EP-2：两端点 mock router 按 URL 路由 */
function setupRouterMock(handlers: {
  notifications?: unknown
  jobs?: unknown
  background?: unknown
  unreadCount?: unknown
}) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/admin/notifications') {
      return Promise.resolve(
        handlers.notifications ?? { data: [], meta: { total: 0, limit: 50, since: '', readAt: '' } },
      )
    }
    // ADR-196 D-196-5②：红点 unread-count 端点（reload 第三路）；默认 count=0
    if (url === '/admin/notifications/unread-count') {
      return Promise.resolve(handlers.unreadCount ?? { data: { count: 0 }, meta: { scope: 'self' } })
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

  it('#2 服务端 meta.readAt 计算 read 状态（已读判定；替 localStorage）', async () => {
    setupRouterMock({
      notifications: {
        data: [
          { id: 'old', title: '旧通知', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false },
          { id: 'new', title: '新通知', level: 'info', createdAt: '2026-05-22T10:00:00Z', read: false },
        ],
        meta: { total: 2, limit: 50, since: '2026-05-13T00:00:00Z', readAt: '2026-05-21T00:00:00.000Z' },
      },
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    const oldItem = result.current.items.find((i) => i.id === 'old')
    const newItem = result.current.items.find((i) => i.id === 'new')
    expect(oldItem?.read).toBe(true)   // createdAt <= readAt
    expect(newItem?.read).toBe(false)  // createdAt > readAt
  })

  it('#3 markAllRead → POST /admin/notifications/read + 乐观 readAt + reload 重算（替 localStorage）', async () => {
    // 服务端 cursor 持久：初始 readAt='' 全未读，POST 后服务端 readAt 推进 → reload 后已读
    let serverReadAt = ''
    mockGet.mockImplementation((url: string) => {
      if (url === '/admin/notifications') {
        return Promise.resolve({
          data: [{ id: 'n-1', title: 'A', level: 'info', createdAt: '2026-05-20T10:00:00Z', read: false }],
          meta: { total: 1, limit: 50, since: '2026-05-13T00:00:00Z', readAt: serverReadAt },
        })
      }
      if (url === '/admin/system/background-events') {
        return Promise.resolve({ data: [], meta: { total: 0, limit: 20, windowHours: 24, generatedAt: '' } })
      }
      if (url === '/admin/notifications/unread-count') {
        return Promise.resolve({ data: { count: 0 }, meta: { scope: 'self' } })
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    mockPost.mockImplementation((url: string) => {
      if (url === '/admin/notifications/read') {
        serverReadAt = '2026-05-25T00:00:00.000Z'
        return Promise.resolve({ data: { readAt: serverReadAt } })
      }
      return Promise.reject(new Error(`unexpected post ${url}`))
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.items[0]?.read).toBe(false)
    await act(async () => { result.current.markAllRead() })
    expect(mockPost).toHaveBeenCalledWith('/admin/notifications/read', {})
    await waitFor(() => expect(result.current.items[0]?.read).toBe(true))
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

  it('#G-EP2-3b 服务端 readAt 对 background finished 自动 mark-read（read 计算覆盖 bg items）', async () => {
    setupRouterMock({
      // readAt 来自 general list meta（即使 general data 空，readAt 仍驱动 background read 计算）
      notifications: { data: [], meta: { total: 0, limit: 50, since: '', readAt: '2026-05-23T00:00:00.000Z' } },
      background: {
        data: [
          // finished.finishedAt 早于 readAt → 应 read=true
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
    expect(finishedItem?.read).toBe(true)  // finishedAt <= readAt
    expect(upcomingItem?.read).toBe(false) // scheduledAt > readAt (未来事件永不自动已读)
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
      if (url === '/admin/notifications/unread-count') {
        return Promise.resolve({ data: { count: 0 }, meta: { scope: 'self' } })
      }
      return Promise.reject(new Error('unexpected'))
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items.length).toBe(1))
    expect(result.current.items[0]?.id).toBe('n-1')
    expect(result.current.items[0]?.category).toBe('general')
  })

  it('#11 unread-count 端点 → unreadCount 初始值（红点数据源 / ADR-196 D-196-5②）', async () => {
    setupRouterMock({ unreadCount: { data: { count: 5 }, meta: { scope: 'self' } } })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.unreadCount).toBe(5))
  })

  it('#12 SSE onUnread(count) → unreadCount 实时更新（不丢 count / 必做修订2）', async () => {
    setupRouterMock({})
    let captured: { onUnread: (n: number) => void } | undefined
    mockConnect.mockImplementation((handlers: { onUnread: (n: number) => void }) => {
      captured = handlers
      return { close: vi.fn() }
    })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(captured).toBeDefined())
    act(() => { captured?.onUnread(7) })
    await waitFor(() => expect(result.current.unreadCount).toBe(7))
    // 恢复默认 no-op controller，防 mockImpl 泄漏到后续用例
    mockConnect.mockImplementation(() => ({ close: vi.fn() }))
  })

  // ── NTLG-NTF-DISMISS-C1（ADR-197）：dismiss/dismissAll 乐观移除 + 端点 + reload ──

  const DISMISS_FIXTURE = {
    notifications: {
      data: [
        { id: '101', title: '系统通知', level: 'info', createdAt: '2026-06-10T03:00:00Z', read: false },
      ],
      meta: { total: 1, limit: 50, since: '2026-06-03T00:00:00Z' },
    },
    background: {
      data: [
        { id: 'audit:7', lane: 'finished', title: '高危审计', description: 'x', level: 'danger', finishedAt: '2026-06-10T02:00:00Z' },
      ],
      meta: { total: 1, limit: 20, windowHours: 24, generatedAt: '' },
    },
  }

  it('#d1 dismiss(itemKey) → 乐观移除 general 项 + POST /admin/notifications/dismiss + reload', async () => {
    setupRouterMock(DISMISS_FIXTURE)
    mockPost.mockResolvedValue({ data: { dismissed: 1 } })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    await act(async () => { result.current.dismiss('101') })
    expect(mockPost).toHaveBeenCalledWith('/admin/notifications/dismiss', { itemKey: '101' })
    // reload 后 mock 仍返回该项（服务端 mock 不感知 dismiss），但乐观移除已生效过；
    // 这里验证 POST 契约 + 不 throw。bg 项移除走 #d2 双 filter。
  })

  it('#d2 dismissAll(itemKeys) → 双源（general+background）乐观移除 + POST dismiss-batch', async () => {
    setupRouterMock(DISMISS_FIXTURE)
    let posted = false
    mockPost.mockImplementation(() => { posted = true; return new Promise(() => { /* pending：冻结 reload，观察乐观态 */ }) })
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => { result.current.dismissAll(['101', 'bg-audit:7']) })
    // POST pending 中（不 resolve → 不 reload），断言乐观移除：双 split-state filter 后 items 清空
    expect(posted).toBe(true)
    expect(mockPost).toHaveBeenCalledWith('/admin/notifications/dismiss-batch', { itemKeys: ['101', 'bg-audit:7'] })
    await waitFor(() => expect(result.current.items).toHaveLength(0))
  })

  it('#d3 dismiss POST 失败 → warn 降级不 throw（乐观态保持，下次 reload 校正）', async () => {
    setupRouterMock(DISMISS_FIXTURE)
    mockPost.mockRejectedValue(new Error('network down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* 静音 */ })
    try {
      const { result } = renderHook(() => useAdminNotifications())
      await waitFor(() => expect(result.current.items).toHaveLength(2))
      await act(async () => { result.current.dismiss('101') })
      await waitFor(() => expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dismiss failed'),
        expect.any(Error),
      ))
      // 乐观移除生效（POST 失败不回滚，等下次 reload 服务端权威态校正）
      expect(result.current.items.find((i) => i.id === '101')).toBeUndefined()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('#d4 dismissAll([]) → 不发请求（空数组 guard，规避端点 min(1) 422）', async () => {
    setupRouterMock(DISMISS_FIXTURE)
    const { result } = renderHook(() => useAdminNotifications())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => { result.current.dismissAll([]) })
    expect(mockPost).not.toHaveBeenCalled()
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

  // ── NTLG-NTF-DISMISS-C2（ADR-197）：任务侧 dismiss/dismissAll ──

  const TASK_DISMISS_FIXTURE = {
    jobs: {
      data: [
        { id: 'taskrun-9', title: '终态任务', status: 'success', startedAt: '2026-06-10T03:00:00Z', finishedAt: '2026-06-10T03:05:00Z' },
        { id: 'taskrun-10', title: '失败任务', status: 'failed', startedAt: '2026-06-10T02:00:00Z', finishedAt: '2026-06-10T02:01:00Z' },
      ],
      meta: { total: 2, limit: 20, since: '', queueCounts: { crawler: { waiting: 0, active: 0 }, maintenance: { waiting: 0, active: 0 } } },
    },
  }

  it('#t-d1 dismiss(itemKey) → 乐观移除 + POST /admin/notifications/dismiss（同通知抽屉 2 端点，item_key 跨源）', async () => {
    setupRouterMock(TASK_DISMISS_FIXTURE)
    let posted = false
    mockPost.mockImplementation(() => { posted = true; return new Promise(() => { /* pending：冻结 reload，观察乐观态 */ }) })
    const { result } = renderHook(() => useAdminTasks())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => { result.current.dismiss('taskrun-9') })
    expect(posted).toBe(true)
    expect(mockPost).toHaveBeenCalledWith('/admin/notifications/dismiss', { itemKey: 'taskrun-9' })
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['taskrun-10']))
  })

  it('#t-d2 dismissAll(itemKeys) → 乐观移除全部 + POST dismiss-batch', async () => {
    setupRouterMock(TASK_DISMISS_FIXTURE)
    mockPost.mockImplementation(() => new Promise(() => { /* pending */ }))
    const { result } = renderHook(() => useAdminTasks())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => { result.current.dismissAll(['taskrun-9', 'taskrun-10']) })
    expect(mockPost).toHaveBeenCalledWith('/admin/notifications/dismiss-batch', { itemKeys: ['taskrun-9', 'taskrun-10'] })
    await waitFor(() => expect(result.current.items).toHaveLength(0))
  })

  it('#t-d3 dismiss POST 失败 → warn 降级不 throw', async () => {
    setupRouterMock(TASK_DISMISS_FIXTURE)
    mockPost.mockRejectedValue(new Error('network down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* 静音 */ })
    try {
      const { result } = renderHook(() => useAdminTasks())
      await waitFor(() => expect(result.current.items).toHaveLength(2))
      await act(async () => { result.current.dismiss('taskrun-9') })
      await waitFor(() => expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dismiss failed'),
        expect.any(Error),
      ))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('#t-d4 dismissAll([]) → 不发请求（空数组 guard）', async () => {
    setupRouterMock(TASK_DISMISS_FIXTURE)
    const { result } = renderHook(() => useAdminTasks())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => { result.current.dismissAll([]) })
    expect(mockPost).not.toHaveBeenCalled()
  })
})
