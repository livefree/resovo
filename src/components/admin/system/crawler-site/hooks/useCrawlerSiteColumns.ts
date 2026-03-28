import { useState, useMemo } from 'react'
import {
  useAdminTableColumns,
  type AdminColumnMeta,
} from '@/components/admin/shared/table/useAdminTableColumns'
import {
  COLUMN_META,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_COLUMNS,
  DEFAULT_FILTERS,
} from '@/components/admin/system/crawler-site/tableState'
import type {
  ColumnId,
  FilterState,
  SortDir,
  SortField,
} from '@/components/admin/system/crawler-site/tableState'

const COLUMNS_CONFIG: AdminColumnMeta[] = COLUMN_META.map((col) => ({
  id: col.id,
  visible: DEFAULT_COLUMNS[col.id as ColumnId],
  width: DEFAULT_COLUMN_WIDTH[col.id as ColumnId],
  minWidth: 72,
  maxWidth: 560,
  resizable: true,
}))

export function useCrawlerSiteColumns() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const tableColumns = useAdminTableColumns({
    route: '/admin/crawler-sites',
    tableId: 'crawler-site-table',
    columns: COLUMNS_CONFIG,
    defaultState: {
      sort: { field: 'name', dir: 'asc' },
    },
  })

  const { state, updatePartial, columns: resolvedColumns, setColumnWidth, startResize } = tableColumns

  const sortBy = (state.sort?.field ?? 'name') as SortField
  const sortDir = (state.sort?.dir ?? 'asc') as SortDir

  function handleSort(field: SortField) {
    if (sortBy === field) {
      updatePartial({ sort: { field, dir: sortDir === 'asc' ? 'desc' : 'asc' } })
      return
    }
    updatePartial({ sort: { field, dir: 'asc' } })
  }

  function setSort(field: SortField, dir: SortDir) {
    updatePartial({ sort: { field, dir } })
  }

  const columnWidths = useMemo(() => {
    const result = { ...DEFAULT_COLUMN_WIDTH }
    for (const col of resolvedColumns) {
      result[col.id as ColumnId] = col.width
    }
    return result
  }, [resolvedColumns])

  return {
    sortBy,
    sortDir,
    filters,
    columnWidths,
    setFilters,
    handleSort,
    setSort,
    setColumnWidth,
    startResize,
    columnMeta: COLUMN_META,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
  }
}
