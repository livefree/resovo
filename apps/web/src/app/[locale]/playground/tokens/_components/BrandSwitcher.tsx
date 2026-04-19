'use client'

import { useTheme } from '@/hooks/useTheme'
import type { Theme } from '@/types/brand'

const THEMES: Theme[] = ['light', 'dark', 'system']

export function BrandSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
        Theme:
      </span>
      <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className="px-3 py-1 text-xs capitalize transition-colors"
            style={{
              backgroundColor: theme === t ? 'var(--accent-default)' : 'var(--bg-surface)',
              color: theme === t ? 'var(--accent-fg)' : 'var(--fg-default)',
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
