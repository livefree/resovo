/**
 * Sidebar 交互单测（CHG-SN-2-08）
 *
 * 覆盖：onNavigate / onToggleCollapsed / sb__foot 触发 UserMenu 弹出（portal） /
 * UserMenu 内菜单项点击 → onUserMenuAction(union)
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Sidebar } from '../../../../../packages/admin-ui/src/shell/sidebar'
import type { AdminNavSection, AdminShellUser, UserMenuAction } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

const USER: AdminShellUser = {
  id: 'u1',
  displayName: 'Yan Liu',
  email: 'yan@resovo.io',
  role: 'admin',
}

const NAV: readonly AdminNavSection[] = [
  {
    title: '运营中心',
    items: [
      { label: '管理台站', href: '/admin' },
      { label: '内容审核', href: '/admin/moderation' },
    ],
  },
]

describe('Sidebar — onNavigate 触发', () => {
  it('点击 NavItem → onNavigate(href)', () => {
    const onNavigate = vi.fn()
    render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={vi.fn()}
        onNavigate={onNavigate}
        onUserMenuAction={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('内容审核'))
    expect(onNavigate).toHaveBeenCalledWith('/admin/moderation')
  })

  it('点击 active 项也触发 onNavigate（消费方决定是否 noop）', () => {
    const onNavigate = vi.fn()
    render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={vi.fn()}
        onNavigate={onNavigate}
        onUserMenuAction={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('管理台站'))
    expect(onNavigate).toHaveBeenCalledWith('/admin')
  })
})

describe('Sidebar — onToggleCollapsed 触发', () => {
  it('点击折叠按钮 → onToggleCollapsed()', () => {
    const onToggleCollapsed = vi.fn()
    const { container } = render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={onToggleCollapsed}
        onNavigate={vi.fn()}
        onUserMenuAction={vi.fn()}
      />,
    )
    const btn = container.querySelector('[data-sidebar-collapse]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
  })
})

describe('Sidebar — sb__foot 触发 UserMenu 弹出（portal）', () => {
  it('点击 sb__foot → UserMenu portal 渲染到 document.body + aria-expanded="true"', () => {
    const { container } = render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={vi.fn()}
        onNavigate={vi.fn()}
        onUserMenuAction={vi.fn()}
      />,
    )
    // 默认 menuOpen=false，UserMenu 不渲染
    expect(document.body.querySelector('[data-user-menu-portal]')).toBeNull()
    const foot = container.querySelector('[data-sidebar-foot]') as HTMLButtonElement
    expect(foot.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(foot)
    // 点击后 portal 启用（anchorRef=foot 元素）
    expect(document.body.querySelector('[data-user-menu-portal]')).toBeTruthy()
    expect(foot.getAttribute('aria-expanded')).toBe('true')
  })

  it('再次点击 sb__foot → menu 关闭（toggle）', () => {
    const { container } = render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={vi.fn()}
        onNavigate={vi.fn()}
        onUserMenuAction={vi.fn()}
      />,
    )
    const foot = container.querySelector('[data-sidebar-foot]') as HTMLButtonElement
    fireEvent.click(foot)
    expect(document.body.querySelector('[data-user-menu-portal]')).toBeTruthy()
    fireEvent.click(foot)
    expect(document.body.querySelector('[data-user-menu-portal]')).toBeNull()
  })
})

describe('Sidebar — UserMenu 菜单项点击触发 onUserMenuAction(union)', () => {
  it('点击登出 → onUserMenuAction("logout") + 菜单自动关闭', () => {
    const onUserMenuAction = vi.fn<[UserMenuAction], void>()
    const { container } = render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={vi.fn()}
        onNavigate={vi.fn()}
        onUserMenuAction={onUserMenuAction}
      />,
    )
    const foot = container.querySelector('[data-sidebar-foot]') as HTMLButtonElement
    fireEvent.click(foot)
    // 点击 logout 按钮（在 portal 内）
    const logoutBtn = document.body.querySelector('[data-menu-item="logout"]') as HTMLButtonElement
    expect(logoutBtn).toBeTruthy()
    fireEvent.click(logoutBtn)
    expect(onUserMenuAction).toHaveBeenCalledWith('logout')
    // 菜单自动关闭（UserMenu try/finally 调 onOpenChange(false)）
    expect(document.body.querySelector('[data-user-menu-portal]')).toBeNull()
  })

  it('点击主题切换 → onUserMenuAction("theme")', () => {
    const onUserMenuAction = vi.fn<[UserMenuAction], void>()
    const { container } = render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={vi.fn()}
        onNavigate={vi.fn()}
        onUserMenuAction={onUserMenuAction}
      />,
    )
    const foot = container.querySelector('[data-sidebar-foot]') as HTMLButtonElement
    fireEvent.click(foot)
    const themeBtn = document.body.querySelector('[data-menu-item="theme"]') as HTMLButtonElement
    fireEvent.click(themeBtn)
    expect(onUserMenuAction).toHaveBeenCalledWith('theme')
  })

  it('全 6 项菜单都渲染（onUserMenuAction union 模式 — 不支持的 action 走 noop 由消费方决定）', () => {
    const { container } = render(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={vi.fn()}
        onNavigate={vi.fn()}
        onUserMenuAction={vi.fn()}
      />,
    )
    const foot = container.querySelector('[data-sidebar-foot]') as HTMLButtonElement
    fireEvent.click(foot)
    const items = document.body.querySelectorAll('[data-menu-item]')
    // 6 项：profile / preferences / theme / help / switchAccount / logout
    expect(items.length).toBe(6)
  })
})
