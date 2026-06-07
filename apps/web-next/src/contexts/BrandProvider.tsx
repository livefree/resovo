'use client'

/**
 * BrandProvider — REG-M1-01 / ADR-038
 *
 * 双 Context 分离（BrandContext + ThemeContext）避免交叉 re-render。
 * 模块级外部 store 通过 useRef 生成，配合 useSyncExternalStore 订阅。
 * SSR 安全：getServerSnapshot 返回 initial props 快照；`resolvedTheme` 的
 * `system` 解析延迟到挂载后（首渲染两端恒 'light'，CHG-SHELL-THEME-HYDRATION-FIX
 * 同构同步——render 期直读 matchMedia 会让派生值泄漏 client-only 信息致 hydration mismatch）。
 * DOM 同步统一使用 data-theme 属性（与 theme-init-script 一致）。
 * 存储统一使用 Cookie（resovo-brand / resovo-theme），移除 localStorage 通道。
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react'
import type {
  Brand,
  BrandContextValue,
  ResolvedTheme,
  Theme,
  ThemeContextValue,
} from '@/types/brand'
import { clientLogger, installGlobalHooks } from '@/lib/logger.client'

export const BrandContext = createContext<BrandContextValue | null>(null)
export const ThemeContext = createContext<ThemeContextValue | null>(null)

// ── 外部 store ─────────────────────────────────────────────────────

interface StoreState {
  readonly brand: Brand
  readonly theme: Theme
}

type Listener = () => void

interface ExternalStore {
  getState: () => StoreState
  setState: (patch: Partial<StoreState>) => void
  subscribe: (listener: Listener) => () => void
}

function createStore(initial: StoreState): ExternalStore {
  let state: StoreState = initial
  const listeners = new Set<Listener>()
  return {
    getState: () => state,
    setState: (patch) => {
      const next: StoreState = { ...state, ...patch }
      if (next.brand === state.brand && next.theme === state.theme) return
      state = next
      listeners.forEach((l) => l())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

// ── Cookie 写回工具 ────────────────────────────────────────────────

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
}

// ── DOM 同步工具 ────────────────────────────────────────────────────

function syncDomBrand(slug: string): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.brand = slug
}

function syncDomTheme(resolved: ResolvedTheme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = resolved
}

// ── Provider ───────────────────────────────────────────────────────

interface BrandProviderProps {
  readonly initialBrand: Brand
  readonly initialTheme: Theme
  readonly children: ReactNode
}

export function BrandProvider({ initialBrand, initialTheme, children }: BrandProviderProps): JSX.Element {
  const storeRef = useRef<ExternalStore | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createStore({ brand: initialBrand, theme: initialTheme })
  }
  const store = storeRef.current
  const initialSnapshot = useRef<StoreState>({ brand: initialBrand, theme: initialTheme })

  const subscribe = useCallback((l: Listener) => store.subscribe(l), [store])
  const getSnapshot = useCallback(() => store.getState(), [store])
  const getServerSnapshot = useCallback(() => initialSnapshot.current, [])
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // 'system' 的 OS 解析值：null = 未解析（首渲染 context 回退 SSR 确定值 'light'，
  // hydration 稳定——render 期直读 matchMedia 会致两端首渲染不一致）；
  // 挂载后解析并监听 OS 偏好变化（连带修复：变化此前仅同步 DOM，
  // context resolvedTheme 不更新致消费者不重渲）
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => setSystemResolved(mql.matches ? 'dark' : 'light')
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  const resolvedTheme: ResolvedTheme = state.theme === 'system' ? (systemResolved ?? 'light') : state.theme

  useEffect(() => {
    syncDomBrand(state.brand.slug)
    // INFRA-10: 浏览器端全局 logger hooks（window error / unhandledrejection
    // / console.error dev / pagehide）一次性安装，幂等
    installGlobalHooks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 主题 DOM 同步单路径：system 解析就绪 / OS 变化 / setTheme 统一经此。
  // 'system' 未解析阶段**不写 DOM**——theme-init-script 已在首绘前按 matchMedia
  // 设好正确 data-theme，用未解析回退值覆写会重引主题闪烁（Codex review）；
  // 解析在首个 effect flush 内落地后由本 effect 写入同值（视觉无变化）。
  useEffect(() => {
    if (state.theme === 'system' && systemResolved === null) return
    syncDomTheme(resolvedTheme)
  }, [state.theme, systemResolved, resolvedTheme])

  const setBrand = useCallback((slug: string): void => {
    void (async () => {
      try {
        const res = await fetch(`/api/brands/${slug}`, { credentials: 'same-origin' })
        if (!res.ok) {
          clientLogger.error(`[BrandProvider] fetch brand "${slug}" failed: ${res.status}`, {
            slug,
            status: res.status,
          })
          return
        }
        const next = (await res.json()) as Brand
        store.setState({ brand: next })
        syncDomBrand(next.slug)
        writeCookie('resovo-brand', next.slug)
      } catch (err) {
        clientLogger.error('[BrandProvider] setBrand error', {
          slug,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })()
  }, [store])

  const setTheme = useCallback((next: Theme): void => {
    store.setState({ theme: next })
    // DOM 同步经 resolvedTheme effect 单路径承担（state 变更 → 重渲 → effect）
    writeCookie('resovo-theme', next)
  }, [store])

  const brandValue = useMemo<BrandContextValue>(
    () => ({ brand: state.brand, setBrand }),
    [state.brand, setBrand],
  )

  const themeValue = useMemo<ThemeContextValue>(
    () => ({ theme: state.theme, resolvedTheme, setTheme }),
    [state.theme, resolvedTheme, setTheme],
  )

  return (
    <BrandContext.Provider value={brandValue}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </BrandContext.Provider>
  )
}
