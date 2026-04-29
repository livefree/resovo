/**
 * topbar.tsx — admin Shell 顶栏（ADR-103a §4.1.3 + fix(CHG-SN-2-01) 修订）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.3 Topbar + TopbarIcons + TopbarProps
 *   - fix(CHG-SN-2-01) §4.1.3 修订（TopbarIcons 5 类必填 + 不调用 inferBreadcrumbs + AdminShell 透传）
 *   - ADR-103a §4.4 4 项硬约束
 *   - admin-layout token shell.ts（topbar-h）
 *   - 设计稿 v2.1 shell.jsx Topbar tb__crumbs / tb__search / tb__health 实现
 *
 * 组件形态：
 *   章法 1B 纯渲染单件（无 useEffect / 无 listener / 无 store）+ 多内部子组件（IconButton）
 *
 * 设计要点：
 *   - 3 区布局：左（Breadcrumbs）/ 中（搜索触发器）/ 右（HealthBadge + 4 图标按钮）+ height var(--topbar-h)
 *   - Breadcrumbs 直接渲染 props.crumbs（不调用 inferBreadcrumbs）— 由 AdminShell 调用方提前推断后注入
 *   - 全局搜索触发器：button + icons.search + 文案"搜索视频 / 播放源 / 任务…" + ⌘K 提示；点击 onOpenCommandPalette
 *   - 5 类 IconButton（顺序）：theme / tasks / notifications / settings；HealthBadge 独立位于主题切换前
 *   - 角标：runningTaskCount > 0 → 数字徽章（>99 → "99+"）+ notificationDotVisible=true → 8px 红点 pip
 *   - 颜色全 token / 零图标库依赖（icons 由消费方注入 ReactNode）
 *
 * 不做：
 *   - 不调用 inferBreadcrumbs（fix(CHG-SN-2-01) §4.1.3 修订；消费方传 crumbs prop）
 *   - 不实现 CmdK 弹层（onOpenCommandPalette 触发 AdminShell 编排）
 *   - 不持有任务/通知 Drawer 开闭状态（由消费方在 onOpenNotifications/onOpenTasks 内部处理）
 *   - 不直连 apiClient 拉取 health（由消费方注入 snapshot）
 *
 * 跨域消费：本文件被 packages/admin-ui AdminShell 装配编排（CHG-SN-2-12）；
 * server-next 应用层不应直接 import（应通过 AdminShell.props 间接消费）。
 */
import { useFormatShortcut } from './platform'
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs'
import { HealthBadge } from './health-badge'
import type { CSSProperties, ReactNode } from 'react'
import type { HealthSnapshot } from './types'

export interface TopbarIcons {
  readonly search: ReactNode
  /** 同一插槽渲染当前态（theme='dark' 时显示 sun，'light' 时显示 moon；切换语义由消费方决定 ReactNode 内容）*/
  readonly theme: ReactNode
  readonly notifications: ReactNode
  readonly tasks: ReactNode
  readonly settings: ReactNode
}

export interface TopbarProps {
  readonly crumbs: readonly BreadcrumbItem[]
  readonly theme: 'dark' | 'light'
  readonly icons: TopbarIcons
  readonly health?: HealthSnapshot
  readonly notificationDotVisible?: boolean
  readonly runningTaskCount?: number
  /** notifications prop 未提供时为 true → 按钮 disabled（§4.1.1 图标禁用合约）*/
  readonly notificationsDisabled?: boolean
  /** tasks prop 未提供时为 true → 按钮 disabled（§4.1.1 图标禁用合约）*/
  readonly tasksDisabled?: boolean
  readonly onOpenCommandPalette: () => void
  readonly onThemeToggle: () => void
  readonly onOpenNotifications: () => void
  readonly onOpenTasks: () => void
  readonly onOpenSettings: () => void
}

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  height: 'var(--topbar-h)',
  padding: '0 var(--space-4)',
  background: 'var(--bg-surface)',
  borderBottom: '1px solid var(--border-default)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm)',
  flexShrink: 0,
}

const SEARCH_TRIGGER_STYLE: CSSProperties = {
  flex: 1,
  maxWidth: '480px',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-1) var(--space-3)',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
}

const SEARCH_KBD_STYLE: CSSProperties = {
  marginLeft: 'auto',
  padding: '0 var(--space-2)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  fontFamily: 'monospace',
  flexShrink: 0,
}

