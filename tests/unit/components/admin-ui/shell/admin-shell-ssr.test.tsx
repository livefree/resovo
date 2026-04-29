/**
 * AdminShell SSR 单测（CHG-SN-2-12）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - renderToString 不抛错（SSR 零 throw）
 *   - Sidebar / Topbar 等同步渲染结构出现在输出中
 *   - Portal 组件（CommandPalette / Drawers）SSR 输出 null（React 18 createPortal SSR 行为）
 *   - SSR 输出包含预期 data-* 属性（data-admin-shell / data-sidebar / data-topbar）
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AdminShell } from '../../../../../packages/admin-ui/src/shell/admin-shell'
import type { AdminNavSection, AdminShellUser } from '../../../../../packages/admin-ui/src/shell/types'

const NAV: readonly AdminNavSection[] = [
  {
    title: '运营中心',
    items: [
      { label: '管理台站', href: '/admin', shortcut: 'mod+1' },
    ],
  },
]

const USER: AdminShellUser = {
  id: 'u1',
  displayName: '管理员',
  email: 'admin@resovo.io',
  role: 'admin',
}

const ICONS = {
  search: null,
  theme: null,
  notifications: null,
  tasks: null,
  settings: null,
}

const NOOP = () => {}

describe('AdminShell — SSR renderToString 零 throw', () => {
  it('基础 props → renderToString 不抛错', () => {
    expect(() =>
      renderToString(
        <AdminShell
          nav={NAV}
          activeHref="/admin"
          topbarIcons={ICONS}
          user={USER}
          theme="dark"
          onNavigate={NOOP}
          onThemeToggle={NOOP}
          onUserMenuAction={NOOP}
        >
          <div>children</div>
        </AdminShell>,
      ),
    ).not.toThrow()
  })

  it('defaultCollapsed=true → renderToString 不抛错', () => {
    expect(() =>
      renderToString(
        <AdminShell
          nav={NAV}
          activeHref="/admin"
          topbarIcons={ICONS}
          user={USER}
          theme="dark"
          defaultCollapsed={true}
          onNavigate={NOOP}
          onThemeToggle={NOOP}
          onUserMenuAction={NOOP}
        >
          <div>children</div>
        </AdminShell>,
      ),
    ).not.toThrow()
  })

  it('notifications + tasks 提供 → renderToString 不抛错', () => {
    expect(() =>
      renderToString(
        <AdminShell
          nav={NAV}
          activeHref="/admin"
          topbarIcons={ICONS}
          user={USER}
          theme="light"
          notifications={[]}
          tasks={[]}
          onNavigate={NOOP}
          onThemeToggle={NOOP}
          onUserMenuAction={NOOP}
        >
          <span>child</span>
        </AdminShell>,
      ),
    ).not.toThrow()
  })
})

describe('AdminShell — SSR 输出结构', () => {
  it('输出含 data-admin-shell', () => {
    const html = renderToString(
      <AdminShell
        nav={NAV}
        activeHref="/admin"
        topbarIcons={ICONS}
        user={USER}
        theme="dark"
        onNavigate={NOOP}
        onThemeToggle={NOOP}
        onUserMenuAction={NOOP}
      >
        <div>child</div>
      </AdminShell>,
    )
    expect(html).toContain('data-admin-shell')
  })

  it('输出含 data-sidebar', () => {
    const html = renderToString(
      <AdminShell
        nav={NAV}
        activeHref="/admin"
        topbarIcons={ICONS}
        user={USER}
        theme="dark"
        onNavigate={NOOP}
        onThemeToggle={NOOP}
        onUserMenuAction={NOOP}
      >
        <div>child</div>
      </AdminShell>,
    )
    expect(html).toContain('data-sidebar')
  })

  it('输出含 data-topbar', () => {
    const html = renderToString(
      <AdminShell
        nav={NAV}
        activeHref="/admin"
        topbarIcons={ICONS}
        user={USER}
        theme="dark"
        onNavigate={NOOP}
        onThemeToggle={NOOP}
        onUserMenuAction={NOOP}
      >
        <div>child</div>
      </AdminShell>,
    )
    expect(html).toContain('data-topbar')
  })

  it('children 内容出现在 SSR 输出中', () => {
    const html = renderToString(
      <AdminShell
        nav={NAV}
        activeHref="/admin"
        topbarIcons={ICONS}
        user={USER}
        theme="dark"
        onNavigate={NOOP}
        onThemeToggle={NOOP}
        onUserMenuAction={NOOP}
      >
        <div data-testid="ssr-child">SSR-CONTENT</div>
      </AdminShell>,
    )
    expect(html).toContain('SSR-CONTENT')
  })

  it('CommandPalette（closed）+ Drawer（closed）SSR 输出 null（portal SSR 安全）', () => {
    const html = renderToString(
      <AdminShell
        nav={NAV}
        activeHref="/admin"
        topbarIcons={ICONS}
        user={USER}
        theme="dark"
        notifications={[]}
        tasks={[]}
        onNavigate={NOOP}
        onThemeToggle={NOOP}
        onUserMenuAction={NOOP}
      >
        <div>child</div>
      </AdminShell>,
    )
    // portal 组件 open=false 时 return null，不出现在 SSR 输出中
    expect(html).not.toContain('data-command-palette')
    expect(html).not.toContain('data-drawer-panel')
  })
})
