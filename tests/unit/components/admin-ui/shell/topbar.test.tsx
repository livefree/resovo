/**
 * Topbar 渲染单测（CHG-SN-2-09）
 *
 * 覆盖：3 区布局 / Breadcrumbs 直接渲染（不调用 inferBreadcrumbs）/ 5 类图标注入 /
 * health 可选 / runningTaskCount 角标（含 0 / >99 / undefined 边界）/
 * notificationDotVisible 红点 / data-* attribute / a11y
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Topbar, formatTaskCount, type TopbarIcons } from '../../../../../packages/admin-ui/src/shell/topbar'
import type { BreadcrumbItem } from '../../../../../packages/admin-ui/src/shell/breadcrumbs'
import type { HealthSnapshot } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

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

function renderTopbar(overrides: Partial<React.ComponentProps<typeof Topbar>> = {}) {
  return render(
    <Topbar
      crumbs={CRUMBS}
      theme="dark"
      icons={ICONS}
      onOpenCommandPalette={NOOP}
      onThemeToggle={NOOP}
      onOpenNotifications={NOOP}
      onOpenTasks={NOOP}
      onOpenSettings={NOOP}
      {...overrides}
    />,
  )
}

describe('Topbar — 容器 + 3 区布局', () => {
  it('容器含 role="banner" + data-topbar', () => {
    const { container } = renderTopbar()
    const header = container.querySelector('[data-topbar]')
    expect(header?.tagName).toBe('HEADER')
    expect(header?.getAttribute('role')).toBe('banner')
  })

  it('data-topbar-theme 同步 prop', () => {
    const { container, rerender } = renderTopbar({ theme: 'dark' })
    expect(container.querySelector('[data-topbar]')?.getAttribute('data-topbar-theme')).toBe('dark')
    rerender(
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
    )
    expect(container.querySelector('[data-topbar]')?.getAttribute('data-topbar-theme')).toBe('light')
  })

  it('3 区：左 Breadcrumbs + 中搜索 + 右图标组', () => {
    const { container } = renderTopbar()
    expect(container.querySelector('[data-topbar-crumbs]')).toBeTruthy()
    expect(container.querySelector('[data-topbar-search]')).toBeTruthy()
    expect(container.querySelector('[data-topbar-right]')).toBeTruthy()
  })
})

describe('Topbar — Breadcrumbs 直接渲染（不调用 inferBreadcrumbs）', () => {
  it('crumbs 直接渲染（最后一项 strong + 中间项 span）', () => {
    renderTopbar()
    expect(screen.getByText('运营中心').tagName).toBe('SPAN')
    expect(screen.getByText('管理台站').tagName).toBe('STRONG')
  })

  it('空 crumbs 数组 → Breadcrumbs 不渲染', () => {
    const { container } = renderTopbar({ crumbs: [] })
    expect(container.querySelector('[data-breadcrumbs]')).toBeNull()
  })
})

describe('Topbar — 全局搜索触发器', () => {
  it('button + icons.search + 文案 + ⌘K 提示', () => {
    const { container } = renderTopbar()
    const searchBtn = container.querySelector('[data-topbar-search]')
    expect(searchBtn?.tagName).toBe('BUTTON')
    expect(searchBtn?.getAttribute('aria-label')).toBe('打开全局搜索')
    expect(screen.getByText('搜索视频 / 播放源 / 任务…')).toBeTruthy()
    // ⌘K 提示（jsdom 环境 IS_MAC=false → "Ctrl+K"）
    expect(container.querySelector('[data-topbar-search-kbd]')?.textContent).toBe('Ctrl+K')
  })

  it('icons.search 节点渲染（消费方注入 ReactNode）', () => {
    const { container } = renderTopbar()
    const searchIcon = container.querySelector('[data-topbar-search-icon]')
    expect(searchIcon?.querySelector('[data-icon="search"]')).toBeTruthy()
  })

  it('button type="button"（防 submit 误触发）', () => {
    const { container } = renderTopbar()
    const btn = container.querySelector('[data-topbar-search]') as HTMLButtonElement
    expect(btn.getAttribute('type')).toBe('button')
  })
})

describe('Topbar — HealthBadge 可选', () => {
  it('health=undefined → HealthBadge 不渲染', () => {
    const { container } = renderTopbar()
    expect(container.querySelector('[data-health-badge]')).toBeNull()
  })

  it('health 提供 → HealthBadge 渲染', () => {
    const { container } = renderTopbar({ health: HEALTH })
    expect(container.querySelector('[data-health-badge]')).toBeTruthy()
    // 3 项指标 data-health-item 都渲染（文本 "采集 3/12" 因 React JSX 文本插值含 <!-- --> 切片，按 attribute 验证）
    expect(container.querySelector('[data-health-item="crawler"]')).toBeTruthy()
    expect(container.querySelector('[data-health-item="invalid-rate"]')).toBeTruthy()
    expect(container.querySelector('[data-health-item="moderation-pending"]')).toBeTruthy()
  })
})

describe('Topbar — 4 类图标按钮（theme/tasks/notifications/settings）', () => {
  it('4 类图标按钮全部渲染（aria-label + icons.X 节点）', () => {
    const { container } = renderTopbar()
    expect(container.querySelector('[data-topbar-icon-btn="theme"]')).toBeTruthy()
    expect(container.querySelector('[data-topbar-icon-btn="tasks"]')).toBeTruthy()
    expect(container.querySelector('[data-topbar-icon-btn="notifications"]')).toBeTruthy()
    expect(container.querySelector('[data-topbar-icon-btn="settings"]')).toBeTruthy()
  })

  it('icons.theme/tasks/notifications/settings 4 节点都渲染', () => {
    const { container } = renderTopbar()
    expect(container.querySelector('[data-icon="theme"]')).toBeTruthy()
    expect(container.querySelector('[data-icon="tasks"]')).toBeTruthy()
    expect(container.querySelector('[data-icon="notifications"]')).toBeTruthy()
    expect(container.querySelector('[data-icon="settings"]')).toBeTruthy()
  })

  it('主题按钮 aria-label 随 theme 变化（dark → "切换到浅色主题" / light → "切换到深色主题"）', () => {
    const { container } = renderTopbar({ theme: 'dark' })
    expect(container.querySelector('[data-topbar-icon-btn="theme"]')?.getAttribute('aria-label')).toBe('切换到浅色主题')
    cleanup()
    const { container: c2 } = renderTopbar({ theme: 'light' })
    expect(c2.querySelector('[data-topbar-icon-btn="theme"]')?.getAttribute('aria-label')).toBe('切换到深色主题')
  })

  it('button type="button" + 5 类图标按钮统一 32×32 尺寸（geometry consistency）', () => {
    const { container } = renderTopbar()
    const btns = container.querySelectorAll('[data-topbar-icon-btn]')
    expect(btns.length).toBe(4)
    btns.forEach((btn) => {
      expect((btn as HTMLButtonElement).getAttribute('type')).toBe('button')
      expect((btn as HTMLElement).style.width).toBe('32px')
      expect((btn as HTMLElement).style.height).toBe('32px')
    })
  })
})

describe('Topbar — 任务角标（runningTaskCount）', () => {
  it('count=undefined → 不渲染角标', () => {
    const { container } = renderTopbar()
    const tasksBtn = container.querySelector('[data-topbar-icon-btn="tasks"]')
    expect(tasksBtn?.querySelector('[data-topbar-icon-badge]')).toBeNull()
  })

  it('count=0 → 不渲染角标', () => {
    const { container } = renderTopbar({ runningTaskCount: 0 })
    const tasksBtn = container.querySelector('[data-topbar-icon-btn="tasks"]')
    expect(tasksBtn?.querySelector('[data-topbar-icon-badge]')).toBeNull()
  })

  it('count=3 → 数字徽章 "3"', () => {
    const { container } = renderTopbar({ runningTaskCount: 3 })
    const badge = container.querySelector('[data-topbar-icon-btn="tasks"] [data-topbar-icon-badge]')
    expect(badge?.textContent).toBe('3')
  })

  it('count=150 → "99+"（>99 缩写）', () => {
    const { container } = renderTopbar({ runningTaskCount: 150 })
    const badge = container.querySelector('[data-topbar-icon-btn="tasks"] [data-topbar-icon-badge]')
    expect(badge?.textContent).toBe('99+')
  })

  it('formatTaskCount helper 边界：undefined/0/-1 → undefined; 1→"1"; 99→"99"; 100→"99+"', () => {
    expect(formatTaskCount(undefined)).toBeUndefined()
    expect(formatTaskCount(0)).toBeUndefined()
    expect(formatTaskCount(-1)).toBeUndefined()
    expect(formatTaskCount(1)).toBe('1')
    expect(formatTaskCount(99)).toBe('99')
    expect(formatTaskCount(100)).toBe('99+')
  })
})

describe('Topbar — 通知红点（notificationDotVisible）', () => {
  it('未提供/false → 不渲染红点', () => {
    const { container } = renderTopbar()
    expect(container.querySelector('[data-topbar-icon-btn="notifications"] [data-topbar-icon-dot]')).toBeNull()
    cleanup()
    const { container: c2 } = renderTopbar({ notificationDotVisible: false })
    expect(c2.querySelector('[data-topbar-icon-btn="notifications"] [data-topbar-icon-dot]')).toBeNull()
  })

  it('=true → 渲染 8px 红点（var(--state-error-border)）', () => {
    const { container } = renderTopbar({ notificationDotVisible: true })
    const dot = container.querySelector('[data-topbar-icon-btn="notifications"] [data-topbar-icon-dot]') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.style.width).toBe('8px')
    expect(dot.style.height).toBe('8px')
    expect(dot.style.background).toContain('--state-error-border')
  })

  it('其他图标按钮不显示红点', () => {
    const { container } = renderTopbar({ notificationDotVisible: true })
    expect(container.querySelector('[data-topbar-icon-btn="tasks"] [data-topbar-icon-dot]')).toBeNull()
    expect(container.querySelector('[data-topbar-icon-btn="settings"] [data-topbar-icon-dot]')).toBeNull()
  })
})
