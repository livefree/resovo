/**
 * route-theme-storage.ts — 播放器主题持久化（CHG-369 / plan §17.2 #16 + CHG-369-B 自定义主题）
 *
 * 真源：5 主题常量 + getDefaultTheme(locale) 在 `apps/web-next/src/lib/line-display-name.ts`（CHG-353）。
 *
 * 协议：
 *   - themeId 读：首次 mount 从 localStorage 读 themeId → 校验 ∈ ALL_THEMES ∪ {'custom'} → 命中则返回；
 *     未命中（首次访问 / 无效 / SSR）→ fallback getDefaultTheme(locale)
 *   - themeId 写：用户切换主题 → 写 localStorage（同时 setState 触发 re-render）
 *   - SSR safe：typeof window === 'undefined' 时直接返回 default 不触读
 *
 * 自定义主题（CHG-369-B）：
 *   - 单独 key `resovo:route-theme:custom` 存 CustomThemeData JSON（与 themeId 解耦）
 *   - themeId === 'custom' 时消费 customTheme；其他 themeId 时 customTheme 仅存储 / 不消费
 *   - parseCustomTheme 严格 schema 校验（trim / 长度 / 数组）失败返 null（脏数据防御）
 *
 * 后续扩展：
 *   - CHG-SN-9-ROUTE-LABEL-D：users.preferences 跨设备同步
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CUSTOM_THEME_CONSTRAINTS as TYPES_CUSTOM_THEME_CONSTRAINTS,
  type CustomThemeData as TypesCustomThemeData,
  type RouteThemePreference,
} from '@resovo/types'
import { ALL_THEMES, getDefaultTheme, type RouteTheme } from './line-display-name'
import { useUserPreferencesSync } from './use-user-preferences-sync'

const STORAGE_KEY = 'resovo:route-theme'
const CUSTOM_STORAGE_KEY = 'resovo:route-theme:custom'

/** 自定义主题 id（特殊值 / 与 ALL_THEMES.id 互斥） */
export const CUSTOM_THEME_ID = 'custom'

/**
 * 自定义主题存储 shape（设计稿 §Layer C "用户自定义主题"）。
 *
 * ADR-165 Y-165-3 修订：真源在 packages/types/src/user.types.ts
 * （CustomThemeData / CustomThemeDataSchema）/ 本文件 re-export 为本地类型别名
 * 防消费方 import 路径迁移波及。
 */
export type CustomThemeData = TypesCustomThemeData

/**
 * CustomThemeData 字段约束（设计稿 §Layer C / docs/manual §8.4a）。
 *
 * ADR-165 Y-165-3 修订：真源迁移到 packages/types/src/user.types.ts
 * （CUSTOM_THEME_CONSTRAINTS）/ 本文件 re-export 防 web-next 既有消费方批量改 import。
 */
export const CUSTOM_THEME_CONSTRAINTS = TYPES_CUSTOM_THEME_CONSTRAINTS

/** 从 localStorage 读 themeId，未命中或无效返回 null（SSR safe） */
export function readStoredThemeId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    // 校验：themeId 必须 ∈ ALL_THEMES ∪ {CUSTOM_THEME_ID}（防 localStorage 被脏数据污染）
    if (raw === CUSTOM_THEME_ID) return CUSTOM_THEME_ID
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

/** 通过 themeId 查找 RouteTheme 实例（未命中返回 null / 'custom' 不在此处理 / 由调用方读 customTheme） */
export function findThemeById(themeId: string): RouteTheme | null {
  return ALL_THEMES.find((t) => t.id === themeId) ?? null
}

/**
 * parseCustomTheme — JSON 字符串 → CustomThemeData 严格校验
 *
 * 校验规则（设计稿 §Layer C 约束）：
 *   - displayName: trim 后非空 + 长度 ≤ 10
 *   - labels: 数组 / 元素全为字符串 / trim 后每个非空 + ≤ 10 字符 / 总数 1-30
 *   - deadLabel: 可选 / trim 后非空 + ≤ 10
 *
 * 任一规则失败 → 返 null（脏数据静默回退 / 不抛异常 / 由消费方走 default）
 */
