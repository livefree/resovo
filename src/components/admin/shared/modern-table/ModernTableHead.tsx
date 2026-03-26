import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { ResolvedTableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'

interface ModernTableHeadProps<T> {
  columns: Array<ResolvedTableColumn<T>>
  sort?: TableSortState
  onSortChange?: (nextSort: TableSortState) => void
  onColumnWidthChange?: (columnId: string, nextWidth: number) => void
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

export function ModernTableHead<T>({
  columns,
  sort,
  onSortChange,
  onColumnWidthChange,
}: ModernTableHeadProps<T>) {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    cleanupRef.current?.()
  }, [])

  function handleResizeMouseDown(
    event: ReactMouseEvent<HTMLSpanElement>,
    columnId: string,
    startWidth: number,
    minWidth: number,
  ) {
    if (!onColumnWidthChange) return
    event.preventDefault()
    event.stopPropagation()

    cleanupRef.current?.()
    const startX = event.clientX

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      const nextWidth = Math.max(minWidth, Math.floor(startWidth + delta))
      onColumnWidthChange(columnId, nextWidth)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      cleanupRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    cleanupRef.current = onMouseUp
  }

  return (
    <thead className="bg-[var(--bg2)] text-[var(--muted)]">
      <tr>
        {columns.map((column) => {
          const canSort = column.enableSorting === true && typeof onSortChange === 'function'

          return (
            <th
              key={column.id}
              className="relative h-12 border-b border-[var(--subtle)] px-4 text-left align-middle"
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
              {column.enableResizing && onColumnWidthChange ? (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`调整${column.id}列宽`}
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                  data-testid={`modern-table-resize-${column.id}`}
                  onMouseDown={(event) => handleResizeMouseDown(event, column.id, column.width, column.minWidth)}
                />
              ) : null}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
