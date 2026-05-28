/**
 * route-theme-storage.ts — 播放器主题持久化（CHG-369 / plan §17.2 #16）
 *
 * 真源：5 主题常量 + getDefaultTheme(locale) 在 `apps/web-next/src/lib/line-display-name.ts`（CHG-353）。
 *
 * 协议：
 *   - 读：首次 mount 从 localStorage 读 themeId → 校验 ∈ ALL_THEMES → 命中则返回；
 *     未命中（首次访问 / 无效 / SSR）→ fallback getDefaultTheme(locale)
 *   - 写：用户切换主题 → 写 localStorage（同时 setState 触发 re-render）
 *   - SSR safe：typeof window === 'undefined' 时直接返回 default 不触读
 *
 * 后续扩展：
 *   - CHG-369-B：自定义主题输入（labels ≤ 30 / name ≤ 10 字符 / JSON.stringify 存储 + schema 校验）
 *   - CHG-SN-9-ROUTE-LABEL-D：users.preferences 跨设备同步
 */

import { useEffect, useState } from 'react'
import { ALL_THEMES, getDefaultTheme, type RouteTheme } from './line-display-name'

const STORAGE_KEY = 'resovo:route-theme'

/** 从 localStorage 读 themeId，未命中或无效返回 null（SSR safe） */
export function readStoredThemeId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    // 严格校验：themeId 必须 ∈ ALL_THEMES（防 localStorage 被脏数据污染）
    const matched = ALL_THEMES.find((t) => t.id === raw)
    return matched ? matched.id : null
  } catch {
    // localStorage 可能被禁用 / quotaExceeded / 私密模式
    return null
  }
}

/** 写 localStorage themeId（SSR safe / 静默失败） */
export function writeStoredThemeId(themeId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, themeId)
  } catch {
    // localStorage 不可写 → 仅本会话生效，下次访问回到 default
  }
}

/** 通过 themeId 查找 RouteTheme 实例（未命中返回 null） */
export function findThemeById(themeId: string): RouteTheme | null {
  return ALL_THEMES.find((t) => t.id === themeId) ?? null
}

/**
 * useRouteTheme — 播放器主题 hook（含 localStorage 持久化）
 *
 * 行为：
 *   - 首次 render（SSR / client 初次 mount）：返回 `getDefaultTheme(locale)`，避免
 *     SSR ↔ client mismatch（localStorage 仅 client 可读）。
 *   - mount 后第一次 effect：读 localStorage → 命中则切到存储的主题（用户感知"自动应用上次选择"）。
 *   - 用户调 `setTheme(theme)` → setState + 写 localStorage。
 */
export function useRouteTheme(locale: string): {
  theme: RouteTheme
  setTheme: (theme: RouteTheme) => void
} {
  const [theme, setThemeState] = useState<RouteTheme>(() => getDefaultTheme(locale))

  useEffect(() => {
    const storedId = readStoredThemeId()
    if (storedId) {
      const stored = findThemeById(storedId)
      if (stored && stored.id !== theme.id) {
        setThemeState(stored)
      }
    }
    // 仅 mount 时同步一次 localStorage → state；后续 setTheme 路径直接写
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setTheme(next: RouteTheme): void {
    setThemeState(next)
    writeStoredThemeId(next.id)
  }

  return { theme, setTheme }
}
