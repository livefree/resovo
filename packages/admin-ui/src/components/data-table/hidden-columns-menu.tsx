'use client'

/**
 * hidden-columns-menu.tsx — DataTable 隐藏列 popover（CHG-DESIGN-02 Step 7A）
 *
 * 真源：reference.md §4.4.1 / §4.4.3 — toolbar 内 "已隐藏 N 列" chip + popover 列恢复
 *
 * 设计契约：
 *   - 列出所有 hidable 列（pinned 列恒可见，作为"已锁定"项展示但禁用切换）
 *   - 切换可见性走 setColumnVisibility（与 HeaderMenu onHide 共享 column-visibility.ts 工具）
 *   - portal / ESC / 点击外部关闭 / focus trap 范式与 HeaderMenu 同
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnDescriptor, ColumnPreference } from './types'
import { isColumnVisible, setColumnVisibility } from './column-visibility'

export interface HiddenColumnsMenuProps {
  readonly open: boolean
  readonly columns: readonly ColumnDescriptor[]
  readonly columnsValue: ReadonlyMap<string, ColumnPreference>
  readonly anchorRef: React.RefObject<HTMLElement | null>
  readonly onColumnsChange: (next: ReadonlyMap<string, ColumnPreference>) => void
  readonly onClose: () => void
}

interface Pos { top: number; left: number }
const DEFAULT_POS: Pos = { top: 0, left: 0 }

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-dropdown)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  padding: '4px 0',
  minWidth: '220px',
  maxWidth: '320px',
  maxHeight: '320px',
  overflowY: 'auto',
  outline: 'none',
}

const ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--fg-default)',
  background: 'transparent',
  border: 0,
  width: '100%',
  textAlign: 'left',
  font: 'inherit',
}

const LOCKED_TAG_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '11px',
  color: 'var(--fg-muted)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '1px 6px',
}

const HEADER_STYLE: React.CSSProperties = {
  padding: '6px 14px 4px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export function HiddenColumnsMenu({
  open,
  columns,
  columnsValue,
  anchorRef,
  onColumnsChange,
  onClose,
}: HiddenColumnsMenuProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>(DEFAULT_POS)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const recalc = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    const onMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current
      const anchor = anchorRef.current
      if (!panel) return
      if (panel.contains(e.target as Node)) return
      if (anchor?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open, onClose, anchorRef])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first) { e.preventDefault(); last?.focus() }
    } else {
      if (active === last) { e.preventDefault(); first?.focus() }
    }
  }, [])

  useEffect(() => {
    if (!open || !mounted) return
    const first = panelRef.current?.querySelector<HTMLElement>('button:not([disabled])')
    first?.focus()
  }, [open, mounted])

  if (!open || !mounted || typeof document === 'undefined') return null

  const toggle = (col: ColumnDescriptor) => {
    if (col.pinned) return
    const visible = isColumnVisible(col, columnsValue)
    onColumnsChange(setColumnVisibility(columnsValue, col.id, !visible))
  }

  const panel = (
    <div
      ref={panelRef}
      role="menu"
      aria-label="列可见性"
      style={{ ...PANEL_STYLE, top: pos.top, left: pos.left }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div style={HEADER_STYLE}>列可见性</div>
      {columns.map((col) => {
        const visible = isColumnVisible(col, columnsValue)
        const locked = col.pinned === true
        return (
          <button
            key={col.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={visible}
            disabled={locked}
            onClick={() => toggle(col)}
            style={{ ...ITEM_STYLE, opacity: locked ? 0.6 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}
            data-testid={`hidden-columns-item-${col.id}`}
          >
            <input
              type="checkbox"
              checked={visible}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
            />
            <span>{col.header}</span>
            {locked && <span style={LOCKED_TAG_STYLE}>已锁定</span>}
          </button>
        )
      })}
    </div>
  )

  return createPortal(panel, document.body)
}
