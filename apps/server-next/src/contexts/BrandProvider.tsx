'use client'

/**
 * BrandProvider — server-next 副本（ADR-038 / ADR-102）
 *
 * 与 apps/web-next/src/contexts/BrandProvider.tsx API 同构，不跨 apps import。
 * 双 Context 分离（BrandContext + ThemeContext）避免交叉 re-render。
 * SSR 安全：getServerSnapshot 返回 initial props 快照，hydration 无 mismatch。
 *
 * server-next 差异：
 * - admin 是单品牌内部工具，setBrand 仅写 cookie + DOM 同步，不 fetch /api/brands
 *   （未来若需多品牌再扩展，与 web-next 行为对齐）
 * - 不依赖 logger.client（CHG-SN-1-06 接入），错误用 console.error 占位
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

export const BrandContext = createContext<BrandContextValue | null>(null)
export const ThemeContext = createContext<ThemeContextValue | null>(null)

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
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function syncDomBrand(slug: string): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.brand = slug
}

function syncDomTheme(resolved: ResolvedTheme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = resolved
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.theme !== 'system' || typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      syncDomTheme(mql.matches ? 'dark' : 'light')
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [state.theme])

  const setBrand = useCallback(
    (slug: string): void => {
      // server-next: admin 单品牌，不 fetch /api/brands；仅写 cookie + DOM 同步以保 API 一致
      const next: Brand = { ...state.brand, slug }
      store.setState({ brand: next })
      syncDomBrand(slug)
      writeCookie('resovo-brand', slug)
    },
    [store, state.brand],
  )

  const setTheme = useCallback(
    (next: Theme): void => {
      store.setState({ theme: next })
      syncDomTheme(resolveTheme(next))
      writeCookie('resovo-theme', next)
    },
    [store],
  )

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
