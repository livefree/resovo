/**
 * @vitest-environment jsdom
 * admin-global-search.test.ts — SEARCH-02-C 顶栏全局搜索接线单测（ADR-200）
 *
 * 覆盖：mapAdminSearchToCommandGroups（分组/namespace id/meta/degraded/空组过滤）
 *       + useAdminGlobalSearch（debounce 合并/空查询清空/错误兜底空）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AdminSearchResponseData } from '@resovo/types'

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))

import * as apiClientMod from '../../../apps/server-next/src/lib/api-client'
import {
  mapAdminSearchToCommandGroups,
  useAdminGlobalSearch,
} from '../../../apps/server-next/src/lib/admin-global-search'

const mockGet = apiClientMod.apiClient.get as ReturnType<typeof vi.fn>

const RESP: AdminSearchResponseData = {
  query: 'gangtie',
  groups: [
    {
      kind: 'video',
      items: [
        {
          kind: 'video', id: 'v1', title: '钢铁侠 2008', href: '/admin/videos?v.f.q=钢铁侠', score: 2, reason: 'title-match',
          payload: { shortId: 'aB3kR9x1', type: 'movie', year: 2008, status: 'completed', reviewStatus: 'approved', visibilityStatus: 'public' },
        },
      ],
    },
    {
      kind: 'user',
      items: [
        { kind: 'user', id: 'u1', title: 'tony', href: '/admin/users?f.q=tony', score: 0, reason: 'field-match', payload: { username: 'tony', email: 't@x.io', role: 'admin' } },
      ],
    },
  ],
}

describe('mapAdminSearchToCommandGroups', () => {
  it('分组 + id namespace `search:kind:id` 防撞键 + href 透传', () => {
    const groups = mapAdminSearchToCommandGroups(RESP)
    expect(groups.map((g) => g.id)).toEqual(['search:video', 'search:user'])
    const video = groups[0]!.items[0]!
    expect(video.id).toBe('search:video:v1')
    expect(video.label).toBe('钢铁侠 2008')
    expect(video.kind).toBe('navigate')
    expect(video.href).toBe('/admin/videos?v.f.q=钢铁侠')
  })

  it('自然显示 meta：视频=年份·shortId / 用户=email·角色', () => {
    const groups = mapAdminSearchToCommandGroups(RESP)
    expect(groups[0]!.items[0]!.meta).toBe('2008 · aB3kR9x1')
    expect(groups[1]!.items[0]!.meta).toBe('t@x.io · 管理员')
  })

  it('映射期预存 telemetry：组内 rank 1-based + globalRank 跨组累加（D-200-10.4）', () => {
    const groups = mapAdminSearchToCommandGroups(RESP)
    // video 组第 1 项：rank=1 globalRank=1；user 组第 1 项：rank=1 globalRank=2（跨组扁平累加）
    expect(groups[0]!.items[0]!.telemetry).toEqual({ kind: 'video', rank: 1, globalRank: 1 })
    expect(groups[1]!.items[0]!.telemetry).toEqual({ kind: 'user', rank: 1, globalRank: 2 })
  })

  it('degraded 组 label 带"（部分不可用）"后缀', () => {
    const groups = mapAdminSearchToCommandGroups({
      query: 'x',
      groups: [{ kind: 'video', items: [], degraded: true }],
    })
    expect(groups[0]!.label).toBe('视频（部分不可用）')
    expect(groups[0]!.items).toEqual([])
  })

  it('空组（无 items 且非 degraded）被过滤', () => {
    const groups = mapAdminSearchToCommandGroups({
      query: 'x',
      groups: [{ kind: 'video', items: [] }, ...RESP.groups],
    })
    expect(groups.map((g) => g.id)).toEqual(['search:video', 'search:user'])
  })
})

describe('useAdminGlobalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: RESP })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounce 250ms 后调一次 /admin/search 并注入 prefilteredGroups', async () => {
    const { result } = renderHook(() => useAdminGlobalSearch())
    act(() => result.current.onQueryChange('gangtie'))
    expect(result.current.loading).toBe(true)
    expect(mockGet).not.toHaveBeenCalled() // 防抖窗口内未发
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith('/admin/search?q=gangtie', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(result.current.loading).toBe(false)
    expect(result.current.prefilteredGroups?.map((g) => g.id)).toEqual(['search:video', 'search:user'])
  })

  it('快速连打仅最后一次触发请求（debounce 合并）', async () => {
    const { result } = renderHook(() => useAdminGlobalSearch())
    act(() => result.current.onQueryChange('g'))
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    act(() => result.current.onQueryChange('gangtie'))
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith('/admin/search?q=gangtie', expect.anything())
  })

  it('空查询 → 清空 prefilteredGroups + 不发请求（防 stale）', async () => {
    const { result } = renderHook(() => useAdminGlobalSearch())
    act(() => result.current.onQueryChange('abc'))
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(result.current.prefilteredGroups).toBeDefined()
    mockGet.mockClear()
    act(() => result.current.onQueryChange(''))
    expect(result.current.prefilteredGroups).toBeUndefined()
    expect(result.current.loading).toBe(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('请求错误 → prefilteredGroups 兜底空数组（不崩 shell）', async () => {
    mockGet.mockRejectedValue(new Error('es down'))
    const { result } = renderHook(() => useAdminGlobalSearch())
    act(() => result.current.onQueryChange('abc'))
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(result.current.loading).toBe(false)
    expect(result.current.prefilteredGroups).toEqual([])
  })

  it('旧在途请求在新输入后、abort 窗口前 resolve → 丢弃 stale（Codex stop-time review 回归）', async () => {
    // A 请求挂起（手动 resolve），模拟「T_a 已触发、A 在途、尚未被下一个 setTimeout abort」
    let resolveA: ((v: unknown) => void) | undefined
    const STALE = {
      data: { query: 'a', groups: [{ kind: 'video', items: [{ kind: 'video', id: 'stale', title: 'STALE', href: '/x', score: 1, reason: 'fuzzy', payload: { shortId: 's', type: 'movie', year: null, status: 'completed', reviewStatus: 'approved', visibilityStatus: 'public' } }] }] },
    }
    mockGet
      .mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
      .mockResolvedValueOnce({ data: RESP })

    const { result } = renderHook(() => useAdminGlobalSearch())
    act(() => result.current.onQueryChange('a'))
    await act(async () => { await vi.advanceTimersByTimeAsync(250) }) // T_a fires → fetch A 在途（ctrlA 未 abort）
    act(() => result.current.onQueryChange('ab')) // token 推进；T_ab 计划中，ctrlA 仍未 abort

    // A 在 abort 窗口前 resolve → token 已 stale → 必须丢弃（旧代码靠 signal.aborted 会误提交 STALE）
    await act(async () => { resolveA?.(STALE); await Promise.resolve() })
    expect(result.current.prefilteredGroups).toBeUndefined()

    // T_ab 触发 → B resolve → 提交最新结果
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(result.current.prefilteredGroups?.[0]?.id).toBe('search:video')
  })
})
