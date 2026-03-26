/**
 * CrawlerSiteTable.tsx — 爬虫站点表格（Client Component）
 * CHG-228: HeaderCell → CrawlerSiteTableHead; 列定义 → useCrawlerSiteTableColumns
 */

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CrawlerSite, UpdateCrawlerSiteInput } from '@/types'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { ColumnId, ColumnWidthState, FilterState, SortDir, SortField } from '@/components/admin/system/crawler-site/tableState'
import { DEFAULT_FILTERS } from '@/components/admin/system/crawler-site/tableState'
import { useCrawlerSiteTableColumns, normalizeWeightPreset } from '@/components/admin/system/crawler-site/hooks/useCrawlerSiteTableColumns'
import type { WeightPreset } from '@/components/admin/system/crawler-site/components/CrawlerSiteTableHead'

type ValidateStatus = 'idle' | 'checking' | 'ok' | 'error' | 'timeout'

interface CrawlerSiteTableProps {
  displaySites: CrawlerSite[]
  selected: Set<string>
  allVisibleSelected: boolean
  sortBy: SortField
  sortDir: SortDir
  filters: FilterState
  columnWidths: ColumnWidthState
  validateStates: Record<string, ValidateStatus>
  rowSaving: Record<string, boolean>
  runningBySite: Record<string, boolean>
  setFilters: Dispatch<SetStateAction<FilterState>>
  setSort: (field: SortField, dir: SortDir) => void
  toggleColumn: (columnId: ColumnId) => void
  showColumnsPanel: boolean
  setShowColumnsPanel: Dispatch<SetStateAction<boolean>>
  columns: Record<ColumnId, boolean>
  columnMeta: Array<{ id: ColumnId; label: string }>
  requiredColumns: ColumnId[]
  setColumnWidth: (columnId: ColumnId, nextWidth: number) => void
  toggleSelect: (key: string) => void
  toggleAll: () => void
  handleInlineUpdate: (site: CrawlerSite, patch: UpdateCrawlerSiteInput, showSuccess?: boolean) => Promise<void>
  handleToggleDisabled: (site: CrawlerSite) => Promise<void>
  handleValidate: (site: CrawlerSite) => Promise<void>
  handleTriggerCrawl: (type: 'full-crawl' | 'incremental-crawl', site?: CrawlerSite) => Promise<void>
  handleDelete: (site: CrawlerSite) => Promise<void>
  setEditTarget: (site: CrawlerSite) => void
  showToast: (msg: string, ok: boolean) => void
}

export function CrawlerSiteTable(props: CrawlerSiteTableProps) {
  const {
    displaySites, selected, allVisibleSelected, sortBy, sortDir, filters, columnWidths,
    validateStates, rowSaving, runningBySite, setFilters, setSort, toggleColumn,
    showColumnsPanel, setShowColumnsPanel, columns, columnMeta, requiredColumns,
    setColumnWidth, toggleSelect, toggleAll, handleInlineUpdate, handleToggleDisabled,
    handleValidate, handleTriggerCrawl, handleDelete, setEditTarget, showToast,
  } = props

  const [openMenuColumn, setOpenMenuColumn] = useState<ColumnId | null>(null)
  const [weightPresets, setWeightPresets] = useState<WeightPreset>({ high: 80, medium: 50, low: 20 })
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpenMenuColumn(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [])

  const clearColumnFilter = useMemo(
    () => (columnId: ColumnId) => {
      switch (columnId) {
        case 'name': setFilters((p) => ({ ...p, keyOrName: DEFAULT_FILTERS.keyOrName })); break
        case 'key': setFilters((p) => ({ ...p, apiUrl: DEFAULT_FILTERS.apiUrl })); break
        case 'typeFormat': setFilters((p) => ({ ...p, sourceType: DEFAULT_FILTERS.sourceType, format: DEFAULT_FILTERS.format })); break
        case 'weight': setFilters((p) => ({ ...p, weightMin: DEFAULT_FILTERS.weightMin, weightMax: DEFAULT_FILTERS.weightMax })); break
        case 'isAdult': setFilters((p) => ({ ...p, isAdult: DEFAULT_FILTERS.isAdult })); break
        case 'fromConfig': setFilters((p) => ({ ...p, fromConfig: DEFAULT_FILTERS.fromConfig })); break
        case 'enabled': setFilters((p) => ({ ...p, disabled: DEFAULT_FILTERS.disabled })); break
        default: break
      }
    },
    [setFilters],
  )

  function handlePatchWeightPreset(level: 'high' | 'medium' | 'low', value: string) {
    setWeightPresets((prev) => normalizeWeightPreset(level, value, prev))
  }

  const tableColumns = useCrawlerSiteTableColumns({
    displaySites, selected, allVisibleSelected, sortBy, sortDir, filters, columnWidths,
    columns, columnMeta, requiredColumns, openMenuColumn,
    setOpenMenuColumn: setOpenMenuColumn as Dispatch<SetStateAction<ColumnId | null>>,
    weightPresets, onPatchWeightPreset: handlePatchWeightPreset,
    setFilters, clearColumnFilter, setSort, toggleColumn,
    showColumnsPanel, setShowColumnsPanel, toggleSelect, toggleAll,
    deps: {
      rowSaving, runningBySite, validateStates, weightPresets,
      handleInlineUpdate, handleToggleDisabled, handleValidate,
      handleTriggerCrawl, handleDelete, setEditTarget, showToast,
    },
  })

  function handleColumnWidthChange(columnId: string, nextWidth: number) {
    if (columnId !== 'selection') setColumnWidth(columnId as ColumnId, nextWidth)
  }

  return (
    <div
      ref={wrapperRef}
      data-testid="crawler-sites-scroll-container"
      className="h-[60vh] min-h-[420px] max-h-[720px] overflow-y-auto"
    >
      <ModernDataTable
        columns={tableColumns}
        rows={displaySites}
        emptyText="没有符合当前筛选条件的源站"
        getRowId={(row) => row.key}
        onColumnWidthChange={handleColumnWidthChange}
      />
    </div>
  )
}
