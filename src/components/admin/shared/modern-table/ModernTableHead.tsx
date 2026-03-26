import type { ResolvedTableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'

interface ModernTableHeadProps<T> {
  columns: Array<ResolvedTableColumn<T>>
  sort?: TableSortState
  onSortChange?: (nextSort: TableSortState) => void
}

function getSortIndicator(columnId: string, sort?: TableSortState): string {
  if (!sort || sort.field !== columnId) return ''
  return sort.direction === 'asc' ? ' ↑' : ' ↓'
}

function getNextSort(columnId: string, sort?: TableSortState): TableSortState {
  if (!sort || sort.field !== columnId) {
    return { field: columnId, direction: 'asc' }
  }

  return {
    field: columnId,
    direction: sort.direction === 'asc' ? 'desc' : 'asc',
  }
}

export function ModernTableHead<T>({ columns, sort, onSortChange }: ModernTableHeadProps<T>) {
  return (
    <thead className="bg-[var(--bg2)] text-[var(--muted)]">
      <tr>
        {columns.map((column) => {
          const canSort = column.enableSorting === true && typeof onSortChange === 'function'

          return (
            <th
              key={column.id}
              className="h-12 border-b border-[var(--subtle)] px-4 text-left align-middle"
              style={{ width: `${column.width}px`, minWidth: `${column.minWidth}px` }}
            >
              {canSort ? (
                <button
                  type="button"
                  className="inline-flex items-center text-sm font-medium hover:text-[var(--text)]"
                  data-testid={`modern-table-sort-${column.id}`}
                  onClick={() => onSortChange?.(getNextSort(column.id, sort))}
                >
                  {column.header}
                  {getSortIndicator(column.id, sort)}
                </button>
              ) : (
                <span className="text-sm font-medium">{column.header}</span>
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
