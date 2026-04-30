'use client'

/**
 * sidebar.tsx — admin Shell 侧栏（ADR-103a §4.1.2）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.2 Sidebar + SidebarProps
 *   - ADR-100 IA 修订段 v1（5 组结构：运营中心 / 内容资产 / 首页运营 / 采集中心 / 系统管理）
 *   - admin-layout token shell.ts（sidebar-w / sidebar-w-collapsed / topbar-h）
 *   - ADR-103a §4.4 4 项硬约束
 *   - 设计稿 v2.1 shell.jsx Sidebar 实现（sb__brand / sb__nav / sb__foot / sb__collapse）
 *
 * 组件形态：
 *   章法 1B 纯工具二件套 — sidebar.tsx 单文件，含多个内部子组件（NavItem / BrandArea / Footer）
 *   不引入子目录结构（保持 shell/ 平铺；多 Shell 组件已建立此模式）
 *
 * 设计要点：
 *   - 5 组 NAV 渲染：每组 group title（折叠态隐藏 / 折叠态用 divider 替代）+ 项列表
 *   - NavItem：icon + label + 计数徽章
 *     · 计数优先级：counts.get(item.href) 运行时值 > AdminNavItem.count 静态值（与 ADR-103a §4.2 fix 后注释一致）
 *     · 显示规则：>999 → "1.2k" 缩写（formatCount helper）
 *     · badge 配色：info/warn/danger → semantic.status token slot
 *     · 折叠态：仅 icon + 计数 pip（小圆点 8px）+ tooltip（title attribute + label + shortcut 文案）
 *     · activeHref 高亮：背景 var(--admin-accent-soft) + 前景 var(--admin-accent-on-soft)
 *       —— admin-accent-on-soft 是 CHG-DESIGN-04 引入的"fg-on-accent-soft"语义入口，
 *       指向 var(--accent-active)（light 38% / dark 92%），与 admin-accent-soft 在两
 *       主题下对比度 ≥7:1（满足 WCAG AA）。
 *     · shortcut 渲染用 useFormatShortcut hook（hydration-safe；NavItem 子组件内每项独立调用）
 *   - Brand 区：流光 logo + 标题（折叠态隐藏标题）+ 版本 v2
 *   - Footer：sb__foot 触发 UserMenu 弹出
 *     · 内部维护 menuOpen state（受控于 Sidebar 本身，与 collapsed/activeHref 等外部受控分离）
 *     · sb__foot 元素 ref 作为 anchorRef 传给 UserMenu → portal + 上方对齐定位（z-shell-drawer）
 *     · 折叠态：仅 avatar；展开态：avatar + name + role
 *     · onUserMenuAction(union) 通过 useMemo 映射为 AdminUserActions 6 callbacks 传给 UserMenu
 *   - 折叠按钮：底部触发 onToggleCollapsed（与 KeyboardShortcuts ⌘B 由消费方装配同步）
 *   - collapsed 切换：width var(--sidebar-w) ↔ var(--sidebar-w-collapsed)
 *
 * 不做：
 *   - 不持有 NAV 数据（props 注入；与 ADR §4.4-1 Provider 不下沉一致）
 *   - 不持久化 collapsed（消费方用 cookie 持久化后通过 prop 注入）
 *   - 不直接调用 router.push（onNavigate prop）
 *   - 不实现自定义 tooltip 浮层（用 title attribute；如设计稿要求自定义 NavTip 浮层，后续 fix）
 *
 * 跨域消费：本文件被 packages/admin-ui AdminShell 装配编排（CHG-SN-2-12）；
 * server-next 应用层不应直接 import（应通过 AdminShell.props 间接消费）。
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useFormatShortcut } from './platform'
import { UserMenu, deriveAvatarText } from './user-menu'
import type { AdminNavItem, AdminNavSection, AdminShellUser, AdminUserActions, UserMenuAction } from './types'

export interface SidebarProps {
  readonly nav: readonly AdminNavSection[]
  readonly activeHref: string
  readonly collapsed: boolean
  readonly user: AdminShellUser
  readonly onToggleCollapsed: () => void
  readonly onNavigate: (href: string) => void
  readonly onUserMenuAction: (action: UserMenuAction) => void
  /** count provider 已求值结果（AdminShell 调度层传入；Sidebar 不持有 provider 本体）*/
  readonly counts?: ReadonlyMap<string, number>
}

const ASIDE_STYLE_BASE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: 'var(--bg-surface)',
  borderRight: '1px solid var(--border-default)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm)',
  flexShrink: 0,
}

const BRAND_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: '0 var(--space-4)',
  height: 'var(--topbar-h)',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
  boxSizing: 'border-box',
}

const LOGO_STYLE: CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: 'var(--font-size-base)',
  flexShrink: 0,
}

