/**
 * Topbar SSR 单测（CHG-SN-2-09 范式遵守 — Shell 范式章法 5）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - renderToString 零 throw
 *   - 输出含 3 区 + 5 类图标 + Breadcrumbs（health 提供时含 HealthBadge）
 *   - shortcut 文案走 SSR 默认（"Ctrl+K"）
 *   - 纯渲染无 useEffect → 无 hydration mismatch
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Topbar, type TopbarIcons } from '../../../../../packages/admin-ui/src/shell/topbar'
import type { BreadcrumbItem } from '../../../../../packages/admin-ui/src/shell/breadcrumbs'
import type { HealthSnapshot } from '../../../../../packages/admin-ui/src/shell/types'

const ICONS: TopbarIcons = {
  search: <svg data-icon="search" />,
  theme: <svg data-icon="theme" />,
  notifications: <svg data-icon="notifications" />,
  tasks: <svg data-icon="tasks" />,
  settings: <svg data-icon="settings" />,
}

const CRUMBS: readonly BreadcrumbItem[] = [
  { label: '运营中心' },
  { label: '管理台站', href: '/admin' },
]

const HEALTH: HealthSnapshot = {
  crawler: { running: 3, total: 12, status: 'ok' },
  invalidRate: { rate: 0.013, status: 'ok' },
  moderationPending: { count: 484, status: 'warn' },
}

const NOOP = () => {}

describe('Topbar — SSR renderToString（ADR-103a §4.4-2）', () => {
  it('renderToString 不抛错（含 health + 角标）', () => {
    expect(() =>
      renderToString(
        <Topbar
          crumbs={CRUMBS}
          theme="dark"
          icons={ICONS}
          health={HEALTH}
          notificationDotVisible
          runningTaskCount={5}
          onOpenCommandPalette={NOOP}
          onThemeToggle={NOOP}
          onOpenNotifications={NOOP}
          onOpenTasks={NOOP}
          onOpenSettings={NOOP}
        />,
      ),
    ).not.toThrow()
  })

  it('renderToString 不抛错（无 health / 无角标 — 最简形态）', () => {
    expect(() =>
      renderToString(
        <Topbar
          crumbs={CRUMBS}
          theme="light"
          icons={ICONS}
          onOpenCommandPalette={NOOP}
          onThemeToggle={NOOP}
          onOpenNotifications={NOOP}
          onOpenTasks={NOOP}
          onOpenSettings={NOOP}
        />,
      ),
    ).not.toThrow()
  })

  it('SSR 输出含 3 区 + 5 类图标 + Breadcrumbs + HealthBadge（health 提供时）', () => {
    const html = renderToString(
      <Topbar
        crumbs={CRUMBS}
        theme="dark"
        icons={ICONS}
        health={HEALTH}
        onOpenCommandPalette={NOOP}
        onThemeToggle={NOOP}
        onOpenNotifications={NOOP}
        onOpenTasks={NOOP}
        onOpenSettings={NOOP}
      />,
    )
    // 3 区
    expect(html).toContain('data-topbar-crumbs')
    expect(html).toContain('data-topbar-search')
    expect(html).toContain('data-topbar-right')
    // 5 类图标
    expect(html).toContain('data-icon="search"')
    expect(html).toContain('data-icon="theme"')
    expect(html).toContain('data-icon="tasks"')
    expect(html).toContain('data-icon="notifications"')
    expect(html).toContain('data-icon="settings"')
    // Breadcrumbs
    expect(html).toContain('data-breadcrumbs')
    expect(html).toContain('运营中心')
    expect(html).toContain('管理台站')
    // HealthBadge
    expect(html).toContain('data-health-badge')
    // a11y
    expect(html).toContain('role="banner"')
    expect(html).toContain('aria-label="打开全局搜索"')
    // shortcut SSR 默认
    expect(html).toContain('Ctrl+K')
  })

  it('SSR 输出 health=undefined → 不含 data-health-badge', () => {
    const html = renderToString(
      <Topbar
        crumbs={CRUMBS}
        theme="dark"
        icons={ICONS}
        onOpenCommandPalette={NOOP}
        onThemeToggle={NOOP}
        onOpenNotifications={NOOP}
        onOpenTasks={NOOP}
        onOpenSettings={NOOP}
      />,
    )
    expect(html).not.toContain('data-health-badge')
  })

  it('SSR 输出含角标（runningTaskCount + notificationDotVisible）', () => {
    const html = renderToString(
      <Topbar
        crumbs={CRUMBS}
        theme="dark"
        icons={ICONS}
        runningTaskCount={3}
        notificationDotVisible
        onOpenCommandPalette={NOOP}
        onThemeToggle={NOOP}
        onOpenNotifications={NOOP}
        onOpenTasks={NOOP}
        onOpenSettings={NOOP}
      />,
    )
    expect(html).toContain('data-topbar-icon-badge')
    expect(html).toContain('data-topbar-icon-dot')
  })
})
