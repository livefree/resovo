/**
 * user-menu.tsx — 用户菜单下拉（ADR-103a §4.1.4）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.4 UserMenu + AdminShellUser + AdminUserActions
 *     · anchorRef 注释明示"用于 **定位** + 点击外部判定"
 *   - ADR-103a §4.3 z-index 4 级（Shell 抽屉 var(--z-shell-drawer)）
 *   - ADR-103a §4.4 4 项硬约束
 *   - 设计稿 v2.1 shell.jsx Sidebar sb__menu 从 sb__foot 锚点上方弹出实践
 *
 * 设计要点：
 *   - 受控开闭：open + onOpenChange（外部点击 / ESC 触发 onOpenChange(false)）
 *   - **popover/visual 契约**（fix(CHG-SN-2-07) 补齐）：
 *     · anchorRef 提供 → createPortal 到 document.body + position: fixed +
 *       基于 anchorRef.current.getBoundingClientRect() 计算 top/left +
 *       transform: translateY(calc(-100% - 8px)) 在 anchor 上方 8px 间隙弹出 +
 *       z-index: var(--z-shell-drawer)（Shell 抽屉级别）
 *     · anchorRef 缺省 → inline 渲染（demo 页 + 单测 fallback）
 *     · resize / scroll 重新计算位置（capture phase 监听祖先滚动）
 *     · useLayoutEffect 客户端定位（避免一帧抖动），SSR 自动 noop
 *   - 6 项菜单按 actions 提供性渲染：
 *     · 可选 actions（onProfile / onPreferences / onToggleTheme / onHelp / onSwitchAccount）
 *       undefined 时对应菜单项隐藏（server-next 鉴权层若不支持多账号则 onSwitchAccount=undefined）
 *     · 必填 actions（onLogout）：登出永远渲染（is-danger 视觉）
 *   - avatarText 默认推断：displayName 首两字（多词→首字母 / CJK→前两字 / 单字符→自身）
 *   - focus trap：mount 时 focus 首项菜单按钮；Tab/Shift+Tab 在菜单项内循环；焦点门禁（菜单外焦点不被劫持）
 *   - outside-click：document mousedown listener；anchorRef 内点击不触发（避免触发器互斥）
 *   - ESC 关闭：document keydown listener
 *   - 任意菜单项点击后自动关闭菜单（try/finally 保护 callback throw）
 *
 * 不做：
 *   - 不实现登出业务（委托 actions.onLogout）
 *   - 不读取 user 数据（props 注入）
 *   - 不在 Sidebar 之外被滥用（命名上明示与 Shell 绑定；通用菜单请用未来 <Menu> 原语）
 *
 * 跨域消费：本文件被 packages/admin-ui Sidebar 内部消费 + AdminShell 装配编排；
 * server-next 应用层不应直接 import（应通过 AdminShell.props.onUserMenuAction 单一回调）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { AdminShellUser, AdminUserActions, UserMenuAction } from './types'

export interface UserMenuProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly user: AdminShellUser
  readonly actions: AdminUserActions
  readonly anchorRef?: RefObject<HTMLElement | null>
}

interface MenuItem {
  readonly action: UserMenuAction
  readonly label: string
  readonly callback: (() => void) | undefined
  readonly danger?: boolean
}

const CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: '220px',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  padding: 'var(--space-2)',
  gap: 'var(--space-1)',
}

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2)',
  borderBottom: '1px solid var(--border-subtle)',
  marginBottom: 'var(--space-1)',
}

const AVATAR_STYLE: CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  flexShrink: 0,
}

const META_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}

const NAME_STYLE: CSSProperties = {
  fontWeight: 600,
  color: 'var(--fg-default)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const EMAIL_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const ITEM_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: 'var(--space-2) var(--space-3)',
  font: 'inherit',
  color: 'var(--fg-default)',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 'var(--radius-sm)',
}

const DANGER_ITEM_STYLE: CSSProperties = {
  ...ITEM_STYLE,
  color: 'var(--state-error-fg)',
}

export function UserMenu({ open, onOpenChange, user, actions, anchorRef }: UserMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  const visibleItems = useMemo<readonly MenuItem[]>(
    () => buildMenuItems(actions),
    [actions],
  )

  // outside-click + ESC 监听器（仅 open 时挂载）
  useEffect(() => {
    if (!open) return undefined
    function onMouseDown(event: MouseEvent): void {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      if (anchorRef?.current?.contains(target)) return
      onOpenChange(false)
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange, anchorRef])

  // mount 时 focus 首项菜单按钮（focus trap 入口）
  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[data-menu-item]')
    first?.focus()
  }, [open])

  const handleItemClick = useCallback(
    (item: MenuItem) => {
      // try/finally 防 callback throw 时菜单卡死（onOpenChange 必须执行）
      try {
        item.callback?.()
      } finally {
        onOpenChange(false)
      }
    },
    [onOpenChange],
  )

  // focus trap：Tab/Shift+Tab 在菜单项内循环
  // 焦点门禁：仅当当前焦点在菜单内时启用 trap，避免菜单外 Tab 时被劫持
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const menu = menuRef.current
    if (!menu) return
    const activeEl = document.activeElement
    if (!(activeEl instanceof HTMLElement) || !menu.contains(activeEl)) return
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-menu-item]'))
    if (items.length === 0) return
    const currentIndex = items.indexOf(activeEl as HTMLButtonElement)
    if (currentIndex < 0) return
    if (event.shiftKey) {
      // 首项 Shift+Tab → 最后项
      if (currentIndex === 0) {
        event.preventDefault()
        items[items.length - 1]?.focus()
      }
    } else {
      // 最后项 Tab → 首项
      if (currentIndex === items.length - 1) {
        event.preventDefault()
        items[0]?.focus()
      }
    }
  }, [])

  // popover/visual 契约（ADR §4.1.4 anchorRef 注释 "用于定位"）：
  // anchorRef 提供时启用 portal + 相对定位；缺省时 inline 渲染（demo/测试 fallback）
  const anchorPos = useAnchorPosition(anchorRef, open)

  if (!open) return null

  const menuContent: ReactNode = (
    <div
      ref={menuRef}
      role="menu"
      aria-label="用户菜单"
      data-user-menu
      style={CONTAINER_STYLE}
      onKeyDown={handleKeyDown}
    >
      <div data-user-menu-header style={HEADER_STYLE}>
        <span aria-hidden="true" style={AVATAR_STYLE} data-user-menu-avatar>
          {user.avatarText ?? deriveAvatarText(user.displayName)}
        </span>
        <span style={META_STYLE}>
          <span style={NAME_STYLE} data-user-menu-name>{user.displayName}</span>
          <span style={EMAIL_STYLE} data-user-menu-email>
            {user.email} · {user.role === 'admin' ? '管理员' : '审核员'}
          </span>
        </span>
      </div>
      {visibleItems.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          data-menu-item={item.action}
          data-menu-item-danger={item.danger ? 'true' : undefined}
          style={item.danger ? DANGER_ITEM_STYLE : ITEM_STYLE}
          onClick={() => handleItemClick(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )

  // anchorRef 提供 → portal + fixed 定位（popover 形态）
  // pos 默认 {0,0}（useLayoutEffect 后续更新，避免初次渲染 anchorPos 还未计算完时回退 inline）
  if (anchorRef?.current) {
    const pos = anchorPos ?? { top: 0, left: 0 }
    const wrapperStyle: CSSProperties = {
      position: 'fixed',
      top: `${pos.top}px`,
      left: `${pos.left}px`,
      // 在 anchor 上方 8px 间隙弹出（设计稿 sb__menu 从 sb__foot 上方弹出）
      transform: 'translateY(calc(-100% - 8px))',
      zIndex: 'var(--z-shell-drawer)' as unknown as number,
    }
    return createPortal(
      <div data-user-menu-portal style={wrapperStyle}>
        {menuContent}
      </div>,
      document.body,
    )
  }

  // anchorRef 缺省（demo/单测）→ inline 渲染
  return menuContent
}

/** Hydration-safe 锚点定位 hook（ADR §4.1.4 anchorRef 用于定位）
 *  - SSR / 首渲染：返 null（anchorRef.current 在 SSR 永远 null）
 *  - 客户端 mount 后：useLayoutEffect 计算 anchor rect，setState 触发 portal 渲染
 *  - resize / scroll（capture）重新计算位置 */
