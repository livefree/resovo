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
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
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
  display: 'grid',
  gridTemplateColumns: 'var(--sidebar-w-collapsed) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 0,
  padding: 0,
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
  justifySelf: 'center',
}

const BRAND_TITLE_STYLE: CSSProperties = {
  fontWeight: 600,
  color: 'var(--fg-default)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  flex: 1,
  minWidth: 0,
}

/* 折叠态结构重置：放 inline，确保 Sidebar 独立使用（不通过 AdminShell）也正确收 0 占位。
 * 仅处理 layout（width/padding/border/margin/overflow）和 a11y（pointer-events）；
 * 视觉 fade（opacity / max-width / padding / gap transition）由 admin-shell-styles
 * 在合成场景注入，standalone 时 snap。
 *
 * 关键约束（CHG-DESIGN-04 fix#7 / 解决 collapse flex snap）：
 *   - max-width 用数值 0 而非 none，配合 expanded 态显式 maxWidth: '100%'，
 *     让 transition 可从 100% 平滑插值到 0
 *   - **不重置 flex** —— flex shorthand 切换 (`flex: 1` → `flex: 0 0 auto`) 会让
 *     flex-grow 瞬时由 1 跳 0，label/title 立即停止填 slack，justify-content:center
 *     立即生效，icon 在 button 还未收缩时跳到中心（flex snap）。
 *     正确做法：折叠态保留各元素 expanded 时的 flex 值（label 仍 flex:1 / badge 仍
 *     flex-shrink:0），让 max-width 的数值动画驱动 layout 平滑收缩。 */
const COLLAPSED_HIDDEN_STYLE: CSSProperties = {
  opacity: 0,
  pointerEvents: 'none',
  maxWidth: 0,
  minWidth: 0,
  padding: 0,
  margin: 0,
  border: 0,
  overflow: 'hidden',
}

/* section-title 仅收 opacity，保留 padding/height 做等高占位（图标 Y 坐标稳定） */
const COLLAPSED_OPACITY_ONLY_STYLE: CSSProperties = {
  opacity: 0,
  pointerEvents: 'none',
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
  padding: 0,
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
  fontSize: 'var(--font-size-xs)',
  flexShrink: 0,
  display: 'grid',
  gridTemplateColumns: 'var(--sidebar-w-collapsed) minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 0,
  minHeight: '40px',
  width: '100%',
}

const COLLAPSE_ICON_STYLE: CSSProperties = {
  justifySelf: 'center',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
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

  // CHG-DESIGN-05 自定义 NavTip：折叠态 hover/focus 任意 NavItem → 浮出单实例 tooltip
  // （portal 到 body + fixed 定位 + 跟随 anchor button 中线）
  // 单一 state 提到 Sidebar 顶层避免 N 个 NavItem 各持一份 tip 实例（性能 + 视觉互斥）
  const [hoveredNav, setHoveredNav] = useState<{ item: AdminNavItem; anchor: HTMLElement } | null>(null)
  const handleNavHover = useCallback((item: AdminNavItem, anchor: HTMLElement) => {
    if (!collapsed) return
    setHoveredNav({ item, anchor })
  }, [collapsed])
  const handleNavUnhover = useCallback(() => {
    setHoveredNav(null)
  }, [])
  // collapsed → false 时立即清理 NavTip（防止展开瞬间残留浮层）
  useEffect(() => {
    if (!collapsed) setHoveredNav(null)
  }, [collapsed])

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
            {/* 永远渲染分区标题；折叠态仅收 opacity（保留 height/padding 做等高占位） */}
            <div
              data-sidebar-section-title
              style={collapsed
                ? { ...SECTION_TITLE_STYLE, ...COLLAPSED_OPACITY_ONLY_STYLE }
                : SECTION_TITLE_STYLE}
            >
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
                    onHover={handleNavHover}
                    onUnhover={handleNavUnhover}
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
        data-interactive="nav"
        aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
        onClick={onToggleCollapsed}
        style={COLLAPSE_BTN_STYLE}
      >
        <span aria-hidden="true" style={COLLAPSE_ICON_STYLE} data-sidebar-collapse-icon>
          {collapsed ? '›' : '‹'}
        </span>
        <span
          data-sidebar-collapse-label
          style={collapsed
            ? { ...COLLAPSED_HIDDEN_STYLE, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }
            : { minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 'var(--space-2)' }}
        >
          收起边栏
        </span>
        {cmdBLabel && (
          <kbd
            aria-hidden="true"
            data-sidebar-collapse-kbd
            style={{
              justifySelf: 'end',
              marginRight: collapsed ? 0 : 'var(--space-4)',
              padding: '1px var(--space-1)',
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'monospace',
              color: 'var(--fg-muted)',
              ...(collapsed ? COLLAPSED_HIDDEN_STYLE : {}),
            }}
          >
            {cmdBLabel}
          </kbd>
        )}
      </button>
      {hoveredNav && <NavTip item={hoveredNav.item} anchor={hoveredNav.anchor} />}
    </aside>
  )
}

