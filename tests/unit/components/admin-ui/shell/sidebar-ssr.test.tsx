/**
 * Sidebar SSR 单测（CHG-SN-2-08 范式遵守 — Shell 范式章法 5）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - renderToString 零 throw（含 NavItem useFormatShortcut hook）
 *   - SSR 输出 5 组 + Brand + Footer + 各 NavItem
 *   - UserMenu 默认 closed → 不输出 portal（anchorRef.current 在 SSR null）
 *   - shortcut 文案走 SSR 默认（"Ctrl+1" 等，hydration-safe）
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Sidebar } from '../../../../../packages/admin-ui/src/shell/sidebar'
import type { AdminNavSection, AdminShellUser } from '../../../../../packages/admin-ui/src/shell/types'

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
      { label: '管理台站', href: '/admin', shortcut: 'mod+1' },
      { label: '内容审核', href: '/admin/moderation', count: 484, badge: 'warn', shortcut: 'mod+2' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { label: '站点设置', href: '/admin/system/settings', shortcut: 'mod+,' },
    ],
  },
]

const NOOP = () => {}

describe('Sidebar — SSR renderToString（ADR-103a §4.4-2）', () => {
  it('renderToString 不抛错（展开态）', () => {
    expect(() =>
      renderToString(
        <Sidebar
          nav={NAV}
          activeHref="/admin"
          collapsed={false}
          user={USER}
          onToggleCollapsed={NOOP}
          onNavigate={NOOP}
          onUserMenuAction={NOOP}
        />,
      ),
    ).not.toThrow()
  })

  it('renderToString 不抛错（折叠态）', () => {
    expect(() =>
      renderToString(
        <Sidebar
          nav={NAV}
          activeHref="/admin"
          collapsed={true}
          user={USER}
          onToggleCollapsed={NOOP}
          onNavigate={NOOP}
          onUserMenuAction={NOOP}
        />,
      ),
    ).not.toThrow()
  })

  it('SSR 输出含 5 组 + Brand + Footer 关键文案', () => {
    const html = renderToString(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={NOOP}
        onNavigate={NOOP}
        onUserMenuAction={NOOP}
      />,
    )
    // Brand
    expect(html).toContain('流')
    expect(html).toContain('流光后台')
    expect(html).toContain('v2')
    // Group title
    expect(html).toContain('运营中心')
    expect(html).toContain('系统管理')
    // NAV items
    expect(html).toContain('管理台站')
    expect(html).toContain('内容审核')
    expect(html).toContain('站点设置')
    // Footer
    expect(html).toContain('Yan Liu')
    expect(html).toContain('管理员')
    // a11y
    expect(html).toContain('aria-label="主导航"')
    expect(html).toContain('aria-haspopup="menu"')
  })

  it('SSR 输出 UserMenu 默认 closed → 无 portal wrapper', () => {
    const html = renderToString(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={false}
        user={USER}
        onToggleCollapsed={NOOP}
        onNavigate={NOOP}
        onUserMenuAction={NOOP}
      />,
    )
    expect(html).not.toContain('data-user-menu-portal')
    expect(html).not.toContain('data-user-menu')
  })

  it('SSR 折叠态不渲染 NavTip（hover 才挂载 portal，且仅在 client 端）', () => {
    // CHG-DESIGN-05：自定义 NavTip 替换原生 title attribute
    // SSR 路径下 hoveredNav 永远为 null → NavTip 不挂载 → SSR 输出无 nav-tip 标记
    // shortcut kbd 仅在 client mouseenter 触发后渲染（详见 sidebar.test.tsx NavTip 行为单测）
    const html = renderToString(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={true}
        user={USER}
        onToggleCollapsed={NOOP}
        onNavigate={NOOP}
        onUserMenuAction={NOOP}
      />,
    )
    expect(html).not.toContain('data-sidebar-nav-tip')
    // NavItem 不再带 title attribute
    expect(html).not.toMatch(/data-sidebar-item="\/admin"[^>]*\stitle=/)
  })
})
