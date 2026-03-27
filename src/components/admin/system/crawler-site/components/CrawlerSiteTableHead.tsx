/**
 * CrawlerSiteTableHead.tsx — 表头单元格组件（CHG-228 拆分）
 */

import type { Dispatch, SetStateAction } from 'react'
import type { FilterState, ColumnId, SortDir, SortField } from '@/components/admin/system/crawler-site/tableState'
import { DEFAULT_COLUMNS, DEFAULT_FILTERS } from '@/components/admin/system/crawler-site/tableState'
import { ColumnMenu } from '@/components/admin/system/crawler-site/components/ColumnMenu'
import { ColumnSettingsPanel } from '@/components/admin/shared/table/ColumnSettingsPanel'

export interface WeightPreset {
  high: number
  medium: number
  low: number
}

export const HEADER_COLUMNS: Array<{ id: ColumnId; label: string; sortField?: SortField; canFilter?: boolean }> = [
  { id: 'name', label: '名称', sortField: 'name', canFilter: true },
  { id: 'key', label: 'Key', sortField: 'key', canFilter: true },
  { id: 'typeFormat', label: '类型 · 格式', sortField: 'typeFormat', canFilter: true },
  { id: 'weight', label: '权重', sortField: 'weight', canFilter: true },
  { id: 'isAdult', label: '成人', sortField: 'isAdult', canFilter: true },
  { id: 'fromConfig', label: '来源', sortField: 'fromConfig', canFilter: true },
  { id: 'enabled', label: '启用状态', sortField: 'enabled', canFilter: true },
  { id: 'lastCrawl', label: '最近采集' },
  { id: 'crawlOps', label: '采集操作' },
  { id: 'manageOps', label: '操作' },
]

export function isColumnFiltered(columnId: ColumnId, filters: FilterState): boolean {
  switch (columnId) {
    case 'name': return filters.keyOrName.trim() !== ''
    case 'key': return filters.apiUrl.trim() !== ''
    case 'typeFormat': return filters.sourceType !== 'all' || filters.format !== 'all'
    case 'weight': return filters.weightMin.trim() !== '' || filters.weightMax.trim() !== ''
    case 'isAdult': return filters.isAdult !== 'all'
    case 'fromConfig': return filters.fromConfig !== 'all'
    case 'enabled': return filters.disabled !== 'all'
    default: return false
  }
}

export function buildClearColumnFilter(
  columnId: ColumnId,
  setFilters: Dispatch<SetStateAction<FilterState>>
): void {
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
}

export interface HeaderCellProps {
  column: typeof HEADER_COLUMNS[number]
  sortBy: SortField
  sortDir: SortDir
  filters: FilterState
  setSort: (field: SortField, dir: SortDir) => void
  toggleColumn: (columnId: ColumnId) => void
  showColumnsPanel: boolean
  setShowColumnsPanel: Dispatch<SetStateAction<boolean>>
  columns: Record<ColumnId, boolean>
  columnMeta: Array<{ id: ColumnId; label: string }>
  requiredColumns: ColumnId[]
  isLastColumn: boolean
  openMenuColumn: ColumnId | null
  setOpenMenuColumn: (columnId: ColumnId | null) => void
  onPatchFilter: (patch: Partial<FilterState>) => void
  onClearColumnFilter: (columnId: ColumnId) => void
  weightPresets: WeightPreset
  onPatchWeightPreset: (level: 'high' | 'medium' | 'low', value: string) => void
}

export function HeaderCell({
  column, sortBy, sortDir, filters, setSort, toggleColumn,
  showColumnsPanel, setShowColumnsPanel, columns, columnMeta, requiredColumns,
  isLastColumn, openMenuColumn, setOpenMenuColumn,
  onPatchFilter, onClearColumnFilter, weightPresets, onPatchWeightPreset,
}: HeaderCellProps) {
  const isSorted = column.sortField != null && sortBy === column.sortField
  const filtered = isColumnFiltered(column.id, filters)
  const canHide = !requiredColumns.includes(column.id)

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={column.sortField == null}
        data-testid={`modern-table-sort-${column.id}`}
        onClick={() => {
          if (!column.sortField) return
          setSort(column.sortField, isSorted && sortDir === 'asc' ? 'desc' : 'asc')
        }}
        className={`inline-flex items-center gap-1 text-xs ${column.sortField ? 'cursor-pointer hover:text-[var(--text)]' : 'cursor-default'}`}
      >
        <span>{column.label}</span>
        {isSorted ? <span>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
        {filtered ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}
      </button>
      <button
        type="button"
        onClick={() => setOpenMenuColumn(openMenuColumn === column.id ? null : column.id)}
        className="rounded px-1 text-xs text-[var(--muted)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
        aria-label={`${column.label} 菜单`}
      >⋮</button>

      {isLastColumn ? (
        <div className="ml-auto relative">
          <button
            type="button"
            onClick={() => setShowColumnsPanel((prev) => !prev)}
            className="rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            data-testid="crawler-columns-toggle"
            aria-label="列设置"
            title="列设置"
          >列设置</button>
          {showColumnsPanel ? (
            <div className="absolute right-0 mt-2 w-56">
              <ColumnSettingsPanel
                data-testid="crawler-columns-panel"
                columns={columnMeta.map((item) => ({
                  id: item.id,
                  label: item.label,
                  visible: columns[item.id],
                  required: requiredColumns.includes(item.id),
                }))}
                onToggle={(id) => toggleColumn(id as ColumnId)}
                onReset={() => {
                  for (const item of columnMeta) {
                    if (!requiredColumns.includes(item.id) && columns[item.id] !== DEFAULT_COLUMNS[item.id]) {
                      toggleColumn(item.id)
                    }
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {openMenuColumn === column.id ? (
        <ColumnMenu
          columnId={column.id}
          filters={filters}
          canSort={column.sortField != null}
          canFilter={column.canFilter === true}
          canHide={canHide}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortAsc={() => { if (column.sortField) setSort(column.sortField, 'asc'); setOpenMenuColumn(null) }}
          onSortDesc={() => { if (column.sortField) setSort(column.sortField, 'desc'); setOpenMenuColumn(null) }}
          onClearFilter={() => onClearColumnFilter(column.id)}
          onHideColumn={() => { toggleColumn(column.id); setOpenMenuColumn(null) }}
          onPatchFilter={onPatchFilter}
          weightPresets={weightPresets}
          onPatchWeightPreset={onPatchWeightPreset}
        />
      ) : null}
    </div>
  )
}
