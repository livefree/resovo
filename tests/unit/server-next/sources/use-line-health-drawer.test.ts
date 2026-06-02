// @vitest-environment jsdom
/**
 * use-line-health-drawer.test.ts — 共享 health drawer hook 单测
 * （CHG-VSR-6-FOLLOWUP-DRAWER-HOOK / arch-reviewer 蓝图 U-1..U-10）
 *
 * 覆盖：open 取数 / 切源 stale 丢弃(R-1) / close 后不回写(R-2) / 翻页 stale /
 *       分页阈值 total>limit + limit 取响应真值(R-6) / error(注入 vs 省略) + retry /
 *       同源重入刷新 / sourceId=null no-op / stale reject 不污染 error。
 *
 * fetchHealth 注入 → 无需 mock api 模块，直接受控 Promise。沿用 controller 测试范式
 * （相对路径 + @vitest-environment jsdom + renderHook/act）。
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { SourceHealthEvent } from '@resovo/types'
import { useLineHealthDrawer } from '../../../../apps/server-next/src/lib/sources/use-line-health-drawer'
import type { LineHealthPage } from '../../../../apps/server-next/src/lib/sources/api'

// ── 受控 Promise 工具 ─────────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e?: unknown) => void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function makeFetch() {
  const calls: Deferred<LineHealthPage>[] = []
  const args: Array<{ sourceId: string; page?: number }> = []
  const fn = vi.fn((sourceId: string, page?: number) => {
    args.push({ sourceId, page })
    const d = deferred<LineHealthPage>()
    calls.push(d)
    return d.promise
  })
  return { fn, calls, args }
}

function page(opts: { events?: number; total: number; limit?: number; pageNum?: number }): LineHealthPage {
  const { events = 0, total, limit = 20, pageNum = 1 } = opts
  return {
    data: Array.from({ length: events }, (_, i) => ({ id: `ev-${i}` })) as unknown as SourceHealthEvent[],
    pagination: { total, page: pageNum, limit, hasNext: pageNum * limit < total },
  }
}

// flush microtasks within act
async function flush() {
  await act(async () => { await Promise.resolve() })
}

// ── U-1 open 拉第 1 页 ────────────────────────────────────────────────

describe('useLineHealthDrawer — open', () => {
  it('U-1 open → loading + sourceId；resolve 后回填 events/total/limit + open=true', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))

    act(() => { result.current[1].open('src-A') })
    expect(result.current[0].sourceId).toBe('src-A')
    expect(result.current[0].open).toBe(true)
    expect(result.current[0].loading).toBe(true)
    expect(fn).toHaveBeenCalledWith('src-A', 1)

    await act(async () => { calls[0].resolve(page({ events: 3, total: 3, limit: 20 })) })
    expect(result.current[0].loading).toBe(false)
    expect(result.current[0].events).toHaveLength(3)
    expect(result.current[0].total).toBe(3)
    expect(result.current[0].limit).toBe(20)
  })

  it('U-8 同源重入 → 再次 fetchHealth(A,1)（不短路）', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    await act(async () => { calls[0].resolve(page({ events: 1, total: 1 })) })
    act(() => { result.current[1].open('src-A') })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('src-A', 1)
  })
})

// ── 并发竞态（R-1 / R-2）────────────────────────────────────────────────

describe('useLineHealthDrawer — 并发竞态保护', () => {
  it('U-2 切源 stale 丢弃：open A 未决 → open B → A 延迟 resolve 不覆盖 B', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    act(() => { result.current[1].open('src-B') })
    expect(result.current[0].sourceId).toBe('src-B')

    // A（calls[0]）延迟 resolve → stale 丢弃
    await act(async () => { calls[0].resolve(page({ events: 9, total: 9 })) })
    expect(result.current[0].events).toHaveLength(0) // 未被 A 覆盖
    // B（calls[1]）resolve → 生效
    await act(async () => { calls[1].resolve(page({ events: 2, total: 2 })) })
    expect(result.current[0].events).toHaveLength(2)
    expect(result.current[0].sourceId).toBe('src-B')
  })

  it('U-3 close 后响应不回写', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    act(() => { result.current[1].close() })
    expect(result.current[0].open).toBe(false)
    await act(async () => { calls[0].resolve(page({ events: 5, total: 5 })) })
    expect(result.current[0].open).toBe(false)
    expect(result.current[0].events).toHaveLength(0)
  })

  it('U-4 翻页 stale：changePage 2 未决 → changePage 3 → 2 延迟 resolve 用 3 的结果', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    await act(async () => { calls[0].resolve(page({ events: 1, total: 100, pageNum: 1 })) })
    act(() => { result.current[1].changePage(2) })
    act(() => { result.current[1].changePage(3) })
    await act(async () => { calls[1].resolve(page({ events: 2, total: 100, pageNum: 2 })) }) // page2 stale
    expect(result.current[0].page).not.toBe(2)
    await act(async () => { calls[2].resolve(page({ events: 3, total: 100, pageNum: 3 })) })
    expect(result.current[0].page).toBe(3)
    expect(result.current[0].events).toHaveLength(3)
  })

  it('U-10 stale reject 不污染 error', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn, loadFailedText: '失败' }))
    act(() => { result.current[1].open('src-A') })
    act(() => { result.current[1].open('src-B') })
    await act(async () => { calls[0].reject(new Error('A failed')) }) // A stale reject
    expect(result.current[0].error).toBeNull()
    expect(result.current[0].loading).toBe(true) // B 仍在 loading
  })
})

// ── 分页阈值（R-6）─────────────────────────────────────────────────────

describe('useLineHealthDrawer — 分页 total>limit（limit 取响应真值）', () => {
  it('U-5a total<=limit → pagination=undefined', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    await act(async () => { calls[0].resolve(page({ events: 20, total: 20, limit: 20 })) })
    expect(result.current[0].pagination).toBeUndefined()
  })

  it('U-5b total>limit → pagination 非空 + 字段正确', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    await act(async () => { calls[0].resolve(page({ events: 20, total: 21, limit: 20 })) })
    expect(result.current[0].pagination).toEqual(
      expect.objectContaining({ page: 1, total: 21, limit: 20 }),
    )
    expect(typeof result.current[0].pagination?.onPageChange).toBe('function')
  })

  it('U-5c limit 取响应真值（50）非硬编码 20：total=30 limit=50 → pagination=undefined', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    await act(async () => { calls[0].resolve(page({ events: 30, total: 30, limit: 50 })) })
    expect(result.current[0].limit).toBe(50)
    expect(result.current[0].pagination).toBeUndefined() // 30 <= 50（若硬编码 20 则会误显分页）
  })
})

// ── error 态（注入 vs 省略 loadFailedText）──────────────────────────────

describe('useLineHealthDrawer — error 态', () => {
  it('U-6 loadFailedText 提供 → reject 显 error；retry 重取「失败的尝试页」(2 非 1) → 清 error', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn, loadFailedText: '加载失败' }))
    act(() => { result.current[1].open('src-A') })
    await act(async () => { calls[0].resolve(page({ events: 1, total: 100, pageNum: 1 })) })
    act(() => { result.current[1].changePage(2) })
    await act(async () => { calls[1].reject(new Error('boom')) }) // 翻第 2 页失败
    expect(result.current[0].error).toBe('加载失败')
    expect(result.current[0].loading).toBe(false)
    expect(result.current[0].page).toBe(2) // 失败页仍记为 2（立即设页 / Codex review 修复）

    act(() => { result.current[1].retry() })
    // 回归守卫：retry 重取「用户尝试的失败页」= 2，非「上次成功页」1（旧实现 .then 才设 page 的 bug）
    expect(fn).toHaveBeenLastCalledWith('src-A', 2)
    await act(async () => { calls[2].resolve(page({ events: 2, total: 100, pageNum: 2 })) })
    expect(result.current[0].error).toBeNull()
    expect(result.current[0].events).toHaveLength(2)
  })

  it('U-7 loadFailedText 省略（TabLines 现状）→ reject 时 error 恒 null + 清空 events', async () => {
    const { fn, calls } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].open('src-A') })
    await act(async () => { calls[0].resolve(page({ events: 3, total: 3 })) })
    expect(result.current[0].events).toHaveLength(3)
    act(() => { result.current[1].changePage(2) })
    await act(async () => { calls[1].reject(new Error('boom')) })
    expect(result.current[0].error).toBeNull()
    expect(result.current[0].events).toHaveLength(0)
    expect(result.current[0].loading).toBe(false)
  })
})

// ── no-op 守卫 ─────────────────────────────────────────────────────────

describe('useLineHealthDrawer — 守卫', () => {
  it('U-9 sourceId=null 时 changePage/retry no-op（不触发 fetchHealth）', async () => {
    const { fn } = makeFetch()
    const { result } = renderHook(() => useLineHealthDrawer({ fetchHealth: fn }))
    act(() => { result.current[1].changePage(2) })
    act(() => { result.current[1].retry() })
    expect(fn).not.toHaveBeenCalled()
  })
})