const BRAND_TITLE_STYLE: CSSProperties = {
  fontWeight: 600,
  color: 'var(--fg-default)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}

const BRAND_VERSION_STYLE: CSSProperties = {
  marginLeft: 'var(--space-1)',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

const NAV_SCROLL_STYLE: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-2) 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
}

const SECTION_TITLE_STYLE: CSSProperties = {
  // height 与 padding 在两态保持一致，CSS 仅切 opacity，确保图标 Y 坐标稳定
  // 折叠态隐显由 admin-shell-styles 的 [data-sidebar][data-collapsed="true"] [data-sidebar-section-title] 接管
  padding: 'var(--space-1) var(--space-4)',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const COLLAPSE_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  // borderTop 在 border: 0 后声明，确保 shorthand 不覆盖 longhand
  borderTop: '1px solid var(--border-subtle)',
  padding: 'var(--space-2) var(--space-4)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
  fontSize: 'var(--font-size-xs)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
}

export function Sidebar({
  nav,
  activeHref,
  collapsed,
  user,
  onToggleCollapsed,
  onNavigate,
  onUserMenuAction,
  counts,
}: SidebarProps) {
  const cmdBLabel = useFormatShortcut('mod+b')

  // onUserMenuAction(union) → AdminUserActions 拆分（叶子层 UserMenu 消费）
  // 全 6 项 actions 都映射到 onUserMenuAction；消费方在 onUserMenuAction 内分派 + 不支持的 action 走 noop
  const userActions: AdminUserActions = useMemo(
    () => ({
      onProfile: () => onUserMenuAction('profile'),
      onPreferences: () => onUserMenuAction('preferences'),
      onToggleTheme: () => onUserMenuAction('theme'),
      onHelp: () => onUserMenuAction('help'),
      onSwitchAccount: () => onUserMenuAction('switchAccount'),
      onLogout: () => onUserMenuAction('logout'),
    }),
    [onUserMenuAction],
  )

  return (
    <aside
      role="navigation"
      aria-label="主导航"
      data-sidebar
      data-collapsed={collapsed ? 'true' : 'false'}
      style={{
        ...ASIDE_STYLE_BASE,
        width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      }}
    >
      <BrandArea collapsed={collapsed} />
      <nav data-sidebar-nav style={NAV_SCROLL_STYLE}>
        {nav.map((section) => (
          <div key={section.title} data-sidebar-section={section.title}>
            {/* 永远渲染分区标题；折叠态由 admin-shell-styles 通过 opacity 渐隐 */}
            {/* 保持高度占位 → 切换 collapsed 时图标 Y 坐标稳定（reference.md §4.1.2 问题 B） */}
            <div data-sidebar-section-title style={SECTION_TITLE_STYLE}>
              {section.title}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavItem
                    item={item}
                    active={item.href === activeHref}
                    collapsed={collapsed}
                    runtimeCount={counts?.get(item.href)}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <Footer
        user={user}
        collapsed={collapsed}
        userActions={userActions}
      />
      <button
        type="button"
        data-sidebar-collapse
        aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
        onClick={onToggleCollapsed}
        style={COLLAPSE_BTN_STYLE}
      >
        <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
        {!collapsed && <span>折叠</span>}
        {cmdBLabel && (
          <kbd
            aria-hidden="true"
            style={{
              marginLeft: 'auto',
              padding: '1px var(--space-1)',
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'monospace',
              color: 'var(--fg-muted)',
            }}
          >
            {cmdBLabel}
          </kbd>
        )}
      </button>
    </aside>
  )
}

// ── 内部子组件 ────────────────────────────────────────────

interface BrandAreaProps {
  readonly collapsed: boolean
}

function BrandArea({ collapsed }: BrandAreaProps) {
  return (
    <div data-sidebar-brand style={BRAND_STYLE}>
      <span aria-hidden="true" style={LOGO_STYLE} data-sidebar-brand-logo>
        流
      </span>
      {!collapsed && (
        <span data-sidebar-brand-title style={BRAND_TITLE_STYLE}>
          流光后台
          <span style={BRAND_VERSION_STYLE} data-sidebar-brand-version>v2</span>
        </span>
      )}
    </div>
  )
}

interface NavItemProps {
  readonly item: AdminNavItem
  readonly active: boolean
  readonly collapsed: boolean
  readonly runtimeCount: number | undefined
  readonly onNavigate: (href: string) => void
}

function NavItem({ item, active, collapsed, runtimeCount, onNavigate }: NavItemProps) {
  const shortcutLabel = useFormatShortcut(item.shortcut ?? '')
  const effectiveCount = runtimeCount ?? item.count
  const badgeSlot = badgeToSlot(item.badge)
  const tooltip = collapsed ? buildTooltip(item.label, item.shortcut, shortcutLabel) : undefined

  const linkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 'var(--space-3)',
    padding: 'var(--space-2) var(--space-4)',
    color: active ? 'var(--admin-accent-on-soft)' : 'var(--fg-muted)',
    background: active ? 'var(--admin-accent-soft)' : 'transparent',
    border: 0,
    width: '100%',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
    justifyContent: collapsed ? 'center' : 'flex-start',
  }

  const iconStyle: CSSProperties = {
    display: 'inline-flex',
    width: '20px',
    height: '20px',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    color: 'inherit',
    position: 'relative',
  }

  return (
    <button
      type="button"
      data-sidebar-item={item.href}
      data-sidebar-item-active={active ? 'true' : undefined}
      title={tooltip}
      onClick={() => onNavigate(item.href)}
      style={linkStyle}
    >
      <span aria-hidden="true" style={iconStyle} data-sidebar-item-icon>
        {item.icon ?? null}
        {collapsed && effectiveCount !== undefined && effectiveCount > 0 && (
          <span
            aria-hidden="true"
            data-sidebar-item-pip
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: badgeSlot ? `var(--state-${badgeSlot}-border)` : 'var(--accent-default)',
            }}
          />
        )}
      </span>
      {!collapsed && (
        <>
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </span>
          {effectiveCount !== undefined && effectiveCount > 0 && (
            <span
              data-sidebar-item-badge
              style={{
                padding: '1px var(--space-2)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--admin-count-font-size)',
                background: badgeBg(badgeSlot),
                color: badgeFg(badgeSlot),
                lineHeight: '1.4em',
                flexShrink: 0,
              }}
            >
              {formatCount(effectiveCount)}
            </span>
          )}
        </>
      )}
    </button>
  )
}

