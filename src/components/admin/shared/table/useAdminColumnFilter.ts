import { useMemo, useState } from 'react'
import type { AdminResolvedColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import type { AdminTableFiltersState } from '@/components/admin/shared/table/useAdminTableState'

type TableStateController = {
  state: {
    filters?: AdminTableFiltersState
  }
  updatePartial: (partial: { filters?: AdminTableFiltersState }) => void
}

type UseAdminColumnFilterOptions = {
  tableState: TableStateController
  columnsById?: Record<string, AdminResolvedColumnMeta>
}

export type ColumnFilterRenderContext = {
  columnId: string
  open: boolean
  active: boolean
  value: string | number | boolean | null
  setValue: (value: string | number | boolean | null) => void
  clear: () => void
  close: () => void
  toggle: () => void
}

function hasColumn(
  columnId: string,
  columnsById: Record<string, AdminResolvedColumnMeta> | undefined,
): boolean {
  if (!columnsById) return true
  return Boolean(columnsById[columnId])
}

function isActiveValue(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

export function useAdminColumnFilter(options: UseAdminColumnFilterOptions) {
  const { tableState, columnsById } = options
  const [openState, setOpenState] = useState<Record<string, boolean>>({})

  const filters = useMemo(
    () => tableState.state.filters ?? {},
    [tableState.state.filters],
  )

  const activeMap = useMemo(() => {
    const next: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(filters)) {
      next[key] = isActiveValue(value)
    }
    return next
  }, [filters])

  function isFilterOpen(columnId: string): boolean {
    return openState[columnId] === true
  }

  function openFilter(columnId: string) {
    if (!hasColumn(columnId, columnsById)) return
    setOpenState((prev) => ({ ...prev, [columnId]: true }))
  }

  function closeFilter(columnId: string) {
    setOpenState((prev) => ({ ...prev, [columnId]: false }))
  }

  function toggleFilter(columnId: string) {
    if (!hasColumn(columnId, columnsById)) return
    setOpenState((prev) => ({ ...prev, [columnId]: !prev[columnId] }))
  }

  function getColumnFilterValue(columnId: string): string | number | boolean | null {
    if (!hasColumn(columnId, columnsById)) return null
    return filters[columnId] ?? null
  }

  function setColumnFilterValue(columnId: string, value: string | number | boolean | null) {
    if (!hasColumn(columnId, columnsById)) return
    tableState.updatePartial({
      filters: {
        [columnId]: value,
      },
    })
  }

  function clearColumnFilter(columnId: string) {
    if (!hasColumn(columnId, columnsById)) return
    setColumnFilterValue(columnId, null)
  }

  function isColumnFiltered(columnId: string): boolean {
    if (!hasColumn(columnId, columnsById)) return false
    return activeMap[columnId] === true
  }

  function getFilterRenderContext(columnId: string): ColumnFilterRenderContext {
    return {
      columnId,
      open: isFilterOpen(columnId),
      active: isColumnFiltered(columnId),
      value: getColumnFilterValue(columnId),
      setValue: (value) => setColumnFilterValue(columnId, value),
      clear: () => clearColumnFilter(columnId),
      close: () => closeFilter(columnId),
      toggle: () => toggleFilter(columnId),
    }
  }

  return {
    filters,
    activeMap,
    isFilterOpen,
    openFilter,
    closeFilter,
    toggleFilter,
    getColumnFilterValue,
    setColumnFilterValue,
    clearColumnFilter,
    isColumnFiltered,
    getFilterRenderContext,
  }
}