export function parseCustomTheme(raw: string): CustomThemeData | null {
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object') return null
    const o = obj as Record<string, unknown>
    const C = CUSTOM_THEME_CONSTRAINTS

    const displayName = typeof o.displayName === 'string' ? o.displayName.trim() : ''
    if (displayName.length === 0 || displayName.length > C.displayNameMaxChars) return null

    if (!Array.isArray(o.labels)) return null
    const labels = o.labels
      .filter((l): l is string => typeof l === 'string')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length <= C.labelMaxChars)
    if (labels.length < C.labelsMinCount || labels.length > C.labelsMaxCount) return null

    let deadLabel: string | undefined
    if (typeof o.deadLabel === 'string') {
      const trimmed = o.deadLabel.trim()
      if (trimmed.length > 0 && trimmed.length <= C.deadLabelMaxChars) {
        deadLabel = trimmed
      }
    }

    return { displayName, labels, deadLabel }
  } catch {
    return null
  }
}

/** 从 localStorage 读自定义主题数据（SSR safe / 校验失败回 null） */
export function readStoredCustomTheme(): CustomThemeData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY)
    if (!raw) return null
    return parseCustomTheme(raw)
  } catch {
    return null
  }
}

/** 写自定义主题数据到 localStorage（SSR safe / 静默失败） */
export function writeStoredCustomTheme(data: CustomThemeData): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage 不可写 → 仅本会话生效
  }
}

/** 清除自定义主题数据（SSR safe / 静默失败） */
export function clearStoredCustomTheme(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CUSTOM_STORAGE_KEY)
  } catch {
    // 失败则等下次写覆盖
  }
}

/**
 * CustomThemeData → RouteTheme 运行时派发
 *
 * 复用既有 RouteTheme 接口（applyThemeLabels / buildThemedSources 消费 RouteTheme.labels 等字段）。
 * id 固定为 CUSTOM_THEME_ID / fallbackPrefix 默认 '线路'（中文优先 / 与 THEME_JIE_QI 一致）。
 */
export function customThemeToRouteTheme(data: CustomThemeData): RouteTheme {
  return {
    id: CUSTOM_THEME_ID,
    displayName: data.displayName,
    labels: data.labels,
    deadLabel: data.deadLabel ?? '已断',
    fallbackPrefix: '线路',
  }
}

/**
 * useRouteTheme — 播放器主题 hook（含 localStorage 持久化 + 自定义主题支持 + ADR-165 跨设备同步）
 *
 * 行为：
 *   - 首次 render（SSR / client 初次 mount）：返回 `getDefaultTheme(locale)`，避免
 *     SSR ↔ client mismatch（localStorage 仅 client 可读）。
 *   - mount 后第一次 effect：读 themeId + customTheme → 命中则切到存储的主题。
 *   - ADR-165 同步 hook（useUserPreferencesSync）：mount 试探性 GET server → 登录态
 *     server 有值优先 / server 空 + 本地非空 → 登录迁移 PUT / 失败 / 401 静默降级。
 *   - 用户调 `setTheme(theme)` → setState + 写 themeId + debounce PUT server。
 *   - 用户调 `setCustomTheme(data)` → 写双 key + setState + debounce PUT server。
 *   - 用户调 `clearCustomTheme()` → 清 customTheme + 回 default + debounce PUT server。
 *
 * 返回字段：
 *   - theme: 当前 RouteTheme
 *   - customTheme: 当前 CustomThemeData | null
 *   - syncing: ADR-165 R-165-2 / D-165-11 → mount GET 进行中时 UI 应 disable 切换器（防 FOUC）
 *   - setTheme / setCustomTheme / clearCustomTheme: 切换 / 写入 / 清除（含 server 同步）
 */
