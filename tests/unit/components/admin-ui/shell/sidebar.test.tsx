/**
 * Sidebar 渲染单测（CHG-SN-2-08）
 *
 * 覆盖：5 组 NAV / activeHref 高亮 / counts 优先级 / 计数缩写 / badge 配色 /
 * collapsed 折叠态（标题隐藏 + divider + pip）/ Brand 区 / Footer / aria attributes
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Sidebar, formatCount } from '../../../../../packages/admin-ui/src/shell/sidebar'
import type { AdminNavSection, AdminShellUser } from '../../../../../packages/admin-ui/src/shell/types'

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
      { label: '管理台站', href: '/admin', shortcut: 'mod+1' },
      { label: '内容审核', href: '/admin/moderation', count: 484, badge: 'warn', shortcut: 'mod+2' },
    ],
  },
  {
    title: '内容资产',
    items: [
      { label: '视频库', href: '/admin/videos', shortcut: 'mod+3' },
      { label: '播放线路', href: '/admin/sources', count: 1939, badge: 'danger' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { label: '用户管理', href: '/admin/users' },
      { label: '站点设置', href: '/admin/system/settings', shortcut: 'mod+,' },
    ],
  },
]

const NOOP = vi.fn()

function renderSidebar(overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  return render(
    <Sidebar
      nav={NAV}
      activeHref="/admin"
      collapsed={false}
      user={USER}
      onToggleCollapsed={NOOP}
      onNavigate={NOOP}
      onUserMenuAction={NOOP}
      {...overrides}
    />,
  )
}

describe('Sidebar — 容器 + a11y', () => {
  it('容器含 nav role + aria-label="主导航" + data-sidebar', () => {
    const { container } = renderSidebar()
    const aside = container.querySelector('[data-sidebar]')
    expect(aside?.tagName).toBe('ASIDE')
    expect(aside?.getAttribute('role')).toBe('navigation')
    expect(aside?.getAttribute('aria-label')).toBe('主导航')
  })

  it('collapsed=true → data-collapsed="true" + width var(--sidebar-w-collapsed)', () => {
    const { container } = renderSidebar({ collapsed: true })
    const aside = container.querySelector('[data-sidebar]') as HTMLElement
    expect(aside.getAttribute('data-collapsed')).toBe('true')
    expect(aside.style.width).toBe('var(--sidebar-w-collapsed)')
  })

  it('collapsed=false → data-collapsed="false" + width var(--sidebar-w)', () => {
    const { container } = renderSidebar({ collapsed: false })
    const aside = container.querySelector('[data-sidebar]') as HTMLElement
    expect(aside.getAttribute('data-collapsed')).toBe('false')
    expect(aside.style.width).toBe('var(--sidebar-w)')
  })
})

describe('Sidebar — Brand 区', () => {
  it('展开态：渲染 logo + "流光后台" + "v2"', () => {
    renderSidebar({ collapsed: false })
    expect(screen.getByText('流')).toBeTruthy()
    expect(screen.getByText('流光后台')).toBeTruthy()
    expect(screen.getByText('v2')).toBeTruthy()
  })

  it('折叠态：仅 logo（标题隐藏）', () => {
    renderSidebar({ collapsed: true })
    expect(screen.getByText('流')).toBeTruthy()
    expect(screen.queryByText('流光后台')).toBeNull()
    expect(screen.queryByText('v2')).toBeNull()
  })
})

describe('Sidebar — 5 组 NAV 渲染', () => {
  it('展开态：渲染所有 group title', () => {
    renderSidebar({ collapsed: false })
    expect(screen.getByText('运营中心')).toBeTruthy()
    expect(screen.getByText('内容资产')).toBeTruthy()
    expect(screen.getByText('系统管理')).toBeTruthy()
  })

  it('折叠态：group title 隐藏；后续组以 divider 替代', () => {
    const { container } = renderSidebar({ collapsed: true })
    expect(screen.queryByText('运营中心')).toBeNull()
    // divider 数量 = group 数 - 1（首组无 divider）
    const sections = container.querySelectorAll('[data-sidebar-section]')
    expect(sections.length).toBe(3)
  })

  it('每项渲染 button + data-sidebar-item attribute', () => {
    const { container } = renderSidebar()
    expect(container.querySelector('[data-sidebar-item="/admin"]')).toBeTruthy()
    expect(container.querySelector('[data-sidebar-item="/admin/moderation"]')).toBeTruthy()
    expect(container.querySelector('[data-sidebar-item="/admin/videos"]')).toBeTruthy()
  })

  it('button type="button"（防 submit 误触发，沿用 CHG-SN-2-05/07 范式）', () => {
    const { container } = renderSidebar()
    const button = container.querySelector('[data-sidebar-item="/admin"]') as HTMLButtonElement
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
  })
})

describe('Sidebar — activeHref 高亮', () => {
  it('activeHref 项标 data-sidebar-item-active="true"', () => {
    const { container } = renderSidebar({ activeHref: '/admin/moderation' })
    expect(
      container.querySelector('[data-sidebar-item="/admin/moderation"]')?.getAttribute('data-sidebar-item-active'),
    ).toBe('true')
    // 非 active 项无该 attribute
    expect(
      container.querySelector('[data-sidebar-item="/admin"]')?.getAttribute('data-sidebar-item-active'),
    ).toBeNull()
  })
})

describe('Sidebar — counts 优先级（runtime > static）', () => {
  it('counts.get(href) 提供 → 使用 runtime 值（覆盖静态 count）', () => {
    const counts = new Map<string, number>([['/admin/moderation', 999]])
    renderSidebar({ counts })
    // 静态 count=484，被 runtime 999 覆盖
    expect(screen.queryByText('999')).toBeTruthy()
    expect(screen.queryByText('484')).toBeNull()
  })

  it('counts 未提供 → 回退 AdminNavItem.count', () => {
    renderSidebar({})
    expect(screen.getByText('484')).toBeTruthy()
  })

  it('counts.get(href) undefined → 回退 AdminNavItem.count', () => {
    const counts = new Map<string, number>([['/admin', 5]])  // 不含 moderation
    renderSidebar({ counts })
    expect(screen.getByText('484')).toBeTruthy()  // moderation 仍走静态值
    expect(screen.getByText('5')).toBeTruthy()    // /admin 走 runtime
  })
})

describe('Sidebar — 计数 >999 缩写规则', () => {
  it('count=1939 → "1.9k"', () => {
    renderSidebar()
    expect(screen.getByText('1.9k')).toBeTruthy()
  })

  it('formatCount 边界：999→"999" / 1000→"1.0k" / 12345→"12.3k"', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1000)).toBe('1.0k')
    expect(formatCount(1234)).toBe('1.2k')
    expect(formatCount(12345)).toBe('12.3k')
  })
})

describe('Sidebar — badge 配色映射 semantic.status token', () => {
  it('badge=warn → background var(--state-warning-bg) + color var(--state-warning-fg)', () => {
    const { container } = renderSidebar()
    const moderationItem = container.querySelector('[data-sidebar-item="/admin/moderation"]') as HTMLElement
    const badge = moderationItem.querySelector('[data-sidebar-item-badge]') as HTMLElement
    expect(badge.style.background).toContain('--state-warning-bg')
    expect(badge.style.color).toContain('--state-warning-fg')
  })

  it('badge=danger → state-error', () => {
    const { container } = renderSidebar()
    const sourcesItem = container.querySelector('[data-sidebar-item="/admin/sources"]') as HTMLElement
    const badge = sourcesItem.querySelector('[data-sidebar-item-badge]') as HTMLElement
    expect(badge.style.background).toContain('--state-error-bg')
  })

  it('无 badge → 默认背景 var(--bg-surface-elevated) + 颜色 var(--fg-muted)', () => {
    const navWithoutBadge: readonly AdminNavSection[] = [
      { title: '组', items: [{ label: '项', href: '/x', count: 5 }] },
    ]
    const { container } = render(
      <Sidebar
        nav={navWithoutBadge}
        activeHref=""
        collapsed={false}
        user={USER}
        onToggleCollapsed={NOOP}
        onNavigate={NOOP}
        onUserMenuAction={NOOP}
      />,
    )
    const item = container.querySelector('[data-sidebar-item="/x"]') as HTMLElement
    const badge = item.querySelector('[data-sidebar-item-badge]') as HTMLElement
    expect(badge.style.background).toContain('--bg-surface-elevated')
  })
})

describe('Sidebar — 折叠态 pip badge', () => {
  it('折叠态 + 有 count → 渲染 pip（小圆点 8px）', () => {
    const { container } = renderSidebar({ collapsed: true })
    const moderationItem = container.querySelector('[data-sidebar-item="/admin/moderation"]') as HTMLElement
    const pip = moderationItem.querySelector('[data-sidebar-item-pip]') as HTMLElement
    expect(pip).toBeTruthy()
    expect(pip.style.width).toBe('8px')
    expect(pip.style.height).toBe('8px')
    expect(pip.style.background).toContain('--state-warning-border')
  })

  it('折叠态 + 无 count → 不渲染 pip', () => {
    const { container } = renderSidebar({ collapsed: true })
    const dashboardItem = container.querySelector('[data-sidebar-item="/admin"]') as HTMLElement
    expect(dashboardItem.querySelector('[data-sidebar-item-pip]')).toBeNull()
  })

  it('展开态 → 不渲染 pip（用 badge 替代）', () => {
    const { container } = renderSidebar({ collapsed: false })
    const moderationItem = container.querySelector('[data-sidebar-item="/admin/moderation"]') as HTMLElement
    expect(moderationItem.querySelector('[data-sidebar-item-pip]')).toBeNull()
    expect(moderationItem.querySelector('[data-sidebar-item-badge]')).toBeTruthy()
  })
})

describe('Sidebar — Footer 用户区', () => {
  it('展开态：avatar + displayName + role 标签', () => {
    renderSidebar({ collapsed: false })
    expect(screen.getByText('YL')).toBeTruthy()  // deriveAvatarText("Yan Liu") = "YL"
    expect(screen.getByText('Yan Liu')).toBeTruthy()
    expect(screen.getByText('管理员')).toBeTruthy()
  })

  it('折叠态：仅 avatar（name + role 隐藏）', () => {
    renderSidebar({ collapsed: true })
    expect(screen.getByText('YL')).toBeTruthy()
    expect(screen.queryByText('Yan Liu')).toBeNull()
    expect(screen.queryByText('管理员')).toBeNull()
  })

  it('Footer button 含 aria-haspopup="menu" + aria-expanded="false"（菜单默认关闭）', () => {
    const { container } = renderSidebar()
    const foot = container.querySelector('[data-sidebar-foot]')
    expect(foot?.getAttribute('aria-haspopup')).toBe('menu')
    expect(foot?.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Sidebar — 折叠按钮', () => {
  it('展开态 button label "‹‹ 折叠" + aria-label "折叠侧栏"', () => {
    const { container } = renderSidebar({ collapsed: false })
    const btn = container.querySelector('[data-sidebar-collapse]') as HTMLButtonElement
    expect(btn.getAttribute('aria-label')).toBe('折叠侧栏')
    expect(btn.textContent).toContain('折叠')
  })

  it('折叠态 button label "››" + aria-label "展开侧栏"', () => {
    const { container } = renderSidebar({ collapsed: true })
    const btn = container.querySelector('[data-sidebar-collapse]') as HTMLButtonElement
    expect(btn.getAttribute('aria-label')).toBe('展开侧栏')
  })

  it('button type="button"（防 form submit + Enter/Space 通过原生 button 行为生效）', () => {
    const { container } = renderSidebar()
    const btn = container.querySelector('[data-sidebar-collapse]') as HTMLButtonElement
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })
})

describe('Sidebar — 边界场景（P2 单测补全 / Opus 评审建议）', () => {
  it('count=0 → 不渲染 badge / pip', () => {
    const navWithZero: readonly AdminNavSection[] = [
      { title: '组', items: [{ label: '项', href: '/x', count: 0, badge: 'warn' }] },
    ]
    const { container } = render(
      <Sidebar
        nav={navWithZero}
        activeHref="/x"
        collapsed={false}
        user={USER}
        onToggleCollapsed={NOOP}
        onNavigate={NOOP}
        onUserMenuAction={NOOP}
      />,
    )
    const item = container.querySelector('[data-sidebar-item="/x"]') as HTMLElement
    expect(item.querySelector('[data-sidebar-item-badge]')).toBeNull()
    expect(item.querySelector('[data-sidebar-item-pip]')).toBeNull()
  })

  it('activeHref 不存在于 nav → 无任何项高亮', () => {
    const { container } = renderSidebar({ activeHref: '/admin/does-not-exist' })
    const allActive = container.querySelectorAll('[data-sidebar-item-active="true"]')
    expect(allActive.length).toBe(0)
  })

  it('AdminNavItem.children 嵌套 → 当前 Sidebar 不渲染二级（M-SN-2 契约锁定）', () => {
    const navWithChildren: readonly AdminNavSection[] = [
      {
        title: '系统',
        items: [
          {
            label: '系统设置',
            href: '/admin/system',
            children: [
              { label: '缓存', href: '/admin/system/cache' },
            ],
          },
        ],
      },
    ]
    const { container } = render(
      <Sidebar
        nav={navWithChildren}
        activeHref="/admin/system"
        collapsed={false}
        user={USER}
        onToggleCollapsed={NOOP}
        onNavigate={NOOP}
        onUserMenuAction={NOOP}
      />,
    )
    // 父项 渲染
    expect(container.querySelector('[data-sidebar-item="/admin/system"]')).toBeTruthy()
    // 子项 不渲染（M-SN-2 不引入二级展开，与 AdminNavItem 5 字段语义说明表一致）
    expect(container.querySelector('[data-sidebar-item="/admin/system/cache"]')).toBeNull()
  })

  it('Footer wrapper 含 position: relative（P1 必修：稳定 UserMenu inline fallback 定位锚点）', () => {
    const { container } = renderSidebar()
    const wrapper = container.querySelector('[data-sidebar-foot-wrapper]') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.position).toBe('relative')
  })
})
