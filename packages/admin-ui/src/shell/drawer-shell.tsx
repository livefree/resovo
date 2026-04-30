'use client'

/**
 * drawer-shell.tsx — Shell 抽屉私有 base 组件（NotificationDrawer + TaskDrawer 共享）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.5 NotificationDrawer + TaskDrawer 共同行为
 *   - ADR-103a §4.3 z-index var(--z-shell-drawer) 1100
 *   - fix(CHG-SN-2-07) UserMenu portal/visual 契约（复用 portal + focus trap 范式）
 *   - ADR-103a §4.4 4 项硬约束
 *
 * 组件形态：
 *   章法 1C/5C 受控浮层（open + onClose 受控；portal + focus trap + ESC + backdrop）
 *   不导出（packages/admin-ui 内部 base，仅被 NotificationDrawer / TaskDrawer 消费）
 *
 * 设计要点：
 *   - createPortal 到 document.body（避免 Sidebar/Topbar overflow:hidden 裁剪 + z-index 冲突）
 *   - backdrop：position fixed inset 0 + var(--bg-overlay) + 点击关闭
 *   - panel：position fixed top var(--topbar-h) right 0 bottom 0 width 360px + 从右滑入视觉（CSS 原生即可）
 *   - role="dialog" + aria-modal="true" + aria-labelledby 由消费方传 title id
 *   - focus trap：mount 时 focus 第一个可聚焦元素（通常 close 按钮）
 *     · Tab 在最后项时循环到首；Shift+Tab 在首项时循环到尾
 *     · 焦点门禁：仅当焦点在 panel 内时启用 trap（避免外部焦点被劫持）
 *   - ESC 关闭：document keydown listener；event.stopPropagation 防触发上层
 *   - listener 仅 open=true 挂载；unmount/rerender 自动 cleanup
 *   - try/finally 保护 onClose（防 callback throw 导致 listener 留守）
 *
 * 不变约束：
 *   - 模块顶层零 navigator/document/window 访问
 *   - 颜色全 token / 零图标库依赖（close 用 unicode ×）
 *   - SSR open=false 输出空字符串（不渲染 portal）
 *   - 与 UserMenu 不同：Drawer 无 anchorRef（全屏右侧条带，不锚定特定元素）
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface DrawerShellProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  /** panel header 右侧操作区（如 NotificationDrawer "全部已读" 按钮） */
  readonly headerActions?: ReactNode
  /** panel body 内容（消费方决定列表形态） */
  readonly children: ReactNode
  /** 数据 attr 标识（'notifications' / 'tasks'）便于单测 + e2e 选择 */
  readonly variant: 'notifications' | 'tasks'
}

const BACKDROP_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bg-overlay)',
  zIndex: 'var(--z-shell-drawer)' as unknown as number,
}

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  top: 'var(--topbar-h)',
  right: 0,
  bottom: 0,
  width: '360px',
  background: 'var(--bg-surface)',
  borderLeft: '1px solid var(--border-default)',
  display: 'flex',
  flexDirection: 'column',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm)',
  zIndex: 'var(--z-shell-drawer)' as unknown as number,
  boxShadow: 'var(--shadow-md)',
}

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
}

const TITLE_STYLE: CSSProperties = {
  fontWeight: 600,
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const CLOSE_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  padding: 'var(--space-1) var(--space-2)',
  font: 'inherit',
  fontSize: 'var(--font-size-base)',
  lineHeight: 1,
  flexShrink: 0,
}

const BODY_STYLE: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-2) 0',
}

export function DrawerShell({ open, onClose, title, headerActions, children, variant }: DrawerShellProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleId = `drawer-title-${variant}`

  // SSR 兼容：React 18 react-dom/server 不支持 createPortal；mounted 标志在客户端 mount 后切换
  // SSR 期 mounted=false → return null（输出空字符串，hydration-safe）；客户端 mount 后 portal 渲染
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // ESC 关闭 + listener 仅 open=true 挂载（章法 1C 受控浮层模式）
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation()
        try {
          onClose()
        } catch {
          // 静默捕获 callback throw，确保 listener cleanup 由 useEffect return 处理（与 UserMenu try/finally 一致）
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  // mount 时 focus close 按钮（focus trap 入口）
  useEffect(() => {
    if (!open) return
    const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>('[data-drawer-close]')
    closeBtn?.focus()
  }, [open])

  // focus trap：Tab/Shift+Tab 在 panel 内循环（焦点门禁：仅当焦点在 panel 内时启用）
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const activeEl = document.activeElement
    if (!(activeEl instanceof HTMLElement) || !panel.contains(activeEl)) return
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusables.length === 0) return
    const currentIndex = focusables.indexOf(activeEl)
    if (currentIndex < 0) return
    if (event.shiftKey) {
      if (currentIndex === 0) {
        event.preventDefault()
        focusables[focusables.length - 1]?.focus()
      }
    } else {
      if (currentIndex === focusables.length - 1) {
        event.preventDefault()
        focusables[0]?.focus()
      }
    }
  }, [])

  const handleBackdropClick = useCallback(() => {
    try {
      onClose()
    } catch {
      // 同 ESC 静默捕获
    }
  }, [onClose])

  if (!open || !mounted) return null

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-drawer-backdrop={variant}
        onClick={handleBackdropClick}
        style={BACKDROP_STYLE}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-drawer-panel={variant}
        style={PANEL_STYLE}
        onKeyDown={handleKeyDown}
      >
        <div data-drawer-header style={HEADER_STYLE}>
          <span id={titleId} data-drawer-title style={TITLE_STYLE}>
            {title}
          </span>
          {headerActions}
          <button
            type="button"
            data-drawer-close
            aria-label="关闭"
            onClick={onClose}
            style={CLOSE_BTN_STYLE}
          >
            ×
          </button>
        </div>
        <div data-drawer-body style={BODY_STYLE}>
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
