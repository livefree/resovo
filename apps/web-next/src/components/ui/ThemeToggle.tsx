'use client'

import { useEffect } from 'react'
import { useThemeStore, initTheme } from '@/stores/themeStore'
import { cn } from '@/lib/utils'

const ICONS: Record<string, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
}

const LABELS: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const NEXT_THEME = { system: 'light', light: 'dark', dark: 'system' } as const

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, syncSystemTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', syncSystemTheme)
    return () => mq.removeEventListener('change', syncSystemTheme)
  }, [syncSystemTheme])

  return (
    <button
      onClick={() => setTheme(NEXT_THEME[theme])}
      title={`Theme: ${LABELS[theme]}`}
      data-testid="theme-toggle"
      aria-label={`Switch theme (current: ${LABELS[theme]})`}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
        'hover:bg-[var(--bg-surface-sunken)] text-[var(--fg-muted)]',
        className
      )}
    >
      <span aria-hidden="true">{ICONS[theme]}</span>
    </button>
  )
}
