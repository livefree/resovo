import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
}

interface ThemeActions {
  setTheme: (theme: Theme) => void
  syncSystemTheme: () => void
}

type ThemeStore = ThemeState & ThemeActions

const STORAGE_KEY = 'resovo-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeStore>()((set, get) => ({
  theme: 'system',
  resolvedTheme: 'dark',

  setTheme: (theme) => {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    applyTheme(resolved)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage 不可用时静默失败
    }
    set({ theme, resolvedTheme: resolved })
  },

  syncSystemTheme: () => {
    const { theme } = get()
    if (theme !== 'system') return
    const resolved = getSystemTheme()
    applyTheme(resolved)
    set({ resolvedTheme: resolved })
  },
}))

export function initTheme() {
  const stored = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) as Theme | null
    } catch {
      return null
    }
  })()
  const theme: Theme = stored ?? 'system'
  const resolved = theme === 'system' ? getSystemTheme() : theme
  applyTheme(resolved)
  useThemeStore.setState({ theme, resolvedTheme: resolved })
}
