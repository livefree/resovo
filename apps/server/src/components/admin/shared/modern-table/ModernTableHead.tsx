'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { ResolvedTableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'
import { ColumnHeaderMenu } from '@/components/admin/shared/modern-table/column-menu/ColumnHeaderMenu'

interface ModernTableHeadProps<T> {
  columns: Array<ResolvedTableColumn<T>>
  sort?: TableSortState
  onSortChange?: (nextSort: TableSortState) => void
  onColumnWidthChange?: (columnId: string, nextWidth: number) => void
  onHideColumn?: (id: string) => void
  /** 全部行 ID；与 selectedIds 一起决定全选 checkbox 状态 */
  allRowIds?: string[]
  /** 已选中行 ID 集合；存在时渲染全选 checkbox 列 */
  selectedIds?: string[]
  /** 全选/取消全选回调 */
  onSelectAll?: (checked: boolean) => void
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

// ── ColumnHeaderCellContent ───────────────────────────────────────

interface ColumnHeaderCellContentProps {
  column: ResolvedTableColumn<unknown>
  sort?: TableSortState
  onSortChange?: (nextSort: TableSortState) => void
  onHideColumn?: (id: string) => void
  openColumnMenu: string | null
  setOpenColumnMenu: (id: string | null) => void
}

function ColumnHeaderCellContent({
  column,
  sort,
  onSortChange,
  onHideColumn,
  openColumnMenu,
  setOpenColumnMenu,
}: ColumnHeaderCellContentProps) {
  const canSort = column.enableSorting === true && typeof onSortChange === 'function'
  const hasMenu = Boolean(column.columnMenu)
  const isMenuOpen = openColumnMenu === column.id
  const currentSortDir = sort?.field === column.id ? sort.direction : null
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  const menuCanSort = (
    column.columnMenu?.canSort === true
    && column.enableSorting !== false
    && typeof onSortChange === 'function'
  )

  const filterDot = column.columnMenu?.isFiltered
    ? <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--accent)]" />
    : null

  function handleMenuToggle() {
    if (isMenuOpen) {
      setOpenColumnMenu(null)
      return
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpenColumnMenu(column.id)
  }

  return (
    <div className="relative flex items-center gap-1">
      {canSort ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium hover:text-[var(--text)]"
          data-testid={`modern-table-sort-${column.id}`}
          onClick={() => onSortChange?.(getNextSort(column.id, sort))}
        >
          {column.header}
          {getSortIndicator(column.id, sort)}
          {filterDot}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm font-medium">
          {column.header}
          {filterDot}
        </span>
      )}

      {hasMenu && (
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${String(column.header)} 列菜单`}
          aria-expanded={isMenuOpen}
          onClick={handleMenuToggle}
          className="rounded px-1 text-xs text-[var(--muted)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
          data-testid={`column-menu-trigger-${column.id}`}
        >
          ⋮
        </button>
      )}

      {isMenuOpen && column.columnMenu && menuPos && createPortal(
        <div
          data-column-menu-container
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999, width: 0, height: 0 }}
        >
          <ColumnHeaderMenu
            canSort={menuCanSort}
            currentSortDir={currentSortDir}
            canHide={column.columnMenu.canHide === true}
            filterContent={column.columnMenu.filterContent}
            isFiltered={column.columnMenu.isFiltered}
            onSortAsc={() => {
              onSortChange?.({ field: column.id, direction: 'asc' })
              setOpenColumnMenu(null)
            }}
            onSortDesc={() => {
              onSortChange?.({ field: column.id, direction: 'desc' })
              setOpenColumnMenu(null)
            }}
            onHide={() => {
              onHideColumn?.(column.id)
              setOpenColumnMenu(null)
            }}
            onClearFilter={column.columnMenu.onClearFilter}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── ModernTableHead ───────────────────────────────────────────────

export function ModernTableHead<T>({
  columns,
  sort,
  onSortChange,
  onColumnWidthChange,
  onHideColumn,
  allRowIds,
  selectedIds,
  onSelectAll,
}: ModernTableHeadProps<T>) {
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Click-outside: close column menu on mousedown outside
  useEffect(() => {
    if (!openColumnMenu) return

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      // Close if click is outside a column menu container
      const menuContainers = document.querySelectorAll('[data-column-menu-container]')
      let inside = false
      menuContainers.forEach((el) => { if (el.contains(target)) inside = true })
      if (!inside) setOpenColumnMenu(null)
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [openColumnMenu])

  // Resize drag cleanup on unmount
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

  const hasSelection = selectedIds !== undefined
  const allChecked = hasSelection && (allRowIds?.length ?? 0) > 0
    && (allRowIds ?? []).every((id) => selectedIds.includes(id))
  const someChecked = hasSelection && selectedIds.length > 0 && !allChecked

  return (
    <thead className="bg-[var(--bg2)] text-[var(--muted)]">
      <tr>
        {hasSelection && (
          <th
            className="relative h-12 border-b border-[var(--subtle)] px-3 align-middle"
            style={{ width: '40px', minWidth: '40px' }}
          >
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = someChecked
              }}
              onChange={(e) => onSelectAll?.(e.target.checked)}
              className="accent-[var(--accent)]"
              data-testid="select-all-checkbox"
              aria-label="全选"
            />
          </th>
        )}
        {columns.map((column) => (
          <th
            key={column.id}
            data-column-menu-container
            className="relative h-12 border-b border-[var(--subtle)] px-4 text-left align-middle"
            style={{ width: `${column.width}px`, minWidth: `${column.minWidth}px` }}
            suppressHydrationWarning
          >
            <ColumnHeaderCellContent
              column={column as ResolvedTableColumn<unknown>}
              sort={sort}
              onSortChange={onSortChange}
              onHideColumn={onHideColumn}
              openColumnMenu={openColumnMenu}
              setOpenColumnMenu={setOpenColumnMenu}
            />
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
        ))}
      </tr>
    </thead>
  )
}