function useAnchorPosition(
  anchorRef: RefObject<HTMLElement | null> | undefined,
  open: boolean,
): { top: number; left: number } | null {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setPos(null)
      return undefined
    }
    function updatePos(): void {
      const el = anchorRef?.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPos({ top: rect.top, left: rect.left })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    // capture phase 监听祖先滚动（如 Sidebar overflow 滚动时同步 popover 位置）
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [anchorRef, open])

  return pos
}

/** 从 displayName 推断 avatar 文本：
 *  - 含空格的多词（"Yan Liu"）→ 首字母大写（"YL"）
 *  - 无空格 ≥ 2 字符（"张三" / "Alice"）→ 前两字符
 *  - 单字符（"A" / "张"）→ 自身 */
export function deriveAvatarText(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return '?'
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/).filter(Boolean)
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('')
  }
  // CJK 字符 / 单字符 / 短词
  return trimmed.length >= 2 ? trimmed.slice(0, 2) : trimmed
}

function buildMenuItems(actions: AdminUserActions): readonly MenuItem[] {
  const items: MenuItem[] = []
  if (actions.onProfile) items.push({ action: 'profile', label: '个人资料', callback: actions.onProfile })
  if (actions.onPreferences) items.push({ action: 'preferences', label: '偏好设置', callback: actions.onPreferences })
  if (actions.onToggleTheme) items.push({ action: 'theme', label: '主题切换', callback: actions.onToggleTheme })
  if (actions.onHelp) items.push({ action: 'help', label: '帮助与快捷键', callback: actions.onHelp })
  if (actions.onSwitchAccount) items.push({ action: 'switchAccount', label: '切换账号', callback: actions.onSwitchAccount })
  // 登出永远渲染（actions.onLogout 必填）
  items.push({ action: 'logout', label: '登出', callback: actions.onLogout, danger: true })
  return items
}
