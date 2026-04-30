'use client'

/**
 * header-menu.tsx — DataTable 表头集成菜单 popover（CHG-DESIGN-02 Step 3/7）
 *
 * 真源：reference.md §4.4 + 设计稿 datatable.jsx DTHeaderMenu
 * arch-reviewer 决议：本步只 wire 升降序 / 隐藏列；
 *   - "固定到左" 推迟到 column.stickyLeft 运行时落地（避免 types-only 暴露）
 *   - "过滤" 仅在 column.columnMenu.filterContent 已提供时显示并渲染该 ReactNode
 *
 * 范式：完全对照 ColumnSettingsPanel — portal 渲染、ESC + 点击外部关闭、
 *      anchorRef.getBoundingClientRect 计算位置、focus 首项。
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnDescriptor, ColumnPreference, TableSortState } from './types'

export interface HeaderMenuProps {
  readonly open: boolean
  /** ColumnDescriptor 而非 TableColumn<T>（逆变隔离，与 ColumnSettingsPanel 同惯例） */
  readonly column: ColumnDescriptor | null
  readonly anchorRef: React.RefObject<HTMLElement | null>
  readonly currentSort: TableSortState
  readonly columnsValue: ReadonlyMap<string, ColumnPreference>
  readonly onSort: (field: string, direction: 'asc' | 'desc') => void
  readonly onClearSort: () => void
  readonly onHide: (field: string) => void
  readonly onClose: () => void
  /** 列上 columnMenu.filterContent 可选；若提供则渲染过滤区块 */
  readonly filterContent?: React.ReactNode
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
  minWidth: '180px',
  maxWidth: '260px',
  outline: 'none',
}

const ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
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

const ACTIVE_ITEM_STYLE: React.CSSProperties = {
  ...ITEM_STYLE,
  color: 'var(--admin-accent-on-soft)',
  background: 'var(--admin-accent-soft)',
}

const SEP_STYLE: React.CSSProperties = {
  height: '1px',
  background: 'var(--border-subtle)',
  margin: '4px 0',
}

const FILTER_WRAP_STYLE: React.CSSProperties = {
  padding: '6px 14px 8px',
}

const FILTER_LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

export function HeaderMenu({
  open,
  column,
  anchorRef,
  currentSort,
  columnsValue,
  onSort,
  onClearSort,
  onHide,
  onClose,
  filterContent,
}: HeaderMenuProps): React.ReactElement | null {
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
    const first = panelRef.current?.querySelector<HTMLElement>('button')
    first?.focus()
  }, [open, mounted])

  if (!open || !mounted || !column) return null

  const sortable = column.enableSorting === true
  const isSortedAsc = currentSort.field === column.id && currentSort.direction === 'asc'
  const isSortedDesc = currentSort.field === column.id && currentSort.direction === 'desc'
  const isPinned = column.pinned === true
  const stored = columnsValue.get(column.id)
  const isVisible = stored !== undefined ? stored.visible : column.defaultVisible !== false

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label="列操作"
      tabIndex={-1}
      style={{ ...PANEL_STYLE, top: pos.top, left: pos.left }}
      onKeyDown={handleKeyDown}
      data-header-menu
    >
      {sortable && (
        <>
          <button
            type="button"
            role="menuitem"
            style={isSortedAsc ? ACTIVE_ITEM_STYLE : ITEM_STYLE}
            onClick={() => { onSort(column.id, 'asc'); onClose() }}
          >
            <span aria-hidden="true">↑</span>
            <span>升序</span>
          </button>
          <button
            type="button"
            role="menuitem"
            style={isSortedDesc ? ACTIVE_ITEM_STYLE : ITEM_STYLE}
            onClick={() => { onSort(column.id, 'desc'); onClose() }}
          >
            <span aria-hidden="true">↓</span>
            <span>降序</span>
          </button>
          {(isSortedAsc || isSortedDesc) && (
            <button
              type="button"
              role="menuitem"
              style={ITEM_STYLE}
              onClick={() => { onClearSort(); onClose() }}
            >
              <span aria-hidden="true">×</span>
              <span>清除排序</span>
            </button>
          )}
        </>
      )}
      {filterContent && (
        <>
          {sortable && <div style={SEP_STYLE} aria-hidden="true" />}
          <div style={FILTER_WRAP_STYLE}>
            <div style={FILTER_LABEL_STYLE}>过滤</div>
            {filterContent}
          </div>
        </>
      )}
      {(sortable || filterContent) && !isPinned && isVisible && <div style={SEP_STYLE} aria-hidden="true" />}
      {!isPinned && isVisible && (
        <button
          type="button"
          role="menuitem"
          style={ITEM_STYLE}
          onClick={() => { onHide(column.id); onClose() }}
        >
          <span aria-hidden="true">⊘</span>
          <span>隐藏此列</span>
        </button>
      )}
    </div>,
    document.body,
  )
}