const RIGHT_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  flexShrink: 0,
  // marginLeft: auto 强制 right group 贴 header 右端（fix(CHG-SN-2-09) Codex stop-time review）
  // 否则 search button 受 maxWidth: 480px 限制后剩余空间形成空白，导致 right group 漂浮在 header 中间
  marginLeft: 'auto',
}

const ICON_BTN_STYLE: CSSProperties = {
  position: 'relative',
  width: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  color: 'var(--fg-muted)',
  font: 'inherit',
}

export function Topbar({
  crumbs,
  theme,
  icons,
  health,
  notificationDotVisible,
  runningTaskCount,
  notificationsDisabled,
  tasksDisabled,
  onOpenCommandPalette,
  onThemeToggle,
  onOpenNotifications,
  onOpenTasks,
  onOpenSettings,
}: TopbarProps) {
  const cmdkLabel = useFormatShortcut('mod+k')
  return (
    <header
      role="banner"
      data-topbar
      data-topbar-theme={theme}
      style={HEADER_STYLE}
    >
      <div data-topbar-crumbs style={{ flexShrink: 0 }}>
        <Breadcrumbs items={crumbs} />
      </div>
      <button
        type="button"
        data-topbar-search
        aria-label="打开全局搜索"
        onClick={onOpenCommandPalette}
        style={SEARCH_TRIGGER_STYLE}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }} data-topbar-search-icon>
          {icons.search}
        </span>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          搜索视频 / 播放源 / 任务…
        </span>
        <span aria-hidden="true" style={SEARCH_KBD_STYLE} data-topbar-search-kbd>
          {cmdkLabel}
        </span>
      </button>
      <div style={RIGHT_GROUP_STYLE} data-topbar-right>
        {health !== undefined && <HealthBadge snapshot={health} />}
        <IconButton
          ariaLabel={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          dataAttr="theme"
          onClick={onThemeToggle}
        >
          {icons.theme}
        </IconButton>
        <IconButton
          ariaLabel="后台任务"
          dataAttr="tasks"
          onClick={onOpenTasks}
          badgeText={formatTaskCount(runningTaskCount)}
          disabled={tasksDisabled}
        >
          {icons.tasks}
        </IconButton>
        <IconButton
          ariaLabel="通知"
          dataAttr="notifications"
          onClick={onOpenNotifications}
          dotVisible={notificationDotVisible === true}
          disabled={notificationsDisabled}
        >
          {icons.notifications}
        </IconButton>
        <IconButton
          ariaLabel="设置"
          dataAttr="settings"
          onClick={onOpenSettings}
        >
          {icons.settings}
        </IconButton>
      </div>
    </header>
  )
}

// ── 内部子组件 ────────────────────────────────────────────

interface IconButtonProps {
  readonly ariaLabel: string
  readonly dataAttr: 'theme' | 'tasks' | 'notifications' | 'settings'
  readonly onClick: () => void
  readonly children: ReactNode
  readonly badgeText?: string
  readonly dotVisible?: boolean
  readonly disabled?: boolean
}

function IconButton({ ariaLabel, dataAttr, onClick, children, badgeText, dotVisible, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      data-topbar-icon-btn={dataAttr}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { ...ICON_BTN_STYLE, opacity: 0.4, cursor: 'not-allowed' } : ICON_BTN_STYLE}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        {children}
      </span>
      {badgeText && (
        <span
          aria-hidden="true"
          data-topbar-icon-badge
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            minWidth: '16px',
            height: '16px',
            padding: '0 var(--space-1)',
            borderRadius: '8px',
            background: 'var(--state-info-bg)',
            color: 'var(--state-info-fg)',
            fontSize: 'var(--font-size-xs)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {badgeText}
        </span>
      )}
      {dotVisible && (
        <span
          aria-hidden="true"
          data-topbar-icon-dot
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--state-error-border)',
          }}
        />
      )}
    </button>
  )
}

// ── 工具函数 ────────────────────────────────────────────

/** 任务计数显示规则：0 / undefined → 不显示；>99 → "99+"；其余直接数字 */
export function formatTaskCount(count: number | undefined): string | undefined {
  if (count === undefined || count <= 0) return undefined
  if (count > 99) return '99+'
  return String(count)
}
