'use client'

/**
 * admin-dropdown.tsx — AdminDropdown 通用行操作下拉菜单
 * 真源：ADR-103 §4.7（CHG-SN-2-17）
 *
 * z-index：var(--z-admin-dropdown) = 980（Modal 之下，允许 Dropdown 挂在 Modal 内）
 * 职责：portal 渲染；ESC + 点击外部关闭；上下方向键导航；Enter 触发；自动定位
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface AdminDropdownItem {
  readonly key: string
  readonly label: React.ReactNode
  readonly icon?: React.ReactNode
  readonly onClick: () => void
  readonly danger?: boolean
  readonly disabled?: boolean
  readonly shortcut?: string
  readonly separator?: boolean
}

export interface AdminDropdownProps {
  readonly open: boolean
  readonly trigger: React.ReactNode
  readonly items: readonly AdminDropdownItem[]
  readonly onOpenChange: (next: boolean) => void
  readonly align?: 'left' | 'right'
  readonly placement?: 'top' | 'bottom'
  readonly 'data-testid'?: string
}

interface Pos { top: number; left: number }
const DEFAULT_POS: Pos = { top: 0, left: 0 }
const MENU_MIN_WIDTH = 180

const WRAPPER_STYLE: React.CSSProperties = { display: 'inline-block' }

const MENU_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-dropdown)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  padding: '4px 0',
  minWidth: `${MENU_MIN_WIDTH}px`,
  maxWidth: '280px',
  outline: 'none',
}

const SEPARATOR_STYLE: React.CSSProperties = {
  borderTop: '1px solid var(--border-subtle)',
  margin: '4px 0',
}

function itemStyle(danger: boolean, disabled: boolean, active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 14px',
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    color: danger ? 'var(--state-error-fg)' : 'var(--fg-default)',
    background: active && !disabled ? 'var(--bg-surface-elevated)' : 'transparent',
    userSelect: 'none',
  }
}

function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => {
      const p = part.trim().toLowerCase()
      if (p === 'mod' || p === 'meta') return '⌘'
      if (p === 'ctrl') return '⌃'
      if (p === 'alt' || p === 'option') return '⌥'
      if (p === 'shift') return '⇧'
      return part.toUpperCase()
    })
    .join('')
}

export function AdminDropdown({
  open,
  trigger,
  items,
  onOpenChange,
  align = 'right',
  placement = 'bottom',
  'data-testid': testId,
}: AdminDropdownProps): React.ReactElement {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>(DEFAULT_POS)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const calcPos = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const top = placement === 'bottom' ? rect.bottom + 4 : rect.top - 4
    const left = align === 'right'
      ? Math.max(8, rect.right - MENU_MIN_WIDTH)
      : rect.left
    setPos({ top, left })
  }, [align, placement])

  useLayoutEffect(() => {
    if (!open) return
    calcPos()
  }, [open, calcPos])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', calcPos)
    window.addEventListener('scroll', calcPos, true)
    return () => {
      window.removeEventListener('resize', calcPos)
      window.removeEventListener('scroll', calcPos, true)
    }
  }, [open, calcPos])

  // ESC + 点击外部关闭
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onOpenChange(false)
    }
    const onMouseDown = (e: MouseEvent) => {
      const menu = menuRef.current
      const trig = triggerRef.current
      if (!menu) return
      if (menu.contains(e.target as Node)) return
      if (trig?.contains(e.target as Node)) return
      onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open, onOpenChange])

  // open 时重置 activeIndex，focus 菜单容器
  useEffect(() => {
    if (!open) { setActiveIndex(-1); return }
    menuRef.current?.focus()
  }, [open])

  const navigableIndices = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !item.disabled)
    .map(({ i }) => i)

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => {
        const pos = navigableIndices.indexOf(prev)
        const next = pos < navigableIndices.length - 1 ? pos + 1 : 0
        return navigableIndices[next] ?? prev
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => {
        const pos = navigableIndices.indexOf(prev)
        const next = pos > 0 ? pos - 1 : navigableIndices.length - 1
        return navigableIndices[next] ?? prev
      })
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (activeIndex >= 0) {
        const item = items[activeIndex]
        if (item && !item.disabled) {
          e.preventDefault()
          item.onClick()
          onOpenChange(false)
        }
      }
    }
  }, [activeIndex, items, navigableIndices, onOpenChange])

  const menu = open && mounted ? (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      style={{ ...MENU_STYLE, top: pos.top, left: pos.left }}
      onKeyDown={handleMenuKeyDown}
      data-testid={testId}
      data-admin-dropdown
    >
      {items.map((item, idx) => (
        <React.Fragment key={item.key}>
          {item.separator && <div role="separator" aria-hidden="true" style={SEPARATOR_STYLE} />}
          <div
            role="menuitem"
            aria-disabled={item.disabled}
            style={itemStyle(!!item.danger, !!item.disabled, activeIndex === idx)}
            onClick={() => {
              if (item.disabled) return
              item.onClick()
              onOpenChange(false)
            }}
            onMouseEnter={() => !item.disabled && setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(-1)}
            data-key={item.key}
            data-danger={item.danger ? '' : undefined}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: '11px', color: 'var(--fg-muted)', flexShrink: 0 }}>
                {formatShortcut(item.shortcut)}
              </span>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  ) : null

  return (
    <div ref={triggerRef} style={WRAPPER_STYLE} data-dropdown-trigger>
      {trigger}
      {mounted && menu && createPortal(menu, document.body)}
    </div>
  )
}
