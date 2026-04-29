'use client'

/**
 * column-settings-panel.tsx — ColumnSettingsPanel 列可见性设置面板
 * 真源：ADR-103 §4.4 ColumnSettingsPanel（CHG-SN-2-14）
 *
 * 职责：portal 渲染（挂 body）的列可见性设置面板；ESC 关闭 + 点击外部关闭 + focus trap；
 * 不持久化（持久化由 useTableQuery 接管）。
 * columns 参数类型为 ColumnDescriptor（ADR-103 §4.10-10，逆变隔离）。
 *
 * 范式：ADR-103a §4.1 UserMenu / CommandPalette 受控浮层模式。
 */
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnDescriptor, ColumnPreference } from './types'

export interface ColumnSettingsPanelProps {
  readonly open: boolean
  /** ColumnDescriptor 而非 TableColumn<unknown>（逆变隔离，ADR-103 §4.10-10）*/
  readonly columns: readonly ColumnDescriptor[]
  readonly value: ReadonlyMap<string, ColumnPreference>
  readonly onChange: (next: ReadonlyMap<string, ColumnPreference>) => void
  readonly onClose: () => void
  readonly anchorRef: React.RefObject<HTMLElement | null>
}

interface Pos { top: number; left: number }
const DEFAULT_POS: Pos = { top: 0, left: 0 }

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  // ADR-103 §4.7：列设置面板属业务 dropdown 语义，使用 --z-admin-dropdown (980)
  zIndex: 'var(--z-admin-dropdown)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  padding: '8px 0',
  minWidth: '220px',
  maxWidth: '300px',
  maxHeight: '400px',
  overflowY: 'auto',
  outline: 'none',
}

const ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 16px',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--fg-default)',
  userSelect: 'none',
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 16px 8px',
  borderBottom: '1px solid var(--border-subtle)',
  marginBottom: '4px',
}

const CLOSE_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: '14px',
}

export function ColumnSettingsPanel({
  open,
  columns,
  value,
  onChange,
  onClose,
  anchorRef,
}: ColumnSettingsPanelProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>(DEFAULT_POS)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // SSR-safe mount（React 18 server 不支持 createPortal）
  useEffect(() => { setMounted(true) }, [])

  // 计算定位（锚点正下方）
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.right })
  }, [open, anchorRef])

  // resize / scroll 重新计算
  useEffect(() => {
    if (!open) return
    const recalc = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right })
    }
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [open, anchorRef])

  // ESC + 点击外部关闭
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

  // focus trap（Tab/Shift+Tab 循环）
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button, input[type="checkbox"], [tabindex]:not([tabindex="-1"])'),
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

  // focus 首项
  useEffect(() => {
    if (!open || !mounted) return
    const first = panelRef.current?.querySelector<HTMLElement>('input[type="checkbox"]')
    first?.focus()
  }, [open, mounted])

  const handleToggle = useCallback((colId: string, pinned: boolean | undefined) => {
    if (pinned) return // pinned 列不可隐藏
    const current = value.get(colId)
    const next = new Map(value)
    next.set(colId, { visible: !(current?.visible !== false), width: current?.width })
    onChange(next)
  }, [value, onChange])

  if (!open || !mounted) return null

  // 面板右对齐锚点（防止超出屏幕右边）
  const panelLeft = Math.max(8, pos.left - 220)

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="列显示设置"
      tabIndex={-1}
      style={{ ...PANEL_STYLE, top: pos.top, left: panelLeft }}
      onKeyDown={handleKeyDown}
      data-column-settings-panel
    >
      <div style={HEADER_STYLE}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted)' }}>列显示</span>
        <button
          type="button"
          style={CLOSE_BTN_STYLE}
          onClick={onClose}
          aria-label="关闭列设置"
          data-close-btn
        >
          ×
        </button>
      </div>
      {columns.map((col) => {
        const pref = value.get(col.id)
        const isVisible = pref !== undefined ? pref.visible : col.defaultVisible !== false
        const isPinned = col.pinned === true
        return (
          <label
            key={col.id}
            style={{
              ...ITEM_STYLE,
              opacity: isPinned ? 0.5 : 1,
              cursor: isPinned ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isVisible}
              disabled={isPinned}
              onChange={() => handleToggle(col.id, col.pinned)}
              aria-label={`${isPinned ? '固定列（不可隐藏）：' : ''}${typeof col.header === 'string' ? col.header : col.id}`}
            />
            <span style={{ flex: 1 }}>
              {col.header}
              {isPinned && <span style={{ fontSize: '10px', color: 'var(--fg-muted)', marginLeft: '4px' }}>固定</span>}
            </span>
          </label>
        )
      })}
    </div>,
    document.body,
  )
}
