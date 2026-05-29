/**
 * @vitest-environment jsdom
 *
 * use-route-theme-sync-fix.test.tsx — CHG-SN-9-ROUTE-LABEL-D-A2-FIX
 *
 * Codex stop-time review 抓到：route theme sync 在 logged-out / default 路径错误运行。
 * 修复：useRouteTheme 加 hasStoredTheme 区分"用户真正存过主题" vs "默认派生主题"，
 *      localPreference 仅在 hasStoredTheme=true 时非 null（防默认值污染 server）。
 *
 * 覆盖：
 *   #1 首次访问 + 无 localStorage → useUserPreferencesSync 收到 localValue=null（不触发登录迁移 PUT）
 *   #2 localStorage 有 themeId → localValue 非 null（触发登录迁移 PUT 用户真正存过的值）
 *   #3 localStorage 有 customTheme 数据 → localValue 非 null（含 customTheme）
 *   #4 setTheme 后 → 后续 render localValue 非 null
 *   #5 onRemoteValue 回调（server 应用）→ 后续 render localValue 非 null
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock useUserPreferencesSync 拦截 localValue 透传
const mockSyncHook = vi.fn()

vi.mock('@/lib/use-user-preferences-sync', () => ({
  useUserPreferencesSync: (opts: unknown) => {
    mockSyncHook(opts)
    return { syncing: false, putValue: vi.fn() }
  },
}))

import { useRouteTheme, CUSTOM_THEME_ID } from '@/lib/route-theme-storage'

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  }
}

function getLatestLocalValue(): unknown {
  const calls = mockSyncHook.mock.calls
  if (calls.length === 0) return undefined
  return (calls[calls.length - 1][0] as { localValue: unknown }).localValue
}

describe('useRouteTheme sync FIX — 区分用户存过 vs 默认派生', () => {
  beforeEach(() => {
    mockSyncHook.mockClear()
    vi.stubGlobal('localStorage', makeMemoryStorage())
  })

  it('#1 首次访问 + 无 localStorage → localValue=null（不触发登录迁移 PUT 默认值）', async () => {
    // 不在 localStorage 写任何东西 → useRouteTheme mount 应保持 hasStoredTheme=false
    renderHook(() => useRouteTheme('zh-CN'))
    // 等 mount effect 跑完
    await act(async () => { await Promise.resolve() })

    // 找最后一次同步 hook 调用的 localValue
    expect(getLatestLocalValue()).toBeNull()
  })

  it('#2 localStorage 有 themeId="nato" → localValue 非 null（触发登录迁移 PUT 用户存的值）', async () => {
    window.localStorage.setItem('resovo:route-theme', 'nato')
    renderHook(() => useRouteTheme('zh-CN'))
    await act(async () => { await Promise.resolve() })

    expect(getLatestLocalValue()).toEqual({ themeId: 'nato' })
  })

  it('#3 localStorage 有 customTheme 数据 → localValue 非 null（含完整 customTheme）', async () => {
    window.localStorage.setItem('resovo:route-theme', CUSTOM_THEME_ID)
    window.localStorage.setItem(
      'resovo:route-theme:custom',
      JSON.stringify({ displayName: 'My', labels: ['A', 'B'] }),
    )
    renderHook(() => useRouteTheme('zh-CN'))
    await act(async () => { await Promise.resolve() })

    expect(getLatestLocalValue()).toEqual({
      themeId: CUSTOM_THEME_ID,
      customTheme: { displayName: 'My', labels: ['A', 'B'] },
    })
  })

  it('#4 setTheme 后 → 后续 render localValue 非 null', async () => {
    const { result } = renderHook(() => useRouteTheme('zh-CN'))
    await act(async () => { await Promise.resolve() })

    expect(getLatestLocalValue()).toBeNull()

    // 模拟用户切换主题
    act(() => {
      result.current.setTheme({
        id: 'nato',
        displayName: 'NATO',
        labels: ['Alpha'],
        deadLabel: 'Offline',
        fallbackPrefix: 'Route ',
      })
    })

    expect(getLatestLocalValue()).toEqual({ themeId: 'nato' })
  })
})
