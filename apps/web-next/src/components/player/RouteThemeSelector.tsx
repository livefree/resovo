'use client'

/**
 * RouteThemeSelector.tsx — 播放器主题选择器（CHG-369 / plan §17.2 #16）
 *
 * 用途：sources tab 顶部展示 5 内置主题下拉；用户切换 → 立即 setTheme（持久化逻辑
 * 由 `useRouteTheme` hook 内部处理 / 本组件零状态）。
 *
 * 后续扩展 follow-up CHG-369-B：增加 "自定义" 入口（弹层输入 name + labels）。
 */

import { ALL_THEMES, type RouteTheme } from '@/lib/line-display-name'
import { findThemeById } from '@/lib/route-theme-storage'

interface RouteThemeSelectorProps {
  readonly currentTheme: RouteTheme
  readonly onThemeChange: (theme: RouteTheme) => void
  readonly className?: string
}

export function RouteThemeSelector({
  currentTheme,
  onThemeChange,
  className,
}: RouteThemeSelectorProps) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = findThemeById(e.target.value)
    if (next) onThemeChange(next)
  }

  return (
    <div
      className={className}
      data-testid="route-theme-selector"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--fg-muted)',
      }}
    >
      <label htmlFor="route-theme-select">主题</label>
      <select
        id="route-theme-select"
        data-testid="route-theme-select"
        value={currentTheme.id}
        onChange={handleChange}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--fg-default)',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        {ALL_THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.displayName}
          </option>
        ))}
      </select>
    </div>
  )
}
