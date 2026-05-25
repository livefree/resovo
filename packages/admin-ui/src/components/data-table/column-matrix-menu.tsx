'use client'

/**
 * column-matrix-menu.tsx — DataTable 统一矩阵 popover（ADR-149 D-149-2/5/6/7/12）
 *
 * 真源：
 *   - docs/decisions.md ADR-149（D-149-5 矩阵语义 / D-149-6 过滤格 UI / D-149-7 排序格 UI /
 *     D-149-12 a11y 强制约束）
 *   - docs/audit/datatable-header-redesign-plan.md v3 §3.3 mockup
 *
 * 设计契约：
 *   - 矩阵语义 = 状态指示 + 批量清除；编辑过滤值走列名 ⋯ inline（本组件不内置）
 *   - 列 × [可见性 / 过滤 / 排序] 三维 grid
 *   - 不支持项灰化（pinned 可见性 / 无 filterContent 过滤 / enableSorting=false 排序）
 *   - 底部 3 批量按钮（清除全部过滤 / 清除排序 / 恢复默认列可见性）
 *
 * a11y（D-149-12）：
 *   - role="dialog" aria-modal="false" aria-label="列设置"
 *   - role="grid" + 行/单元格语义
 *   - switch / radiogroup 标准 ARIA
 *   - 5 键盘语义：ArrowUp/Down 行间 + ArrowLeft/Right 列间 + Space 切换 + Esc 关闭 + Tab 跳底部
 *   - 焦点回流：打开前保存 document.activeElement / 关闭时回 .focus()
 *
 * 范式：portal 渲染 / ESC 关闭 / 点击外部关闭 / focus trap，与 header-menu /
 *      hidden-columns-menu 同构（避免引入公共 hook 抽象在 EP-1 范围外）。
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  ColumnDescriptor,
  ColumnMenuConfig,
  ColumnPreference,
  FilterValue,
  TableSortState,
} from './types'
import { isColumnVisible, setColumnVisibility } from './column-visibility'

export interface ColumnMatrixMenuProps {
  readonly open: boolean
  /** 全部列（含 pinned）；ColumnDescriptor 与 useTableQuery 同惯例避免逆变冲突 */
  readonly columns: readonly ColumnDescriptor[]
  /** 各列 columnMenu 配置；按 column.id 查 */
  readonly columnMenus: ReadonlyMap<string, ColumnMenuConfig>
  /** 当前列可见性 + 宽度偏好 */
  readonly columnsValue: ReadonlyMap<string, ColumnPreference>
  /** 当前排序状态 */
  readonly currentSort: TableSortState
  /** 当前过滤状态（用于判定哪些列已过滤） */
  readonly currentFilters: ReadonlyMap<string, FilterValue>
  /** 触发器锚（toolbar 右端 ⋯ 或 thead 右端 ⋯） */
  readonly anchorRef: React.RefObject<HTMLElement | null>
  /** 列可见性变化（toggle 可见性 switch / 恢复默认列可见性按钮） */
  readonly onColumnsChange: (next: ReadonlyMap<string, ColumnPreference>) => void
  /** 关闭某列过滤 switch（关闭=清除该列过滤值） */
  readonly onClearColumnFilter: (colId: string) => void
  /** 设置某列排序方向（互斥单列：自动清除其他列排序） */
  readonly onSort: (field: string, direction: 'asc' | 'desc') => void
  /** 清除当前排序 */
  readonly onClearSort: () => void
  /** 底部批量按钮：清除全部过滤 */
  readonly onClearAllFilters: () => void
  /** 底部批量按钮：恢复默认列可见性（按 column.defaultVisible 重置） */
  readonly onResetColumnVisibility: () => void
  readonly onClose: () => void
}

interface Pos {
  top: number
  left: number
}
const DEFAULT_POS: Pos = { top: 0, left: 0 }

// ── 样式（核心 inline；细节走 dt-styles.tsx `[data-column-matrix-menu]` 选择器） ───

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-dropdown)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  minWidth: '520px',
  maxWidth: '90vw',
  maxHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-default)',
  fontSize: 'var(--font-size-sm-tight)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  flexShrink: 0,
}

const CLOSE_BTN_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: '16px',
  lineHeight: 1,
  padding: '2px 6px',
}

const GRID_WRAP_STYLE: React.CSSProperties = {
  overflowY: 'auto',
  overflowX: 'auto',
  flex: '1 1 auto',
  minHeight: 0,
}

const FOOT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 14px',
  borderTop: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  flexShrink: 0,
  flexWrap: 'wrap',
}

const FOOT_BTN_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-muted)',
  padding: '4px 10px',
  fontFamily: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
}

