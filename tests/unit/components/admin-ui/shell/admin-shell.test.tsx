/**
 * AdminShell 渲染 + 交互单测（CHG-SN-2-12）
 *
 * 覆盖：基础渲染（Sidebar/Topbar/main/children）/ collapsed 受控与非受控 /
 *       Drawer 互斥开闭 / CmdK 开闭 / onCollapsedChange 回调 / onNavigate 回调
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { AdminShell } from '../../../../../packages/admin-ui/src/shell/admin-shell'
import type { AdminShellProps } from '../../../../../packages/admin-ui/src/shell/admin-shell'
import type { AdminNavSection, AdminShellUser } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

const NAV: readonly AdminNavSection[] = [
  {
    title: '运营中心',
    items: [
      { label: '管理台站', href: '/admin', shortcut: 'mod+1' },
      { label: '内容审核', href: '/admin/moderation', count: 12, badge: 'warn', shortcut: 'mod+2' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { label: '站点设置', href: '/admin/system/settings', shortcut: 'mod+,' },
    ],
  },
]

const USER: AdminShellUser = {
  id: 'u1',
  displayName: 'Test User',
  email: 'test@example.com',
  role: 'admin',
}

const ICONS = {
  search: null,
  theme: null,
  notifications: null,
  tasks: null,
  settings: null,
}

const NOOP = vi.fn()

function renderShell(overrides: Partial<AdminShellProps> = {}) {
  return render(
    <AdminShell
      nav={NAV}
      activeHref="/admin"
      topbarIcons={ICONS}
      user={USER}
      theme="dark"
      onNavigate={NOOP}
      onThemeToggle={NOOP}
      onUserMenuAction={NOOP}
      {...overrides}
    >
      <div data-testid="page-content">页面内容</div>
    </AdminShell>,
  )
}

describe('AdminShell — 基础渲染', () => {
  it('渲染 data-admin-shell 根容器', () => {
    const { container } = renderShell()
    expect(container.querySelector('[data-admin-shell]')).toBeTruthy()
  })

  it('渲染 Sidebar（[data-sidebar]）', () => {
    const { container } = renderShell()
    expect(container.querySelector('[data-sidebar]')).toBeTruthy()
  })

  it('渲染 Topbar（[data-topbar]）', () => {
    const { container } = renderShell()
    expect(container.querySelector('[data-topbar]')).toBeTruthy()
  })

  it('渲染 main 区（[data-admin-shell-main]）', () => {
    const { container } = renderShell()
    expect(container.querySelector('[data-admin-shell-main]')).toBeTruthy()
  })

  it('children 显示在 main 区内', () => {
    renderShell()
    expect(screen.getByTestId('page-content')).toBeTruthy()
    expect(screen.getByText('页面内容')).toBeTruthy()
  })
})

describe('AdminShell — collapsed 非受控模式', () => {
  it('defaultCollapsed=false 时 Sidebar data-collapsed="false"', () => {
    const { container } = renderShell({ defaultCollapsed: false })
    const sidebar = container.querySelector('[data-sidebar]')
    expect(sidebar?.getAttribute('data-collapsed')).toBe('false')
  })

  it('defaultCollapsed=true 时 Sidebar data-collapsed="true"', () => {
    const { container } = renderShell({ defaultCollapsed: true })
    const sidebar = container.querySelector('[data-sidebar]')
    expect(sidebar?.getAttribute('data-collapsed')).toBe('true')
  })

  it('点击折叠按钮切换 collapsed 状态', () => {
    const { container } = renderShell({ defaultCollapsed: false })
    const collapseBtn = container.querySelector('[data-sidebar-collapse]')
    expect(collapseBtn).toBeTruthy()
    act(() => {
      fireEvent.click(collapseBtn!)
    })
    const sidebar = container.querySelector('[data-sidebar]')
    expect(sidebar?.getAttribute('data-collapsed')).toBe('true')
  })

  it('点击折叠按钮触发 onCollapsedChange 回调', () => {
    const onCollapsedChange = vi.fn()
    const { container } = renderShell({ defaultCollapsed: false, onCollapsedChange })
    const collapseBtn = container.querySelector('[data-sidebar-collapse]')
    act(() => {
      fireEvent.click(collapseBtn!)
    })
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
  })
})

describe('AdminShell — collapsed 受控模式', () => {
  it('collapsed=true 时 Sidebar data-collapsed="true"', () => {
    const { container } = renderShell({ collapsed: true })
    const sidebar = container.querySelector('[data-sidebar]')
    expect(sidebar?.getAttribute('data-collapsed')).toBe('true')
  })

  it('collapsed=false 时 Sidebar data-collapsed="false"', () => {
    const { container } = renderShell({ collapsed: false })
    const sidebar = container.querySelector('[data-sidebar]')
    expect(sidebar?.getAttribute('data-collapsed')).toBe('false')
  })

  it('受控模式点击折叠按钮触发 onCollapsedChange，状态由 prop 决定', () => {
    const onCollapsedChange = vi.fn()
    const { container } = renderShell({ collapsed: false, onCollapsedChange })
    const collapseBtn = container.querySelector('[data-sidebar-collapse]')
    act(() => {
      fireEvent.click(collapseBtn!)
    })
    // 受控模式：回调触发，但状态仍由外部 prop=false 决定（未 re-render with new prop）
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    const sidebar = container.querySelector('[data-sidebar]')
    expect(sidebar?.getAttribute('data-collapsed')).toBe('false')
  })
})

describe('AdminShell — Drawer 互斥', () => {
  const notifs = [{ id: 'n1', title: '消息', level: 'info' as const, createdAt: '2026-04-29T00:00:00Z', read: false }]
  const tasks = [{ id: 't1', title: '任务', status: 'running' as const, startedAt: '2026-04-29T00:00:00Z' }]

  it('通知图标点击打开 NotificationDrawer', () => {
    renderShell({ notifications: notifs })
    const notifyBtn = document.querySelector('[data-topbar-icon-btn="notifications"]')
    act(() => {
      fireEvent.click(notifyBtn!)
    })
    expect(document.body.querySelector('[data-drawer-panel="notifications"]')).toBeTruthy()
  })

  it('任务图标点击打开 TaskDrawer', () => {
    renderShell({ tasks })
    const taskBtn = document.querySelector('[data-topbar-icon-btn="tasks"]')
    act(() => {
      fireEvent.click(taskBtn!)
    })
    expect(document.body.querySelector('[data-drawer-panel="tasks"]')).toBeTruthy()
  })

  it('先打开 notifications 再打开 tasks → notifications 自动关', () => {
    renderShell({ notifications: notifs, tasks })
    act(() => {
      fireEvent.click(document.querySelector('[data-topbar-icon-btn="notifications"]')!)
    })
    expect(document.body.querySelector('[data-drawer-panel="notifications"]')).toBeTruthy()
    act(() => {
      fireEvent.click(document.querySelector('[data-topbar-icon-btn="tasks"]')!)
    })
    expect(document.body.querySelector('[data-drawer-panel="notifications"]')).toBeNull()
    expect(document.body.querySelector('[data-drawer-panel="tasks"]')).toBeTruthy()
  })
})

describe('AdminShell — CommandPalette', () => {
  it('搜索触发器点击打开 CommandPalette', () => {
    renderShell()
    const searchBtn = document.querySelector('[data-topbar-search]')
    act(() => {
      fireEvent.click(searchBtn!)
    })
    expect(document.body.querySelector('[data-command-palette]')).toBeTruthy()
  })

  it('notifications=undefined 时通知图标点击不打开 Drawer', () => {
    renderShell() // notifications prop 未传
    const notifyBtn = document.querySelector('[data-topbar-icon-btn="notifications"]')
    act(() => {
      fireEvent.click(notifyBtn!)
    })
    expect(document.body.querySelector('[data-drawer-panel="notifications"]')).toBeNull()
  })
})

describe('AdminShell — onNavigate 回调', () => {
  it('点击 Sidebar 导航项触发 onNavigate', () => {
    const onNavigate = vi.fn()
    const { container } = renderShell({ onNavigate })
    const adminBtn = container.querySelector('[data-sidebar-item="/admin"]')
    act(() => {
      fireEvent.click(adminBtn!)
    })
    expect(onNavigate).toHaveBeenCalledWith('/admin')
  })
})
