import { useEffect, useMemo } from 'react'
import type { AdminResolvedColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import type { AdminTableSortState, AdminTableState } from '@/components/admin/shared/table/useAdminTableState'

type TableStateController = {
  state: AdminTableState
  setState: (nextState: AdminTableState) => void
  updatePartial: (partial: { sort?: AdminTableSortState }) => void
}

type SortableConfig = string[] | Record<string, boolean>

type UseAdminTableSortOptions = {
  tableState: TableStateController
  defaultSort?: AdminTableSortState
  sortable?: SortableConfig
  columnsById?: Record<string, AdminResolvedColumnMeta>
}

function canSortField(
  field: string,
  sortable: SortableConfig | undefined,
  columnsById: Record<string, AdminResolvedColumnMeta> | undefined,
): boolean {
  if (columnsById && !columnsById[field]) return false

  if (!sortable) return true

  if (Array.isArray(sortable)) {
    return sortable.includes(field)
  }

  return sortable[field] === true
}

export function useAdminTableSort(options: UseAdminTableSortOptions) {
  const { tableState, defaultSort, sortable, columnsById } = options

  const sort = tableState.state.sort ?? defaultSort

  useEffect(() => {
    if (!defaultSort) return
    if (tableState.state.sort) return
    if (!canSortField(defaultSort.field, sortable, columnsById)) return

    tableState.updatePartial({
      sort: defaultSort,
    })
  }, [tableState, defaultSort, sortable, columnsById])

  const sortableFields = useMemo(() => {
    if (!sortable) return undefined
    if (Array.isArray(sortable)) return sortable
    return Object.keys(sortable).filter((key) => sortable[key])
  }, [sortable])

  function isSortable(field: string): boolean {
    return canSortField(field, sortable, columnsById)
  }

  function setSort(field: string, dir: 'asc' | 'desc') {
    if (!isSortable(field)) return
    tableState.updatePartial({ sort: { field, dir } })
  }

  function toggleSort(field: string) {
    if (!isSortable(field)) return
    if (!sort || sort.field !== field) {
      setSort(field, 'asc')
      return
    }
    setSort(field, sort.dir === 'asc' ? 'desc' : 'asc')
  }

  function clearSort() {
    tableState.setState({
      ...tableState.state,
      sort: undefined,
    })
  }

  function isSortedBy(field: string): boolean {
    return sort?.field === field
  }

  return {
    sort,
    sortableFields,
    isSortable,
    isSortedBy,
    setSort,
    toggleSort,
    clearSort,
  }
}
