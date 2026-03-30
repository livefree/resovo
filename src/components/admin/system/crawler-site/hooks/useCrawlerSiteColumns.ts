import { useState } from 'react'
import {
  COLUMN_META,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_FILTERS,
} from '@/components/admin/system/crawler-site/tableState'
import type {
  FilterState,
  SortDir,
  SortField,
} from '@/components/admin/system/crawler-site/tableState'

export function useCrawlerSiteColumns() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortDir('asc')
  }

  function setSort(field: SortField, dir: SortDir) {
    setSortBy(field)
    setSortDir(dir)
  }

  return {
    sortBy,
    sortDir,
    filters,
    setFilters,
    handleSort,
    setSort,
    columnMeta: COLUMN_META,
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
  }
}
