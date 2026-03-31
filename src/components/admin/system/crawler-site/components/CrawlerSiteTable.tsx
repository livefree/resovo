/**
 * CrawlerSiteTable.tsx — 爬虫站点表格（Client Component）
 * CHG-228: 列定义 → useCrawlerSiteTableColumns
 * CHG-327: 迁移至共享 ColumnHeaderMenu；增加 sort/onSortChange wiring
 */

import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import type { CrawlerSite, UpdateCrawlerSiteInput } from '@/types'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import type { ColumnId, FilterState, SortDir, SortField, WeightPreset } from '@/components/admin/system/crawler-site/tableState'
import { COLUMN_META, DEFAULT_COLUMNS, DEFAULT_FILTERS, REQUIRED_COLUMNS } from '@/components/admin/system/crawler-site/tableState'
import { useCrawlerSiteTableColumns, normalizeWeightPreset } from '@/components/admin/system/crawler-site/hooks/useCrawlerSiteTableColumns'

type ValidateStatus = 'idle' | 'checking' | 'ok' | 'error' | 'timeout'

const CRAWLER_SITE_SETTINGS_COLUMNS = COLUMN_META.map((col) => ({
  id: col.id,
  label: col.label,
  defaultVisible: DEFAULT_COLUMNS[col.id as ColumnId] ?? true,
  defaultSortable: false,
  required: REQUIRED_COLUMNS.includes(col.id as ColumnId),
}))

interface CrawlerSiteTableProps {
  displaySites: CrawlerSite[]
  selected: Set<string>
  allVisibleSelected: boolean
  sortBy: SortField
  sortDir: SortDir
  filters: FilterState
  validateStates: Record<string, ValidateStatus>
  rowSaving: Record<string, boolean>
  runningBySite: Record<string, boolean>
  setFilters: Dispatch<SetStateAction<FilterState>>
  setSort: (field: SortField, dir: SortDir) => void
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
    displaySites, selected, allVisibleSelected, sortBy, sortDir, filters,
    validateStates, rowSaving, runningBySite, setFilters, setSort,
    toggleSelect, toggleAll, handleInlineUpdate, handleToggleDisabled,
    handleValidate, handleTriggerCrawl, handleDelete, setEditTarget, showToast,
  } = props

  const [weightPresets, setWeightPresets] = useState<WeightPreset>({ high: 80, medium: 50, low: 20 })

  const tableSettings = useTableSettings({
    tableId: 'crawler-site-table',
    columns: CRAWLER_SITE_SETTINGS_COLUMNS,
  })

  // Adapter: ColumnFilterPanel expects (patch: Partial<FilterState>) => void
  const handlePatchFilters = useMemo(
    () => (patch: Partial<FilterState>) => setFilters((prev) => ({ ...prev, ...patch })),
    [setFilters],
  )

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

  // Wire ModernDataTable sort → domain setSort
  function handleSortChange(s: TableSortState) {
    setSort(s.field as SortField, s.direction as SortDir)
  }

  const allTableColumns = useCrawlerSiteTableColumns({
    displaySites, selected, allVisibleSelected, filters,
    weightPresets, onPatchWeightPreset: handlePatchWeightPreset,
    setFilters: handlePatchFilters,
    clearColumnFilter,
    toggleSelect, toggleAll,
    deps: {
      rowSaving, runningBySite, validateStates, weightPresets,
      handleInlineUpdate, handleToggleDisabled, handleValidate,
      handleTriggerCrawl, handleDelete, setEditTarget, showToast,
    },
  })

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  function handleColumnWidthChange(columnId: string, nextWidth: number) {
    if (columnId !== 'selection') tableSettings.updateWidth(columnId, nextWidth)
  }

  return (
    <div
      data-testid="crawler-sites-scroll-container"
      className="h-[60vh] min-h-[420px] max-h-[720px] overflow-y-auto"
    >
      <ModernDataTable
        columns={tableColumns}
        rows={displaySites}
        sort={{ field: sortBy, direction: sortDir }}
        onSortChange={handleSortChange}
        emptyText="没有符合当前筛选条件的源站"
        getRowId={(row) => row.key}
        onColumnWidthChange={handleColumnWidthChange}
        scrollTestId="crawler-site-table-scroll"
        settingsSlot={{
          settingsColumns: tableSettings.orderedSettings,
          onSettingsChange: tableSettings.updateSetting,
          onSettingsReset: tableSettings.reset,
        }}
      />
    </div>
  )
}
