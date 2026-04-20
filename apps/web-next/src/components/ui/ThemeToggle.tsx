'use client'

import type React from 'react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import type { Theme } from '@/types/brand'

// ── Inline SVG icons（无图标库依赖）────────────────────────────────

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// ── 配置 ────────────────────────────────────────────────────────────

const SEGMENTS: Array<{ value: Theme; label: string; Icon: () => React.ReactElement }> = [
  { value: 'light', label: '浅色', Icon: SunIcon },
  { value: 'system', label: '系统', Icon: MonitorIcon },
  { value: 'dark', label: '深色', Icon: MoonIcon },
]

// ── Props ───────────────────────────────────────────────────────────

export interface ThemeToggleProps {
  readonly className?: string
  readonly variant?: 'icon' | 'full'
}

// ── Component ───────────────────────────────────────────────────────

export function ThemeToggle({ className, variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="主题切换"
      data-testid="theme-toggle"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md p-0.5',
        'bg-[var(--bg-surface-sunken)] border border-[var(--border-subtle)]',
        className,
      )}
    >
      {SEGMENTS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            data-state={active ? 'active' : 'inactive'}
            data-testid={`theme-toggle-${value}`}
            onClick={() => setTheme(value)}
            title={label}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
              active
                ? 'bg-[var(--bg-surface-raised)] text-[var(--fg-default)] shadow-sm'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-surface)]',
            )}
          >
            <Icon />
            {variant === 'full' && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