// ── 内部子组件 ────────────────────────────────────────────

interface BrandAreaProps {
  readonly collapsed: boolean
}

function BrandArea({ collapsed }: BrandAreaProps) {
  // 图标轨固定为 var(--sidebar-w-collapsed)：展开/收起只影响右侧文字区，
  // logo 的 X 坐标不参与 flex 剩余空间重新分配，避免切换抖动。
  const titleStyle: CSSProperties = collapsed
    ? { ...BRAND_TITLE_STYLE, ...COLLAPSED_HIDDEN_STYLE }
    : { ...BRAND_TITLE_STYLE, maxWidth: '100%' }
  return (
    <div data-sidebar-brand style={BRAND_STYLE}>
      <span aria-hidden="true" style={LOGO_STYLE} data-sidebar-brand-logo>
        流
      </span>
      <span data-sidebar-brand-title style={titleStyle}>
        流光后台
        <span style={BRAND_VERSION_STYLE} data-sidebar-brand-version>v2</span>
      </span>
    </div>
  )
}

interface NavItemProps {
  readonly item: AdminNavItem
  readonly active: boolean
  readonly collapsed: boolean
  readonly runtimeCount: number | undefined
  readonly onNavigate: (href: string) => void
  /** 折叠态 hover/focus → 通知 Sidebar 顶层渲染 NavTip（CHG-DESIGN-05） */
  readonly onHover: (item: AdminNavItem, anchor: HTMLElement) => void
  readonly onUnhover: () => void
}

