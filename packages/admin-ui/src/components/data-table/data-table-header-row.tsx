'use client'

/**
 * data-table-header-row.tsx — DataTable sticky 表头行（DTR-A 拆自 data-table.tsx）
 *
 * 职责：渲染 sticky 表头 rowgroup —— selection 全选框 + 各列名（排序指示 + 列级 ⋯ 触发器）。
 * 交互回调由 DataTable 主组件注入（onHeaderClick / onOpenMenu / onSelectAll）。
 * DTR-B 将在此为可调列追加列宽 resize handle（仅表头列名之间，需求 (2)）。
 */
import React from 'react'
import type { TableColumn, TableSortState, FilterValue } from './types'
import { TH_STYLE } from './data-table-grid'

// ── sort indicator (inline SVG) ───────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | 'none' }) {
  const color = direction === 'none' ? 'var(--fg-muted)' : 'var(--fg-default)'
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
      <path
        d="M5 1L2 4H8L5 1Z"
        fill={direction === 'asc' ? color : 'var(--fg-muted)'}
        opacity={direction === 'none' ? 0.4 : 1}
      />
      <path
        d="M5 11L2 8H8L5 11Z"
        fill={direction === 'desc' ? color : 'var(--fg-muted)'}
        opacity={direction === 'none' ? 0.4 : 1}
      />
    </svg>
  )
}

export interface DataTableHeaderRowProps<T> {
  readonly gridTemplate: string
  readonly rowHeight: string
  readonly hasSelection: boolean
  readonly allPageSelected: boolean
  readonly somePageSelected: boolean
  readonly onSelectAll: () => void
  readonly visibleColumns: readonly TableColumn<T>[]
  readonly sort: TableSortState
  readonly filters: ReadonlyMap<string, FilterValue>
  readonly columnTriggerVisibility: 'auto' | 'always' | 'never'
  readonly openMenuColId: string | null
  /** 打开列级 ⋯ popover：消费方设置 anchor + 当前列 */
  readonly onOpenMenu: (colId: string, anchorEl: HTMLElement) => void
  /** 列名整体点击 → toggle 排序 */
  readonly onHeaderClick: (colId: string) => void
}

export function DataTableHeaderRow<T>({
  gridTemplate,
  rowHeight,
  hasSelection,
  allPageSelected,
  somePageSelected,
  onSelectAll,
  visibleColumns,
  sort,
  filters,
  columnTriggerVisibility,
  openMenuColId,
  onOpenMenu,
  onHeaderClick,
}: DataTableHeaderRowProps<T>): React.ReactElement {
  return (
    <div
      role="rowgroup"
      style={{ position: 'sticky', top: 0, zIndex: 1 }}
    >
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          height: rowHeight,
        }}
      >
        {hasSelection && (
          <div role="columnheader" style={{ ...TH_STYLE, justifyContent: 'center' }}>
            <input
              type="checkbox"
              checked={allPageSelected}
              ref={(el) => { if (el) el.indeterminate = somePageSelected }}
              onChange={onSelectAll}
              aria-label="全选当前页"
            />
          </div>
        )}
        {visibleColumns.map((col) => {
          // AMD2 D-150-AMD2-2：column.kind 默认值规则
          // - data（缺省）：filterable + enableSorting 默认 true / 显式 false 禁用
          // - action：filter 字段 type 层 never / 不显示 ⋯ 触发器
          // - media / computed：默认 false / 显式 true 启用
          const kind = col.kind ?? 'data'
          const explicitSorting = (col as { enableSorting?: boolean }).enableSorting
          const explicitFilterable = (col as { filterable?: boolean }).filterable
          const sortable = kind === 'action' ? false
            : kind === 'data' ? explicitSorting !== false
            : explicitSorting === true
          const isSorted = sort.field === col.id
          const sortDir = isSorted ? sort.direction : 'none'
          // ADR-149 D-149-3 R-149-2：列级 ⋯ 触发器可见性判定
          // AMD2：kind === 'action' 时永远不显触发器 / 其它走 sub1-EXTEND 6 条件 OR
          const hasFilter = col.columnMenu?.filterContent !== undefined
          const hasAutoFilter = kind === 'action' ? false
            : kind === 'data' ? explicitFilterable !== false
            : explicitFilterable === true
          const hidable = kind === 'action' ? false : (col.pinned !== true && col.columnMenu?.canHide !== false)
          // sub 2 PATCH R-EP3A-1：D-150-4 桥接 / filterFieldName ?? id
          const filterKey = (col as { filterFieldName?: string }).filterFieldName ?? col.id
          const isFiltered = col.columnMenu?.isFiltered === true || filters.has(filterKey)
          const isMenuOpen = openMenuColId === col.id
          const showTrigger = kind === 'action' ? false :
            columnTriggerVisibility === 'always' ? true :
            columnTriggerVisibility === 'never' ? false :
            sortable || hasFilter || hasAutoFilter || hidable || isFiltered || isSorted
          // 列名整体可点 → toggle 排序（如该列可排序）
          const interactive = sortable
          return (
            <div
              key={col.id}
              role="columnheader"
              aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              data-th-interactive={interactive ? 'true' : undefined}
              style={{ ...TH_STYLE, cursor: interactive ? 'pointer' : 'default' }}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onHeaderClick(col.id) : undefined}
              onKeyDown={interactive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHeaderClick(col.id) }
              } : undefined}
            >
              {col.header}
              {sortable && <SortIcon direction={sortDir} />}
              {showTrigger && (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                  aria-label={`${typeof col.header === 'string' ? col.header : col.id} 列操作`}
                  data-th-menu-icon
                  data-open={isMenuOpen ? 'true' : undefined}
                  data-active={isSorted || isFiltered ? 'true' : undefined}
                  data-testid={`th-menu-trigger-${col.id}`}
                  onClick={(e) => {
                    // ADR-149 D-149-3 R-149-6：必须 stopPropagation 防冒泡到列名 toggle 排序
                    e.stopPropagation()
                    onOpenMenu(col.id, e.currentTarget)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      e.preventDefault()
                      onOpenMenu(col.id, e.currentTarget)
                    }
                  }}
                >⋯</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
