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

  it('SSR shortcut 文案走 SSR 默认（"Ctrl+1" 等，hydration-safe）', () => {
    const html = renderToString(
      <Sidebar
        nav={NAV}
        activeHref="/admin"
        collapsed={true}  // 折叠态使用 title attribute 显示 shortcut
        user={USER}
        onToggleCollapsed={NOOP}
        onNavigate={NOOP}
        onUserMenuAction={NOOP}
      />,
    )
    // 折叠态 title attribute 含 label + (Ctrl+1) 等 — useFormatShortcut SSR 走 isMac=false 默认
    expect(html).toContain('Ctrl+1')
    expect(html).toContain('Ctrl+2')
  })
})
