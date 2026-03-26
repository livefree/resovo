import type { ReactNode } from 'react'
import type { ResolvedTableColumn } from '@/components/admin/shared/modern-table/types'

interface ModernTableBodyProps<T> {
  columns: Array<ResolvedTableColumn<T>>
  rows: T[]
  loading?: boolean
  loadingText?: string
  emptyText?: string
  getRowId: (row: T, rowIndex: number) => string
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

export function ModernTableBody<T>({
  columns,
  rows,
  loading = false,
  loadingText = '加载中…',
  emptyText = '暂无数据',
  getRowId,
}: ModernTableBodyProps<T>) {
  if (loading) {
    return (
      <tbody>
        <tr>
          <td
            className="h-12 px-4 text-center text-sm text-[var(--muted)]"
            colSpan={columns.length}
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
            colSpan={columns.length}
          >
            {emptyText}
          </td>
        </tr>
      </tbody>
    )
  }

  return (
    <tbody>
      {rows.map((row, rowIndex) => (
        <tr
          key={getRowId(row, rowIndex)}
          className="h-12 border-b border-[var(--subtle)] bg-[var(--bg)] hover:bg-[var(--bg2)]"
          data-testid={`modern-table-row-${getRowId(row, rowIndex)}`}
        >
          {columns.map((column) => (
            <td
              key={`${getRowId(row, rowIndex)}-${column.id}`}
              className="h-12 whitespace-nowrap overflow-hidden text-ellipsis px-4 align-middle text-sm text-[var(--text)]"
              style={{ width: `${column.width}px`, minWidth: `${column.minWidth}px` }}
            >
              {renderCellValue(column, row, rowIndex)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}
