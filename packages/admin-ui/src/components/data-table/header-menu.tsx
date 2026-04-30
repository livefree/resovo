'use client'

/**
 * header-menu.tsx — DataTable 表头集成菜单 popover（CHG-DESIGN-02 Step 3/7）
 *
 * 真源：reference.md §4.4 + 设计稿 datatable.jsx DTHeaderMenu
 * arch-reviewer 决议：本步 wire 升降序 / 清除排序 / 过滤区块（含已过滤指示 + 清除过滤）
 *                  / 隐藏列；honors 现有 ColumnMenuConfig 的全部 4 个 gate
 *                  （canSort / canHide / isFiltered / onClearFilter）。
 *   - "固定到左" 推迟到 column.stickyLeft 运行时落地（避免 types-only 暴露）
 *
 * 范式：完全对照 ColumnSettingsPanel — portal 渲染、ESC + 点击外部关闭、
 *      anchorRef.getBoundingClientRect 计算位置、focus 首项。
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnDescriptor, ColumnMenuConfig, ColumnPreference, TableSortState } from './types'

export interface HeaderMenuProps {
  readonly open: boolean
  /** ColumnDescriptor 而非 TableColumn<T>（逆变隔离，与 ColumnSettingsPanel 同惯例） */
  readonly column: ColumnDescriptor | null
  /**
   * 列的 columnMenu 配置（gate + filter slot）。
   * canSort=false 隐藏升降序；canHide=false 隐藏"隐藏此列"按钮；
   * isFiltered=true 显示"已过滤"指示 + （配合 onClearFilter）"清除过滤" 按钮；
   * filterContent 提供时渲染过滤区块。
   */
  readonly columnMenu?: ColumnMenuConfig
  readonly anchorRef: React.RefObject<HTMLElement | null>
  readonly currentSort: TableSortState
  readonly columnsValue: ReadonlyMap<string, ColumnPreference>
  readonly onSort: (field: string, direction: 'asc' | 'desc') => void
  readonly onClearSort: () => void
  readonly onHide: (field: string) => void
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

/**
 * 把 filterContent 物化为可重复渲染的形态：单次 iterable（generator / iterator
 * 等）转 Array，避免"检测时消耗、React 渲染时空"的 single-use 陷阱。
 * Array / 字符串 / ReactElement / 原始值原样返回（不复制）。
 */
function materializeFilterContent(node: React.ReactNode): React.ReactNode {
  if (node === null || node === undefined) return node
  if (typeof node !== 'object') return node
  if (Array.isArray(node)) return node
  const candidate = node as { [Symbol.iterator]?: unknown }
  if (typeof candidate[Symbol.iterator] === 'function') {
    // Set / generator / 自定义 iterable 一次性物化为 Array，下游可重复迭代
    return Array.from(node as Iterable<React.ReactNode>)
  }
  return node
}

/**
 * ReactNode 中"渲染为空"的合法值检测（递归数组）。
 * 用途：决定是否渲染过滤区块——避免合法但视觉为空的值触发空"过滤"标签 + 空白区块。
 *
 * 调用前必须先 materializeFilterContent，确保 single-use iterable 已转为 Array。
 *
 * 处理顺序：
 *   1. nullish / boolean → false
 *   2. 字符串 → 仅非空时 renderable
 *   3. number / bigint → true
 *   4. Array → 至少一个元素 renderable（递归）
 *   5. 非 array 对象（ReactElement / ReactPortal）→ 视为 renderable
 *
 * 不覆盖：空 React Fragment <></>（检测需 inspect 内部 children，脆弱）。
 */
function isRenderableNode(node: React.ReactNode): boolean {
  if (node === undefined || node === null) return false
  if (typeof node === 'boolean') return false
  if (typeof node === 'string') return node !== ''
  if (typeof node === 'number' || typeof node === 'bigint') return true
  if (typeof node !== 'object') return true
  if (Array.isArray(node)) return node.some(isRenderableNode)
  // 非 array object（ReactElement / ReactPortal）— 视为 renderable
  return true
}

export function HeaderMenu({
  open,
  column,
  columnMenu,
  anchorRef,
  currentSort,
  columnsValue,
  onSort,
  onClearSort,
  onHide,
  onClose,
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

  // 物化 filterContent — useRef 缓存（React 不会主动丢弃 ref，比 useMemo 更安全）
  // 关闭菜单时 columnMenu=undefined，source 变 undefined；此时不动缓存，
  // 避免重开后丢失已物化的 array 而重新消耗已耗尽的 generator（Codex 第 6 轮 review）
  // 缓存条目 { source, result }：
  //   - source nullish → 跳过缓存维护
  //   - source 同上次 → 复用缓存
  //   - source 变化为新的非空值 → 重新物化
  const cacheRef = useRef<{ source: React.ReactNode; result: React.ReactNode } | null>(null)
  const source = columnMenu?.filterContent
  let filterContent: React.ReactNode = undefined
  if (source !== undefined && source !== null) {
    if (cacheRef.current?.source !== source) {
      cacheRef.current = { source, result: materializeFilterContent(source) }
    }
    filterContent = cacheRef.current.result
  }

  if (!open || !mounted || !column) return null

  // 排序门控：column.enableSorting + columnMenu.canSort（默认允许）
  const sortable = column.enableSorting === true && columnMenu?.canSort !== false
  const isSortedAsc = currentSort.field === column.id && currentSort.direction === 'asc'
  const isSortedDesc = currentSort.field === column.id && currentSort.direction === 'desc'

  // 隐藏门控：pinned 列不可隐藏；columnMenu.canHide 显式 false 也不可隐藏
  const isPinned = column.pinned === true
  const stored = columnsValue.get(column.id)
  const isVisible = stored !== undefined ? stored.visible : column.defaultVisible !== false
  const hideable = !isPinned && isVisible && columnMenu?.canHide !== false

  // 过滤门控：filterContent（已物化）renderable OR isFiltered=true（"已过滤"标记单独显示也有意义）
  const hasRenderableFilter = isRenderableNode(filterContent)
  const isFiltered = columnMenu?.isFiltered === true
  const showFilterSection = hasRenderableFilter || isFiltered
  const canClearFilter = isFiltered && columnMenu?.onClearFilter !== undefined

  // 分隔线条件
  const showSepBeforeFilter = sortable && showFilterSection
  const showSepBeforeHide = (sortable || showFilterSection) && hideable

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
      {showFilterSection && (
        <>
          {showSepBeforeFilter && <div style={SEP_STYLE} aria-hidden="true" />}
          <div style={FILTER_WRAP_STYLE}>
            <div style={FILTER_LABEL_STYLE}>
              <span>过滤</span>
              {isFiltered && (
                <span
                  data-header-menu-filter-active
                  style={{ marginLeft: '6px', color: 'var(--admin-accent-on-soft)' }}
                >已过滤</span>
              )}
            </div>
            {hasRenderableFilter && filterContent}
            {canClearFilter && (
              <button
                type="button"
                role="menuitem"
                style={{ ...ITEM_STYLE, padding: '6px 0', marginTop: '4px' }}
                onClick={() => {
                  columnMenu?.onClearFilter?.()
                  onClose()
                }}
              >
                <span aria-hidden="true">×</span>
                <span>清除过滤</span>
              </button>
            )}
          </div>
        </>
      )}
      {showSepBeforeHide && <div style={SEP_STYLE} aria-hidden="true" />}
      {hideable && (
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