function NavItem({ item, active, collapsed, runtimeCount, onNavigate, onHover, onUnhover }: NavItemProps) {
  const effectiveCount = runtimeCount ?? item.count
  const badgeSlot = badgeToSlot(item.badge)

  const linkStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'var(--sidebar-w-collapsed) minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 0,
    padding: 'var(--space-2) 0',
    color: active ? 'var(--admin-accent-on-soft)' : 'var(--fg-muted)',
    background: active ? 'var(--admin-accent-soft)' : 'transparent',
    border: 0,
    width: '100%',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
    minHeight: '36px',
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
    justifySelf: 'center',
  }

  // CHG-DESIGN-05：折叠态 hover/focus → 通知 Sidebar 顶层显示 NavTip
  // 展开态不触发（label 已可见，无需 tooltip 浮层）
  const handleEnter = (e: ReactMouseEvent<HTMLButtonElement> | ReactFocusEvent<HTMLButtonElement>) => {
    if (collapsed) onHover(item, e.currentTarget)
  }
  const handleLeave = () => {
    if (collapsed) onUnhover()
  }

  return (
    <button
      type="button"
      data-sidebar-item={item.href}
      data-sidebar-item-active={active ? 'true' : undefined}
      data-interactive="nav"
      data-active={active ? 'true' : undefined}
      onClick={() => onNavigate(item.href)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
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
      {/* 图标在固定 rail 内居中，文字/徽章只在右侧 grid columns 内裁切。 */}
      <span
        data-sidebar-item-label
        style={collapsed
          ? { ...COLLAPSED_HIDDEN_STYLE, flex: 1, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }
          : { flex: 1, minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 'var(--space-2)' }}
      >
        {item.label}
      </span>
      {effectiveCount !== undefined && effectiveCount > 0 && (
        <span
          data-sidebar-item-badge
          style={collapsed
            ? {
                ...COLLAPSED_HIDDEN_STYLE,
                flexShrink: 0,
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--admin-count-font-size)',
                background: badgeBg(badgeSlot),
                color: badgeFg(badgeSlot),
                lineHeight: '1.4em',
              }
            : {
                padding: '1px var(--space-2)',
                flexShrink: 0,
                maxWidth: '100%',
                marginRight: 'var(--space-4)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--admin-count-font-size)',
                background: badgeBg(badgeSlot),
                color: badgeFg(badgeSlot),
                lineHeight: '1.4em',
              }}
        >
          {formatCount(effectiveCount)}
        </span>
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
    display: 'grid',
    gridTemplateColumns: 'var(--sidebar-w-collapsed) minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 0,
    padding: 'var(--space-3) 0',
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
  }

  // P1 必修（Opus 评审）：position: relative wrapper 建立稳定 positioned ancestor
  // 当 UserMenu 走 inline fallback 路径（SSR / anchorRef 未计算）时，浮层以本 wrapper 为定位锚点
  return (
    <div data-sidebar-foot-wrapper style={{ position: 'relative' }}>
      <button
        ref={anchorRef}
        type="button"
        data-sidebar-foot
        data-interactive="nav"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onClick}
        style={footerStyle}
      >
        <span aria-hidden="true" style={{ ...AVATAR_STYLE, flexShrink: 0, justifySelf: 'center' }} data-sidebar-foot-avatar>
          {avatar}
        </span>
        {/* CHG-DESIGN-04 fix#5：meta + chevron 永远渲染；折叠态 inline 条件收 0
          * （Sidebar 自包含；admin-shell-styles 仅作合成场景的 transition 打磨） */}
        <span
          data-sidebar-foot-meta
          style={collapsed
            ? { ...COLLAPSED_HIDDEN_STYLE, flex: 1, display: 'flex', flexDirection: 'column' }
            : { flex: 1, minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingRight: 'var(--space-2)' }}
        >
          <span data-sidebar-foot-name style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.displayName}
          </span>
          <span data-sidebar-foot-role style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.role === 'admin' ? '管理员 · admin' : '审核员 · moderator'}
          </span>
        </span>
        <span
          aria-hidden="true"
          data-sidebar-foot-chevron
          style={collapsed
            ? { ...COLLAPSED_HIDDEN_STYLE, flexShrink: 0, color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }
            : { color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)', flexShrink: 0, maxWidth: '100%', marginRight: 'var(--space-4)' }}
        >›</span>
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

// ── NavTip 自定义浮层（CHG-DESIGN-05） ────────────────────
// 折叠态 NavItem hover/focus 浮出 portal tooltip：label + 平台 shortcut kbd
// 单实例由 Sidebar 顶层 state 持有；anchor 为触发 button DOM 节点；fixed 定位
// 跨越 sidebar 60px 折叠宽度。SSR 安全：组件只在 hoveredNav 非 null 时挂载，
// SSR 路径下永远 null。

interface NavTipProps {
  readonly item: AdminNavItem
  readonly anchor: HTMLElement
}

const NAVTIP_GAP = 8

function NavTip({ item, anchor }: NavTipProps) {
  const shortcutLabel = useFormatShortcut(item.shortcut ?? '')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect()
      setPos({
        top: rect.top + rect.height / 2,
        left: rect.right + NAVTIP_GAP,
      })
    }
    update()
    // 滚动 / resize 期间跟随 anchor（sidebar nav 自身可滚）
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchor])

  if (typeof document === 'undefined' || pos === null) return null

  const style: CSSProperties = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    transform: 'translateY(-50%)',
    // NavTip 浮于 main 内容 + 与 shell drawer 同层（设计稿 §4.1 浮层无独立 z-token）
    zIndex: 1100,
    background: 'var(--bg-surface-elevated)',
    color: 'var(--fg-default)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-sm)',
    padding: '6px 10px',
    fontSize: 'var(--font-size-xs)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  }

  return createPortal(
    <div role="tooltip" data-sidebar-nav-tip style={style}>
      <span data-sidebar-nav-tip-label>{item.label}</span>
      {item.shortcut && shortcutLabel && (
        <kbd
          data-sidebar-nav-tip-kbd
          style={{
            padding: '1px 6px',
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'monospace',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--fg-muted)',
          }}
        >
          {shortcutLabel}
        </kbd>
      )}
    </div>,
    document.body,
  )
}
