import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COLUMN_META,
  DEFAULT_COLUMN_WIDTH,
  REQUIRED_COLUMNS,
  STORAGE_KEY,
  readPersistedState,
} from '@/components/admin/system/crawler-site/tableState'
import type {
  ColumnId,
  ColumnWidthState,
  ColumnVisibility,
  FilterState,
  SortDir,
  SortField,
} from '@/components/admin/system/crawler-site/tableState'

export function useCrawlerSiteColumns() {
  const [initialState] = useState(readPersistedState)
  const [sortBy, setSortBy] = useState<SortField>(initialState.sortBy)
  const [sortDir, setSortDir] = useState<SortDir>(initialState.sortDir)
  const [filters, setFilters] = useState<FilterState>(initialState.filters)
  const [columns, setColumns] = useState<ColumnVisibility>(initialState.columns)
  const [columnWidths, setColumnWidths] = useState<ColumnWidthState>(initialState.columnWidths)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const resizeRef = useRef<{ id: ColumnId; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sortBy,
          sortDir,
          filters,
          columns,
          columnWidths,
        }),
      )
    } catch {
      // 忽略 localStorage 异常
    }
  }, [sortBy, sortDir, filters, columns, columnWidths])

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortDir('asc')
  }

  function toggleColumn(columnId: ColumnId) {
    if (REQUIRED_COLUMNS.includes(columnId)) return
    setColumns((prev) => ({ ...prev, [columnId]: !prev[columnId] }))
  }

  function setColumnWidth(columnId: ColumnId, width: number) {
    const next = Math.max(72, Math.min(560, width))
    setColumnWidths((prev) => ({ ...prev, [columnId]: next }))
  }

  function startResize(columnId: ColumnId, clientX: number) {
    resizeRef.current = {
      id: columnId,
      startX: clientX,
      startWidth: columnWidths[columnId],
    }
  }

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!resizeRef.current) return
      const { id, startX, startWidth } = resizeRef.current
      const delta = event.clientX - startX
      setColumnWidth(id, startWidth + delta)
    }
    const onMouseUp = () => {
      resizeRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [columnWidths])

  const visibleColumnCount = useMemo(
    () => COLUMN_META.filter((column) => columns[column.id]).length,
    [columns],
  )
  const colClass = (id: ColumnId) => (columns[id] ? '' : 'hidden')
  const visibleTableMinWidth = useMemo(
    () => COLUMN_META.reduce((sum, column) => (
      columns[column.id] ? sum + columnWidths[column.id] : sum
    ), 44),
    [columns, columnWidths],
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
