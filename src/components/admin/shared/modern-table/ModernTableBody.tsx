import type { ReactNode } from 'react'
import type { ResolvedTableColumn } from '@/components/admin/shared/modern-table/types'

interface ModernTableBodyProps<T> {
  columns: Array<ResolvedTableColumn<T>>
  rows: T[]
  loading?: boolean
  loadingText?: string
  emptyText?: string
  getRowId: (row: T, rowIndex: number) => string
  /** 选中行 ID 集合；存在时渲染 checkbox 列 */
  selectedIds?: string[]
  /** 单行勾选回调 */
  onRowSelect?: (id: string, checked: boolean) => void
}

function renderCellValue<T>(column: ResolvedTableColumn<T>, row: T, rowIndex: number): ReactNode {
  const value = column.accessor(row)

  if (column.cell) {
    return column.cell({ row, value, rowIndex })
  }

  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  return value as ReactNode
}

const CHECKBOX_COL_WIDTH = 40

export function ModernTableBody<T>({
  columns,
  rows,
  loading = false,
  loadingText = '加载中…',
  emptyText = '暂无数据',
  getRowId,
  selectedIds,
  onRowSelect,
}: ModernTableBodyProps<T>) {
  const hasSelection = selectedIds !== undefined
  const totalCols = columns.length + (hasSelection ? 1 : 0)

  if (loading) {
    return (
      <tbody>
        <tr>
          <td
            className="h-12 px-4 text-center text-sm text-[var(--muted)]"
            colSpan={totalCols}
          >
            {loadingText}
          </td>
        </tr>
      </tbody>
    )
  }

  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td
            className="h-12 px-4 text-center text-sm text-[var(--muted)]"
            colSpan={totalCols}
          >
            {emptyText}
          </td>
        </tr>
      </tbody>
    )
  }

  return (
    <tbody>
      {rows.map((row, rowIndex) => {
        const rowId = getRowId(row, rowIndex)
        const isSelected = hasSelection && selectedIds.includes(rowId)
        return (
          <tr
            key={rowId}
            className={`h-12 border-b border-[var(--subtle)] bg-[var(--bg)] hover:bg-[var(--bg2)] ${isSelected ? 'bg-[var(--bg3)]' : ''}`}
            data-testid={`modern-table-row-${rowId}`}
          >
            {hasSelection && (
              <td
                className="h-12 px-3 align-middle"
                style={{ width: `${CHECKBOX_COL_WIDTH}px`, minWidth: `${CHECKBOX_COL_WIDTH}px` }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onRowSelect?.(rowId, e.target.checked)}
                  className="accent-[var(--accent)]"
                  data-testid={`row-checkbox-${rowId}`}
                  aria-label={`选择行 ${rowId}`}
                />
              </td>
            )}
            {columns.map((column) => (
              <td
                key={`${rowId}-${column.id}`}
                className={`h-12 whitespace-nowrap px-4 align-middle text-sm text-[var(--text)] ${column.overflowVisible ? 'overflow-visible' : 'overflow-hidden text-ellipsis'}`}
                style={{ width: `${column.width}px`, minWidth: `${column.minWidth}px` }}
              >
                {renderCellValue(column, row, rowIndex)}
              </td>
            ))}
          </tr>
        )
      })}
    </tbody>
  )
}
