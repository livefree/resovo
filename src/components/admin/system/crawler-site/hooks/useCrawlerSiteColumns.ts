import { useCallback, useMemo, useState } from 'react'
import {
  useAdminTableColumns,
  type AdminColumnMeta,
} from '@/components/admin/shared/table/useAdminTableColumns'
import {
  COLUMN_META,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_COLUMNS,
  DEFAULT_FILTERS,
  REQUIRED_COLUMNS,
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
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const tableColumns = useAdminTableColumns({
    route: '/admin/crawler-sites',
    tableId: 'crawler-site-table',
    columns: COLUMNS_CONFIG,
    defaultState: {
      sort: { field: 'name', dir: 'asc' },
    },
  })

  const { state, updatePartial, columns: resolvedColumns, startResize, toggleColumnVisibility } = tableColumns

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

  function toggleColumn(columnId: ColumnId) {
    if (REQUIRED_COLUMNS.includes(columnId)) return
    toggleColumnVisibility(columnId)
  }

  const columns = useMemo(() => {
    const result = { ...DEFAULT_COLUMNS }
    for (const col of resolvedColumns) {
      result[col.id as ColumnId] = col.visible
    }
    return result
  }, [resolvedColumns])

  const columnWidths = useMemo(() => {
    const result = { ...DEFAULT_COLUMN_WIDTH }
    for (const col of resolvedColumns) {
      result[col.id as ColumnId] = col.width
    }
    return result
  }, [resolvedColumns])

  const colClass = useCallback((id: ColumnId) => (columns[id] ? '' : 'hidden'), [columns])

  const visibleColumnCount = useMemo(
    () => resolvedColumns.filter((col) => col.visible).length,
    [resolvedColumns],
  )

  const visibleTableMinWidth = useMemo(
    () => resolvedColumns.reduce((sum, col) => (col.visible ? sum + col.width : sum), 44),
    [resolvedColumns],
  )

  return {
    sortBy,
    sortDir,
    filters,
    columns,
    columnWidths,
    showColumnsPanel,
    setFilters,
    setShowColumnsPanel,
    handleSort,
    setSort,
    toggleColumn,
    startResize,
    visibleColumnCount,
    colClass,
    visibleTableMinWidth,
    columnMeta: COLUMN_META,
    requiredColumns: REQUIRED_COLUMNS,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
  }
}
