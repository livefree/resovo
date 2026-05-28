'use client'

/**
 * RouteThemeSelector.tsx — 播放器主题选择器（CHG-369 + CHG-369-B / plan §17.2）
 *
 * 用途：sources tab 顶部展示 5 内置主题下拉 + 自定义入口；用户切换 → 立即 setTheme（持久化逻辑
 * 由 `useRouteTheme` hook 内部处理 / 本组件零状态）。
 *
 * CHG-369-B 扩展：
 *   - select 末尾新增"自定义"option（id='custom'）→ 已有自定义时显示 displayName；否则显示"自定义…"
 *   - 紧邻的"✎"按钮 → 触发 onOpenCustomDialog 打开编辑器（无论当前主题是否自定义）
 *   - 切到"自定义"option 但 customTheme=null → 视为"打开编辑器请求"（onOpenCustomDialog）
 */

import { ALL_THEMES, type RouteTheme } from '@/lib/line-display-name'
import {
  CUSTOM_THEME_ID,
  customThemeToRouteTheme,
  findThemeById,
  type CustomThemeData,
} from '@/lib/route-theme-storage'

interface RouteThemeSelectorProps {
  readonly currentTheme: RouteTheme
  readonly customTheme: CustomThemeData | null
  /**
   * ADR-165 / D-165-11 / R-165-2 FOUC 防御：
   * true 时 disable 切换器与编辑按钮（mount GET server 进行中 / 避免用户在不一致期手动切，
   * 触发 PUT 覆盖 server 已有较新值）。默认 false 保持 CHG-369 / CHG-369-B 既有行为。
   */
  readonly syncing?: boolean
  readonly onThemeChange: (theme: RouteTheme) => void
  readonly onOpenCustomDialog: () => void
  readonly className?: string
}

export function RouteThemeSelector({
  currentTheme,
  customTheme,
  syncing = false,
  onThemeChange,
  onOpenCustomDialog,
  className,
}: RouteThemeSelectorProps) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === CUSTOM_THEME_ID) {
      // 自定义：若已有数据直接应用；否则触发编辑器（首次创建路径）
      if (customTheme) {
        onThemeChange(customThemeToRouteTheme(customTheme))
      } else {
        onOpenCustomDialog()
      }
      return
    }
    const next = findThemeById(value)
    if (next) onThemeChange(next)
  }

  const customOptionLabel = customTheme ? `自定义：${customTheme.displayName}` : '自定义…'

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
        disabled={syncing}
        title={syncing ? '正在同步偏好…' : undefined}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--fg-default)',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 'var(--font-size-xs)',
          opacity: syncing ? 0.6 : 1,
          cursor: syncing ? 'wait' : 'pointer',
        }}
      >
        {ALL_THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.displayName}
          </option>
        ))}
        <option key={CUSTOM_THEME_ID} value={CUSTOM_THEME_ID}>
          {customOptionLabel}
        </option>
      </select>
      <button
        type="button"
        data-testid="route-theme-edit-custom"
        onClick={onOpenCustomDialog}
        disabled={syncing}
        title={syncing ? '正在同步偏好…' : (customTheme ? '编辑自定义主题' : '新建自定义主题')}
        aria-label={customTheme ? '编辑自定义主题' : '新建自定义主题'}
        style={{
          background: 'transparent',
          color: 'var(--fg-muted)',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 'var(--font-size-xs)',
          cursor: syncing ? 'wait' : 'pointer',
          opacity: syncing ? 0.6 : 1,
        }}
      >
        ✎
      </button>
    </div>
  )
}