export function useRouteTheme(locale: string): {
  theme: RouteTheme
  customTheme: CustomThemeData | null
  syncing: boolean
  setTheme: (theme: RouteTheme) => void
  setCustomTheme: (data: CustomThemeData) => void
  clearCustomTheme: () => void
} {
  const [theme, setThemeState] = useState<RouteTheme>(() => getDefaultTheme(locale))
  const [customTheme, setCustomThemeState] = useState<CustomThemeData | null>(null)
  // CHG-SN-9-ROUTE-LABEL-D-A2-FIX (Codex stop-time review)：区分"用户真正存过主题" vs "默认派生主题"
  // 仅当 hasStoredTheme=true 时 useUserPreferencesSync 才接收非 null localValue → 仅用户真正
  // 设过的偏好才参与登录迁移 PUT；默认 theme（getDefaultTheme 派生）不会污染 server
  const [hasStoredTheme, setHasStoredTheme] = useState(false)

  useEffect(() => {
    const storedCustom = readStoredCustomTheme()
    if (storedCustom) setCustomThemeState(storedCustom)

    const storedId = readStoredThemeId()
    // CHG-SN-9-ROUTE-LABEL-D-A2-FIX-2 (Codex stop-time review 2nd)：
    // hasStoredTheme 仅在 mount 真正 hydrate state 成功时为 true。
    // 防 corrupt/partial 场景：localStorage 有 themeId='custom' 但 customTheme 数据缺失/损坏
    // → storedCustom=null → state 保留 default theme jie_qi → 旧逻辑会让 hasStoredTheme=true +
    // localPreference={themeId:'jie_qi'} → 触发 PUT 默认值污染 server。
    // 修复：hydrated 只在 state 真切到 stored 值时为 true / 否则保持 false 阻止 PUT。
    let hydrated = false

    if (storedId === CUSTOM_THEME_ID) {
      // 自定义主题命中：仅当 storedCustom 也存在时才切（否则保留 default 防空主题）
      if (storedCustom) {
        setThemeState(customThemeToRouteTheme(storedCustom))
        hydrated = true
      }
      // else: themeId='custom' 但 customTheme 损坏 → hydration 失败 → hasStoredTheme=false
    } else if (storedId) {
      const stored = findThemeById(storedId)
      if (stored) {
        if (stored.id !== theme.id) setThemeState(stored)
        hydrated = true
      }
      // else: themeId 是脏数据（findThemeById 返 null）→ hydration 失败 → hasStoredTheme=false
    }

    if (hydrated) {
      setHasStoredTheme(true)
    }
    // 仅 mount 时同步一次 localStorage → state；后续 setTheme 路径直接写
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-165 / D-165-11：server 返回时单次受控 re-paint + 写双 key localStorage 同步
  const handleRemoteValue = useCallback((remote: RouteThemePreference) => {
    const remoteThemeId = remote.themeId
    if (remoteThemeId === CUSTOM_THEME_ID) {
      const remoteCustom = remote.customTheme
      if (remoteCustom) {
        setCustomThemeState(remoteCustom)
        writeStoredCustomTheme(remoteCustom)
        setThemeState(customThemeToRouteTheme(remoteCustom))
        writeStoredThemeId(CUSTOM_THEME_ID)
        setHasStoredTheme(true)
      }
      return
    }
    const stored = findThemeById(remoteThemeId)
    if (stored) {
      setThemeState(stored)
      writeStoredThemeId(stored.id)
      setHasStoredTheme(true)
    }
  }, [])

  // 本地当前 RouteThemePreference（用于登录迁移协议 D-165-5）
  // CHG-SN-9-ROUTE-LABEL-D-A2-FIX：仅 hasStoredTheme=true 时非 null（防默认值污染 server）
  const localPreference: RouteThemePreference | null = hasStoredTheme
    ? (theme.id === CUSTOM_THEME_ID && customTheme
        ? { themeId: CUSTOM_THEME_ID, customTheme }
        : { themeId: theme.id })
    : null

  const { syncing, putValue } = useUserPreferencesSync<RouteThemePreference>({
    sectionKey: 'routeTheme',
    localValue: localPreference,
    onRemoteValue: handleRemoteValue,
  })

  function setTheme(next: RouteTheme): void {
    setThemeState(next)
    writeStoredThemeId(next.id)
    setHasStoredTheme(true)
    putValue({ themeId: next.id })
  }

  function setCustomTheme(data: CustomThemeData): void {
    setCustomThemeState(data)
    writeStoredCustomTheme(data)
    setThemeState(customThemeToRouteTheme(data))
    writeStoredThemeId(CUSTOM_THEME_ID)
    setHasStoredTheme(true)
    putValue({ themeId: CUSTOM_THEME_ID, customTheme: data })
  }

  function clearCustomTheme(): void {
    setCustomThemeState(null)
    clearStoredCustomTheme()
    // 当前若正用自定义主题 → 回退到 default
    if (theme.id === CUSTOM_THEME_ID) {
      const fallback = getDefaultTheme(locale)
      setThemeState(fallback)
      writeStoredThemeId(fallback.id)
      setHasStoredTheme(true)
      putValue({ themeId: fallback.id })
    } else {
      // 仅清除 customTheme / themeId 不变 → server 仅更新 customTheme 缺省
      // hasStoredTheme 已 true 不重设
      putValue({ themeId: theme.id })
    }
  }

  return { theme, customTheme, syncing, setTheme, setCustomTheme, clearCustomTheme }
}
