'use client'

/**
 * BrandProvider — REG-M1-01 / ADR-038
 *
 * 双 Context 分离（BrandContext + ThemeContext）避免交叉 re-render。
 * 模块级外部 store 通过 useRef 生成，配合 useSyncExternalStore 订阅。
 * SSR 安全：getServerSnapshot 返回 initial props 快照，hydration 无 mismatch。
 * DOM 同步统一使用 data-theme 属性（与 theme-init-script 一致）。
 * 存储统一使用 Cookie（resovo-brand / resovo-theme），移除 localStorage 通道。
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

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

  useEffect(() => {
    syncDomBrand(state.brand.slug)
    syncDomTheme(resolveTheme(state.theme))
    // INFRA-10: 浏览器端全局 logger hooks（window error / unhandledrejection
    // / console.error dev / pagehide）一次性安装，幂等
    installGlobalHooks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.theme !== 'system' || typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => { syncDomTheme(mql.matches ? 'dark' : 'light') }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [state.theme])

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
    syncDomTheme(resolveTheme(next))
    writeCookie('resovo-theme', next)
  }, [store])

  const brandValue = useMemo<BrandContextValue>(
    () => ({ brand: state.brand, setBrand }),
    [state.brand, setBrand],
  )

  const themeValue = useMemo<ThemeContextValue>(
    () => ({ theme: state.theme, resolvedTheme: resolveTheme(state.theme), setTheme }),
    [state.theme, setTheme],
  )

  return (
    <BrandContext.Provider value={brandValue}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </BrandContext.Provider>
  )
}
