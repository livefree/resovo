'use client'

/**
 * data-table-body.tsx — DataTable 行渲染 rowgroup（DTR-A 拆自 data-table.tsx）
 *
 * 职责：loading / error / empty 状态 + 数据行（selection 框 + 各列 cell + 可展开行）。
 * 纵向滚动由父级 [data-table-scroll] 承担，本 wrapper 仅作 row 容器（保留 [data-table-body] 标记）。
 * 行样式 / hover / selection / 展开状态由 DataTable 主组件通过 props 注入，零行为变化。
 */
import React from 'react'
import type { ReactNode } from 'react'
import type { TableColumn, TableSelectionState } from './types'
import { TD_STYLE } from './data-table-grid'

export interface DataTableBodyProps<T> {
  readonly loading?: boolean
  readonly error?: Error | undefined
  readonly emptyState?: ReactNode
  readonly pageRows: readonly T[]
  readonly rowKey: (row: T) => string
  readonly hasSelection: boolean
  readonly selection?: TableSelectionState
  readonly visibleColumns: readonly TableColumn<T>[]
  readonly rowStyle: (key: string) => React.CSSProperties
  readonly onRowHover: (key: string | null) => void
  readonly onSelectRow: (key: string) => void
  readonly onRowClick?: (row: T, index: number) => void
  readonly flashRowKeys?: ReadonlySet<string>
  readonly expandedKeys?: ReadonlySet<string>
  readonly renderExpandedRow?: (row: T) => React.ReactNode
}

export function DataTableBody<T>({
  loading,
  error,
  emptyState,
  pageRows,
  rowKey,
  hasSelection,
  selection,
  visibleColumns,
  rowStyle,
  onRowHover,
  onSelectRow,
  onRowClick,
  flashRowKeys,
  expandedKeys,
  renderExpandedRow,
}: DataTableBodyProps<T>): React.ReactElement {
  return (
    <div role="rowgroup" data-table-body>
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-muted)' }}>
          加载中…
        </div>
      )}
      {!loading && error && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--state-error-fg)' }}>
          {error.message}
        </div>
      )}
      {!loading && !error && pageRows.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-muted)' }}>
          {emptyState ?? '暂无数据'}
        </div>
      )}
      {!loading && !error && pageRows.map((row, idx) => {
        const key = rowKey(row)
        const isFlashing = flashRowKeys?.has(key) ?? false
        const isExpanded = expandedKeys?.has(key) ?? false
        return (
          <React.Fragment key={key}>
            <div
              role="row"
              aria-selected={selection?.selectedKeys.has(key)}
              aria-expanded={renderExpandedRow ? isExpanded : undefined}
              data-flash={isFlashing ? 'true' : undefined}
              style={rowStyle(key)}
              onMouseEnter={() => onRowHover(key)}
              onMouseLeave={() => onRowHover(null)}
              onClick={() => onRowClick?.(row, idx)}
            >
              {hasSelection && (
                <div role="cell" style={{ ...TD_STYLE, justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selection?.selectedKeys.has(key) ?? false}
                    onChange={() => onSelectRow(key)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`选择行 ${key}`}
                  />
                </div>
              )}
              {visibleColumns.map((col) => {
                const value = col.accessor(row)
                const content = col.cell
                  ? col.cell({ row, value, rowIndex: idx })
                  : String(value ?? '')
                return (
                  <div
                    key={col.id}
                    role="cell"
                    style={{
                      ...TD_STYLE,
                      ...(col.overflowVisible ? { overflow: 'visible' } : {}),
                    }}
                  >
                    {content}
                  </div>
                )
              })}
            </div>
            {isExpanded && renderExpandedRow && (
              <div data-table-expand-panel role="region" aria-label={`展开行 ${key}`}>
                {renderExpandedRow(row)}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
