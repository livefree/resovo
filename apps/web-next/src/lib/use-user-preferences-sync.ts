'use client'

/**
 * use-user-preferences-sync.ts — 用户偏好跨设备同步 hook
 *
 * ADR-165 / CHG-SN-9-ROUTE-LABEL-D-A2 / Y-165-1（独立 hook 拆分 / 与 useRouteTheme 解耦）
 *
 * 设计：
 *   - mount 时试探性 GET /users/me/preferences（不预设登录态 / 用 credentials:include 自动带 cookie）
 *     - 200 → 用户已登录 + 有 server 偏好 → 调用 onRemoteValue(server[sectionKey])
 *     - 401 / 网络错 → 静默降级 localStorage（D-165-8）
 *   - 用户操作 → putValue(value) → debounce 500ms → PUT /users/me/preferences
 *     - value !== null → server 顶层模块 merge
 *     - value === null → server 删除该顶层 key（D-165-7 / R-165-3）
 *   - PUT 失败 → 写 sessionStorage `resovo:prefs-sync-failed-at` 时间戳（Y-165-7）
 *     - 下次 putValue 时检测 < 5 分钟 → 静默重试一次
 *
 * 不在职责内：
 *   - SSR-safe localStorage 双 key 写（仍在 useRouteTheme 内）
 *   - 主题特定派发 / 仅按 sectionKey 透传值
 *
 * 与 ADR-037 BrandProvider + useBrand/useTheme 双 hook 拆分范式对称（useRouteTheme 是上层 / 本 hook 是网络层）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient, ApiClientError } from './api-client'

const SYNC_DEBOUNCE_MS = 500
const SYNC_FAILED_KEY = 'resovo:prefs-sync-failed-at'
const SYNC_RETRY_WINDOW_MS = 5 * 60 * 1000  // 5 分钟

type PreferencesResponse = { data: Record<string, unknown> }

export interface UseUserPreferencesSyncOptions<T> {
  /** 顶层 key 名（如 'routeTheme'） */
  readonly sectionKey: string
  /**
   * 本地当前值（用于登录迁移协议 D-165-5）：
   * GET 返回 server 该 sectionKey 为空 + 本地非空 → 把本地值 PUT 到 server
   */
  readonly localValue: T | null
  /**
   * server 返回值与本地不一致时触发（D-165-11 hydration 同步 / 单次受控 re-paint）。
   * 消费方（useRouteTheme）在回调内 setState + 写 localStorage 双 key 同步。
   */
  readonly onRemoteValue: (remote: T) => void
}

export interface UseUserPreferencesSyncResult<T> {
  /**
   * mount GET 进行中（D-165-11 / R-165-2 FOUC 防御）：
   * - true → RouteThemeSelector 等 UI 应 disable 切换器
   * - false → 解锁 / 用户可正常操作
   */
  readonly syncing: boolean
  /** 触发 debounce 500ms PUT；value=null 删除该 sectionKey */
  readonly putValue: (value: T | null) => void
}

function readSessionStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try { return window.sessionStorage.getItem(key) } catch { return null }
}

function writeSessionStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(key, value) } catch { /* ignore */ }
}

function removeSessionStorage(key: string): void {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(key) } catch { /* ignore */ }
}

export function useUserPreferencesSync<T>(
  options: UseUserPreferencesSyncOptions<T>,
): UseUserPreferencesSyncResult<T> {
  const { sectionKey, localValue, onRemoteValue } = options

  // 第 1 阶段 mount 时 syncing=true（D-165-11 防 FOUC）
  // SSR-safe: 服务端 render 时 syncing=false（无 window）/ client mount 后 setSyncing(true)
  const [syncing, setSyncing] = useState(false)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onRemoteValueRef = useRef(onRemoteValue)
  const localValueRef = useRef(localValue)
  useEffect(() => { onRemoteValueRef.current = onRemoteValue }, [onRemoteValue])
  useEffect(() => { localValueRef.current = localValue }, [localValue])

  // mount 时试探性 GET（不预设登录态）
  useEffect(() => {
    let cancelled = false
    setSyncing(true)

    apiClient.get<PreferencesResponse>('/users/me/preferences')
      .then((res) => {
        if (cancelled) return
        const server = res.data ?? {}
        const remoteValue = server[sectionKey] as T | undefined

        if (remoteValue !== undefined && remoteValue !== null) {
          // server 有值 → 优先（D-165-5）
          onRemoteValueRef.current(remoteValue)
        } else if (localValueRef.current !== null) {
          // server 空 + 本地非空 → 登录迁移：本地值 PUT 到 server（D-165-5）
          void apiClient.put('/users/me/preferences', {
            [sectionKey]: localValueRef.current,
          }).catch(() => { /* 静默 / D-165-8 */ })
        }
      })
      .catch((err: unknown) => {
        // 401 / 网络错 → 静默降级（D-165-8）
        if (err instanceof ApiClientError && err.code !== 'INVALID_TOKEN' && err.status !== 401) {
          writeSessionStorage(SYNC_FAILED_KEY, String(Date.now()))
        }
        // 静默 / 不显示 toast（D-165-8 / 与 CHG-369 设计取舍一致）
      })
      .finally(() => {
        if (!cancelled) setSyncing(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey])  // sectionKey 是稳定字面量 / 不重跑

  const doPut = useCallback((value: T | null) => {
    void apiClient.put('/users/me/preferences', {
      [sectionKey]: value,
    })
      .then(() => {
        removeSessionStorage(SYNC_FAILED_KEY)  // 成功 → 清失败标记
      })
      .catch((err: unknown) => {
        // 401 已登出 → 静默（用户无法同步 / localStorage 兜底）
        if (err instanceof ApiClientError && err.status === 401) return
        writeSessionStorage(SYNC_FAILED_KEY, String(Date.now()))
      })
  }, [sectionKey])

  const putValue = useCallback((value: T | null) => {
    // 清前一次 debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    // 检测上次失败 → < 5 分钟则同步触发额外重试（Y-165-7）
    const lastFailedAt = readSessionStorage(SYNC_FAILED_KEY)
    if (lastFailedAt !== null) {
      const elapsed = Date.now() - Number(lastFailedAt)
      if (elapsed > 0 && elapsed < SYNC_RETRY_WINDOW_MS) {
        // 立即静默重试（与本次 debounce PUT 并发 / last-write-wins）
        doPut(value)
      } else {
        removeSessionStorage(SYNC_FAILED_KEY)
      }
    }

    debounceTimerRef.current = setTimeout(() => {
      doPut(value)
      debounceTimerRef.current = null
    }, SYNC_DEBOUNCE_MS)
  }, [doPut])

  // unmount 清 timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return { syncing, putValue }
}
