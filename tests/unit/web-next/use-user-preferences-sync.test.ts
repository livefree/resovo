/**
 * @vitest-environment jsdom
 *
 * use-user-preferences-sync.test.ts — CHG-SN-9-ROUTE-LABEL-D-A2 / ADR-165
 *
 * 覆盖 useUserPreferencesSync hook 核心 contract：
 *   #1 mount 试探性 GET 成功 + server 有值 → onRemoteValue 触发
 *   #2 mount GET 成功 + server 该 sectionKey 空 + 本地非空 → 登录迁移 PUT 本地值
 *   #3 mount GET 401 → 静默降级 / 不触发 onRemoteValue / 不写 sessionStorage 失败标记
 *   #4 putValue 触发 debounce 500ms → 最终 PUT
 *   #5 多次快速 putValue → 仅最后一次 fire（debounce clearTimeout 覆盖）
 *   #6 putValue 失败（500）→ 写 sessionStorage lastSyncFailedAt
 *   #7 syncing：mount 进行中=true / 完成=false
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock apiClient before import hook
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client')
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { apiClient, ApiClientError } from '@/lib/api-client'
import { useUserPreferencesSync } from '@/lib/use-user-preferences-sync'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPut = apiClient.put as ReturnType<typeof vi.fn>

const SECTION_KEY = 'routeTheme'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  try { sessionStorage.clear() } catch { /* ignore */ }
})

describe('useUserPreferencesSync — ADR-165 mount GET + debounce PUT', () => {
  it('#1 mount 试探性 GET 成功 + server 有值 → onRemoteValue 触发', async () => {
    mockGet.mockResolvedValue({ data: { routeTheme: { themeId: 'nato' } } })
    mockPut.mockResolvedValue(undefined)
    const onRemoteValue = vi.fn()

    renderHook(() =>
      useUserPreferencesSync({ sectionKey: SECTION_KEY, localValue: { themeId: 'jie_qi' }, onRemoteValue })
    )

    await waitFor(() => expect(onRemoteValue).toHaveBeenCalledWith({ themeId: 'nato' }))
    expect(mockGet).toHaveBeenCalledWith('/users/me/preferences')
    expect(mockPut).not.toHaveBeenCalled()  // 不触发登录迁移 PUT
  })

  it('#2 mount GET 成功 + server sectionKey 空 + 本地非空 → 登录迁移 PUT 本地值', async () => {
    mockGet.mockResolvedValue({ data: {} })  // server 空
    mockPut.mockResolvedValue(undefined)
    const onRemoteValue = vi.fn()

    renderHook(() =>
      useUserPreferencesSync({ sectionKey: SECTION_KEY, localValue: { themeId: 'jie_qi' }, onRemoteValue })
    )

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/users/me/preferences', { routeTheme: { themeId: 'jie_qi' } })
    )
    expect(onRemoteValue).not.toHaveBeenCalled()
  })

  it('#3 mount GET 401 → 静默降级 / 不触发 onRemoteValue / 不写 sessionStorage 失败标记', async () => {
    mockGet.mockRejectedValue(new ApiClientError('INVALID_TOKEN', '未登录', 401))
    const onRemoteValue = vi.fn()

    const { result } = renderHook(() =>
      useUserPreferencesSync({ sectionKey: SECTION_KEY, localValue: { themeId: 'jie_qi' }, onRemoteValue })
    )

    await waitFor(() => expect(result.current.syncing).toBe(false))
    expect(onRemoteValue).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('resovo:prefs-sync-failed-at')).toBeNull()
  })

  it('#4 putValue 触发 debounce 500ms → 最终 PUT', async () => {
    mockGet.mockResolvedValue({ data: {} })
    mockPut.mockResolvedValue(undefined)
    const onRemoteValue = vi.fn()

    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useUserPreferencesSync({ sectionKey: SECTION_KEY, localValue: null, onRemoteValue })
    )

    // 等 mount GET 完成（promise microtask）+ unwait timers
    await vi.runOnlyPendingTimersAsync()

    act(() => {
      result.current.putValue({ themeId: 'nato' })
    })

    // 500ms 内 PUT 还没 fire
    vi.advanceTimersByTime(499)
    expect(mockPut).not.toHaveBeenCalledWith('/users/me/preferences', { routeTheme: { themeId: 'nato' } })

    // 跨过 500ms 阈值
    await vi.advanceTimersByTimeAsync(2)
    expect(mockPut).toHaveBeenCalledWith('/users/me/preferences', { routeTheme: { themeId: 'nato' } })

    vi.useRealTimers()
  })

  it('#5 多次快速 putValue → 仅最后一次 fire（debounce clearTimeout 覆盖）', async () => {
    mockGet.mockResolvedValue({ data: {} })
    mockPut.mockResolvedValue(undefined)
    const onRemoteValue = vi.fn()

    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useUserPreferencesSync({ sectionKey: SECTION_KEY, localValue: null, onRemoteValue })
    )
    await vi.runOnlyPendingTimersAsync()
    mockPut.mockClear()  // 清掉可能的登录迁移 PUT 计数

    act(() => { result.current.putValue({ themeId: 'a' }) })
    vi.advanceTimersByTime(200)
    act(() => { result.current.putValue({ themeId: 'b' }) })
    vi.advanceTimersByTime(200)
    act(() => { result.current.putValue({ themeId: 'c' }) })

    await vi.advanceTimersByTimeAsync(600)

    const putCalls = mockPut.mock.calls.filter(
      (c) => (c[0] as string) === '/users/me/preferences'
        && (c[1] as { routeTheme?: { themeId?: string } })?.routeTheme?.themeId !== undefined,
    )
    expect(putCalls).toHaveLength(1)
    expect(putCalls[0][1]).toEqual({ routeTheme: { themeId: 'c' } })

    vi.useRealTimers()
  })

  it('#6 putValue 失败（500）→ 写 sessionStorage lastSyncFailedAt', async () => {
    mockGet.mockResolvedValue({ data: {} })
    mockPut.mockRejectedValue(new ApiClientError('INTERNAL_ERROR', '服务器错误', 500))
    const onRemoteValue = vi.fn()

    const { result } = renderHook(() =>
      useUserPreferencesSync({ sectionKey: SECTION_KEY, localValue: null, onRemoteValue })
    )

    await waitFor(() => expect(result.current.syncing).toBe(false))

    act(() => { result.current.putValue({ themeId: 'nato' }) })

    await waitFor(() => expect(sessionStorage.getItem('resovo:prefs-sync-failed-at')).not.toBeNull(), { timeout: 1500 })
  })

  it('#7 syncing：mount 进行中=true / 完成=false', async () => {
    // 永不 resolve 的 promise 测试中间态
    let resolveGet: (value: unknown) => void = () => { /* noop */ }
    mockGet.mockReturnValue(new Promise((resolve) => { resolveGet = resolve }))
    const onRemoteValue = vi.fn()

    const { result } = renderHook(() =>
      useUserPreferencesSync({ sectionKey: SECTION_KEY, localValue: null, onRemoteValue })
    )

    await waitFor(() => expect(result.current.syncing).toBe(true))
    expect(result.current.syncing).toBe(true)

    act(() => { resolveGet({ data: {} }) })

    await waitFor(() => expect(result.current.syncing).toBe(false))
  })
})