// ── 工具：判定该列是否已过滤 ─────────────────────────────────────────────
// sub 2 PATCH R-EP3A-1（2026-05-24）：D-150-4 业务 key 桥接 — filtersMap key 是
// col.filterFieldName（D-150 范式）或 col.id（D-149-15 桥接），统一用 filterFieldName ?? id

function isColumnFiltered(
  col: ColumnDescriptor,
  columnMenu: ColumnMenuConfig | undefined,
  currentFilters: ReadonlyMap<string, FilterValue>,
): boolean {
  // 优先消费方显式标记 columnMenu.isFiltered（适合业务 key 不与 column.id 对齐场景）
  if (columnMenu?.isFiltered === true) return true
  return currentFilters.has(col.filterFieldName ?? col.id)
}

export function ColumnMatrixMenu({
  open,
  columns,
  columnMenus,
  columnsValue,
  currentSort,
  currentFilters,
  anchorRef,
  onColumnsChange,
  onClearColumnFilter,
  onSort,
  onClearSort,
  onClearAllFilters,
  onResetColumnVisibility,
  onClose,
}: ColumnMatrixMenuProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>(DEFAULT_POS)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 位置计算：anchor bottom + 4 / 右对齐 left（防越界）
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const panelMinWidth = 520
    const left = Math.max(8, Math.min(rect.right - panelMinWidth, window.innerWidth - panelMinWidth - 8))
    setPos({ top: rect.bottom + 4, left })
  }, [open, anchorRef])

  // 窗口 resize / scroll 时重算位置
  useEffect(() => {
    if (!open) return
    const recalc = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      const panelMinWidth = 520
      const left = Math.max(8, Math.min(rect.right - panelMinWidth, window.innerWidth - panelMinWidth - 8))
      setPos({ top: rect.bottom + 4, left })
    }
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [open, anchorRef])

  // ESC 关闭 + 点击外部关闭
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
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

  // 焦点回流：打开前保存 / 关闭时恢复 / 打开后 focus 第一可交互
  useEffect(() => {
    if (!open || !mounted) return
    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null
    // 焦点第一可交互（跳过 close button）
    const first = panelRef.current?.querySelector<HTMLElement>(
      '[role="grid"] button:not([disabled]), [role="grid"] [role="switch"]:not([aria-disabled="true"])',
    )
    first?.focus()
    return () => {
      previousFocusRef.current?.focus?.()
    }
  }, [open, mounted])

  // 键盘语义：ArrowUp/Down/Left/Right 在 grid 内 cell 间移动焦点（D-149-12）
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        '[data-cell-focusable="true"]:not([aria-disabled="true"]):not([disabled])',
      ),
    )
    if (focusables.length === 0) return
    const active = document.activeElement as HTMLElement
    const idx = focusables.indexOf(active)
    if (idx < 0) return
    e.preventDefault()
    const activeRow = parseInt(active.dataset.gridRow ?? '0', 10)
    const activeCol = parseInt(active.dataset.gridCol ?? '0', 10)
    // 找同列上/下 或 同行左/右 最近 focusable
    let target: HTMLElement | undefined
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const sameColFocusables = focusables.filter((el) => parseInt(el.dataset.gridCol ?? '0', 10) === activeCol)
      const sameColIdx = sameColFocusables.indexOf(active)
      const delta = key === 'ArrowDown' ? 1 : -1
      target = sameColFocusables[sameColIdx + delta]
    } else {
      const sameRowFocusables = focusables.filter((el) => parseInt(el.dataset.gridRow ?? '0', 10) === activeRow)
      const sameRowIdx = sameRowFocusables.indexOf(active)
      const delta = key === 'ArrowRight' ? 1 : -1
      target = sameRowFocusables[sameRowIdx + delta]
    }
    target?.focus()
  }, [])

  // Tab 循环 focus trap
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button:not([disabled]), [role="switch"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault()
        last?.focus()
      }
    } else {
      if (active === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }, [])

  // ── 单格交互处理 ──────────────────────────────────────

  const toggleVisibility = useCallback(
    (col: ColumnDescriptor) => {
      if (col.pinned) return
      const visible = isColumnVisible(col, columnsValue)
      onColumnsChange(setColumnVisibility(columnsValue, col.id, !visible))
    },
    [columnsValue, onColumnsChange],
  )

  const handleFilterToggle = useCallback(
    (col: ColumnDescriptor, columnMenu: ColumnMenuConfig | undefined) => {
      const isFiltered = isColumnFiltered(col, columnMenu, currentFilters)
      // ADR-149 D-149-6：关闭=即时清除该列过滤值；开启=不直接编辑（用户应去列名 ⋯ inline）
      if (isFiltered) {
        // 优先 columnMenu.onClearFilter（消费方业务 key 不与 column.id 对齐时）
        if (columnMenu?.onClearFilter) {
          columnMenu.onClearFilter()
        } else {
          // sub 2 PATCH R-EP3A-1（2026-05-24）：D-150-4 桥接 — filtersMap key 是 filterFieldName ?? id
          onClearColumnFilter(col.filterFieldName ?? col.id)
        }
      }
      // 开启分支：UI 提示（无操作；用户应去列名 ⋯ 编辑过滤值）
    },
    [currentFilters, onClearColumnFilter],
  )

  const handleSortClick = useCallback(
    (col: ColumnDescriptor, direction: 'asc' | 'desc') => {
      const isCurrent = currentSort.field === col.id && currentSort.direction === direction
      if (isCurrent) {
        // 再次点击同方向 = 清除
        onClearSort()
      } else {
        onSort(col.id, direction)
      }
    },
    [currentSort, onSort, onClearSort],
  )

  const handleSortClear = useCallback(
    (col: ColumnDescriptor) => {
      if (currentSort.field === col.id) {
        onClearSort()
      }
    },
    [currentSort, onClearSort],
  )

  if (!open || !mounted || typeof document === 'undefined') return null

  // ── 渲染 ──────────────────────────────────────────────

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="列设置"
      tabIndex={-1}
      style={{ ...PANEL_STYLE, top: pos.top, left: pos.left }}
      data-column-matrix-menu
      onKeyDown={(e) => {
        handleGridKeyDown(e)
        handleTabKeyDown(e)
      }}
    >
      {/* Header */}
      <div style={HEADER_STYLE}>
        <span>列设置</span>
        <button
          type="button"
          aria-label="关闭列设置"
          style={CLOSE_BTN_STYLE}
          onClick={onClose}
          data-testid="column-matrix-close"
        >
          ×
        </button>
      </div>

      {/* Grid */}
      <div style={GRID_WRAP_STYLE} data-column-matrix-grid-wrap>
        <table
          role="grid"
          aria-rowcount={columns.length + 1}
          aria-label="列设置矩阵"
          data-column-matrix-grid
        >
          <thead>
            <tr role="row">
              <th role="columnheader" data-matrix-col="name">列名</th>
              <th role="columnheader" data-matrix-col="visibility">可见性</th>
              <th role="columnheader" data-matrix-col="filter">过滤</th>
              <th role="columnheader" data-matrix-col="sort">排序</th>
            </tr>
          </thead>
          <tbody>
            {/* AMD2 D-150-AMD2-9：action kind 整行跳过（不进矩阵 popover）*/}
            {columns.filter((col) => (col.kind ?? 'data') !== 'action').map((col, rowIdx) => {
              // AMD2 D-150-AMD2-1/2：kind 默认值规则 / data 默认全开 / media+computed 默认 false
              const kind = col.kind ?? 'data'
              const explicitFilterable = (col as { filterable?: boolean }).filterable
              const explicitSorting = (col as { enableSorting?: boolean }).enableSorting
              const columnMenu = columnMenus.get(col.id)
              const visible = isColumnVisible(col, columnsValue)
              const pinned = col.pinned === true
              const hasAutoFilter = kind === 'data' ? explicitFilterable !== false : explicitFilterable === true
              const hasFilterContent = columnMenu?.filterContent !== undefined || hasAutoFilter
              const filtered = isColumnFiltered(col, columnMenu, currentFilters)
              const baseSortable = kind === 'data' ? explicitSorting !== false : explicitSorting === true
              const sortable = baseSortable && columnMenu?.canSort !== false
              const isSortedAsc = currentSort.field === col.id && currentSort.direction === 'asc'
              const isSortedDesc = currentSort.field === col.id && currentSort.direction === 'desc'
              const isSorted = isSortedAsc || isSortedDesc
              const hidable = !pinned && columnMenu?.canHide !== false

              return (
                <tr key={col.id} role="row" data-matrix-row={col.id}>
                  {/* 列名（rowheader） */}
                  <th role="rowheader" scope="row" data-matrix-col="name">
                    {col.header}
                  </th>

                  {/* 可见性 cell */}
                  <td role="gridcell" data-matrix-col="visibility">
                    {pinned ? (
                      <span
                        aria-disabled="true"
                        aria-label={`${typeof col.header === 'string' ? col.header : col.id} 已锁定不可隐藏`}
                        data-locked="true"
                        data-testid={`matrix-visibility-locked-${col.id}`}
                      >
                        🔒
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={visible}
                        aria-label={`切换 ${typeof col.header === 'string' ? col.header : col.id} 可见性`}
                        disabled={!hidable}
                        data-cell-focusable="true"
                        data-grid-row={rowIdx + 1}
                        data-grid-col={1}
                        data-testid={`matrix-visibility-${col.id}`}
                        onClick={() => toggleVisibility(col)}
                      >
                        {visible ? '●─' : '─●'}
                      </button>
                    )}
                  </td>

                  {/* 过滤 cell */}
                  <td role="gridcell" data-matrix-col="filter">
                    {!hasFilterContent ? (
                      <span
                        aria-disabled="true"
                        aria-label={`${typeof col.header === 'string' ? col.header : col.id} 不支持过滤`}
                        data-unsupported="true"
                        data-testid={`matrix-filter-unsupported-${col.id}`}
                      >
                        —
                      </span>
                    ) : (
                      <div data-matrix-filter-cell="true">
                        {/* EP-4.5-HOTFIX-3 / 问题 2：未过滤 + 有 filterContent → switch disabled + title tooltip
                          * D-149-5 设计原意：矩阵看状态 / 改值走列名 ⋯ inline；switch 只能"关"不能"开"
                          * disabled 状态视觉灰化 + tooltip 提示用户去列名 ⋯ 编辑 */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={filtered}
                          aria-disabled={!filtered ? 'true' : undefined}
                          aria-label={
                            filtered
                              ? `关闭并清除 ${typeof col.header === 'string' ? col.header : col.id} 过滤`
                              : `${typeof col.header === 'string' ? col.header : col.id} 未过滤；点击列名右侧 ⋯ 编辑过滤值`
                          }
                          title={
                            filtered
                              ? undefined
                              : `请点击「${typeof col.header === 'string' ? col.header : col.id}」列名右侧 ⋯ 编辑过滤值`
                          }
                          disabled={!filtered}
                          data-cell-focusable={filtered ? 'true' : undefined}
                          data-grid-row={rowIdx + 1}
                          data-grid-col={2}
                          data-testid={`matrix-filter-${col.id}`}
                          onClick={() => handleFilterToggle(col, columnMenu)}
                        >
                          {filtered ? '●─' : '─●'}
                        </button>
                        {filtered && columnMenu?.filterSummary && (
                          <span
                            data-matrix-filter-summary="true"
                            title={columnMenu.filterSummary}
                            data-testid={`matrix-filter-summary-${col.id}`}
                          >
                            {columnMenu.filterSummary}
                          </span>
                        )}
                        {filtered && !columnMenu?.filterSummary && (
                          <span data-matrix-filter-summary="true">已过滤</span>
                        )}
                        {!filtered && (
                          <span
                            data-matrix-filter-hint="true"
                            data-testid={`matrix-filter-hint-${col.id}`}
                          >
                            列名 ⋯ 编辑
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 排序 cell */}
                  <td role="gridcell" data-matrix-col="sort">
                    {!sortable ? (
                      <span
                        aria-disabled="true"
                        aria-label={`${typeof col.header === 'string' ? col.header : col.id} 不支持排序`}
                        data-unsupported="true"
                        data-testid={`matrix-sort-unsupported-${col.id}`}
                      >
                        —
                      </span>
                    ) : (
                      <div
                        role="radiogroup"
                        aria-label={`${typeof col.header === 'string' ? col.header : col.id} 排序方向`}
                        data-matrix-sort-cell="true"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSortedAsc}
                          aria-label="升序"
                          data-cell-focusable="true"
                          data-grid-row={rowIdx + 1}
                          data-grid-col={3}
                          data-active={isSortedAsc}
                          data-testid={`matrix-sort-asc-${col.id}`}
                          onClick={() => handleSortClick(col, 'asc')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSortedDesc}
                          aria-label="降序"
                          data-cell-focusable="true"
                          data-grid-row={rowIdx + 1}
                          data-grid-col={3}
                          data-active={isSortedDesc}
                          data-testid={`matrix-sort-desc-${col.id}`}
                          onClick={() => handleSortClick(col, 'desc')}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label="清除该列排序"
                          disabled={!isSorted}
                          data-cell-focusable="true"
                          data-grid-row={rowIdx + 1}
                          data-grid-col={3}
                          data-testid={`matrix-sort-clear-${col.id}`}
                          onClick={() => handleSortClear(col)}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Foot */}
      <div style={FOOT_STYLE} role="group" aria-label="批量操作">
        <button
          type="button"
          style={FOOT_BTN_STYLE}
          onClick={onClearAllFilters}
          data-testid="matrix-foot-clear-filters"
        >
          清除全部过滤
        </button>
        <button
          type="button"
          style={FOOT_BTN_STYLE}
          onClick={onClearSort}
          data-testid="matrix-foot-clear-sort"
        >
          清除排序
        </button>
        <button
          type="button"
          style={FOOT_BTN_STYLE}
          onClick={onResetColumnVisibility}
          data-testid="matrix-foot-reset-visibility"
        >
          恢复默认列可见性
        </button>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