interface FooterProps {
  readonly user: AdminShellUser
  readonly collapsed: boolean
  readonly userActions: AdminUserActions
}

function Footer({ user, collapsed, userActions }: FooterProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const avatar = user.avatarText ?? deriveAvatarText(user.displayName)

  const onClick = useCallback(() => setMenuOpen((v) => !v), [])

  const footerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    // border: 0 必须在 borderTop 前声明（CSS shorthand 在 longhand 之前）
    border: 0,
    borderTop: '1px solid var(--border-subtle)',
    background: 'transparent',
    width: '100%',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
    color: 'var(--fg-default)',
    flexShrink: 0,
    justifyContent: collapsed ? 'center' : 'flex-start',
  }

  // P1 必修（Opus 评审）：position: relative wrapper 建立稳定 positioned ancestor
  // 当 UserMenu 走 inline fallback 路径（SSR / anchorRef 未计算）时，浮层以本 wrapper 为定位锚点
  return (
    <div data-sidebar-foot-wrapper style={{ position: 'relative' }}>
      <button
        ref={anchorRef}
        type="button"
        data-sidebar-foot
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onClick}
        style={footerStyle}
      >
        <span aria-hidden="true" style={{ ...AVATAR_STYLE, flexShrink: 0 }} data-sidebar-foot-avatar>
          {avatar}
        </span>
        {!collapsed && (
          <>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span data-sidebar-foot-name style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.displayName}
              </span>
              <span data-sidebar-foot-role style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>
                {user.role === 'admin' ? '管理员' : '审核员'}
              </span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', flexShrink: 0 }}>›</span>
          </>
        )}
      </button>
      <UserMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        user={user}
        actions={userActions}
        anchorRef={anchorRef}
      />
    </div>
  )
}

const AVATAR_STYLE: CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  background: 'var(--admin-avatar-bg)',
  border: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-on-accent)',
}

// ── 工具函数 ────────────────────────────────────────────

/** count 显示规则：>999 缩 "1.2k"（保留 1 位小数）；其余直接数字 */
export function formatCount(count: number): string {
  if (count > 999) {
    const k = count / 1000
    return `${k.toFixed(1)}k`
  }
  return String(count)
}

function badgeToSlot(badge: AdminNavItem['badge']): 'info' | 'warning' | 'error' | undefined {
  if (badge === 'info') return 'info'
  if (badge === 'warn') return 'warning'
  if (badge === 'danger') return 'error'
  return undefined
}

function badgeBg(slot: 'info' | 'warning' | 'error' | undefined): string {
  if (slot === 'warning') return 'var(--admin-warn-soft)'
  if (slot === 'error') return 'var(--admin-danger-soft)'
  if (slot === 'info') return 'var(--state-info-bg)'
  return 'var(--bg-surface-raised)'
}

function badgeFg(slot: 'info' | 'warning' | 'error' | undefined): string {
  if (slot === 'warning') return 'var(--state-warning-fg)'
  if (slot === 'error') return 'var(--state-error-fg)'
  if (slot === 'info') return 'var(--state-info-fg)'
  return 'var(--fg-muted)'
}

/** 折叠态 tooltip：label + 平台 shortcut 文案（hydration-safe，由 useFormatShortcut 提供） */
function buildTooltip(label: string, shortcut: string | undefined, formattedShortcut: string): string {
  if (!shortcut || !formattedShortcut) return label
  return `${label} (${formattedShortcut})`
}
