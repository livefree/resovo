import type { Dispatch, SetStateAction } from 'react'
import type { ColumnId, ColumnWidthState, FilterState, SortDir, SortField } from '@/components/admin/system/crawler-site/tableState'
import { ColumnMenu } from '@/components/admin/system/crawler-site/components/ColumnMenu'

interface CrawlerSiteTableLiteHeaderProps {
  sortBy: SortField
  sortDir: SortDir
  filters: FilterState
  columnWidths: ColumnWidthState
  colClass: (id: ColumnId) => string
  allVisibleSelected: boolean
  toggleAll: () => void
  startResize: (columnId: ColumnId, clientX: number) => void
  onSort: (field: SortField) => void
  onSetSort: (field: SortField, dir: SortDir) => void
  onPatchFilter: (patch: Partial<FilterState>) => void
  onClearColumnFilter: (columnId: ColumnId) => void
  onToggleColumn: (columnId: ColumnId) => void
  showColumnsPanel: boolean
  setShowColumnsPanel: Dispatch<SetStateAction<boolean>>
  columns: Record<ColumnId, boolean>
  columnMeta: Array<{ id: ColumnId; label: string }>
  requiredColumns: ColumnId[]
  openMenuColumn: ColumnId | null
  setOpenMenuColumn: (columnId: ColumnId | null) => void
  weightPresets: { high: number; medium: number; low: number }
  onPatchWeightPreset: (level: 'high' | 'medium' | 'low', value: string) => void
}

const HEADER_COLUMNS: Array<{ id: ColumnId; label: string; sortField?: SortField; canFilter?: boolean }> = [
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

function isColumnFiltered(columnId: ColumnId, filters: FilterState) {
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

export function CrawlerSiteTableLiteHeader({
  sortBy,
  sortDir,
  filters,
  columnWidths,
  colClass,
  allVisibleSelected,
  toggleAll,
  startResize,
  onSort,
  onSetSort,
  onPatchFilter,
  onClearColumnFilter,
  onToggleColumn,
  showColumnsPanel,
  setShowColumnsPanel,
  columns,
  columnMeta,
  requiredColumns,
  openMenuColumn,
  setOpenMenuColumn,
  weightPresets,
  onPatchWeightPreset,
}: CrawlerSiteTableLiteHeaderProps) {
  return (
    <tr className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg2)]">
      <th className="w-8 px-3 py-2.5 text-left">
        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="accent-[var(--accent)]" />
      </th>
      {HEADER_COLUMNS.map((column, index) => {
        const isSorted = column.sortField != null && sortBy === column.sortField
        const sortable = column.sortField != null
        const filtered = isColumnFiltered(column.id, filters)
        const canHide = !requiredColumns.includes(column.id)
        const isLastColumn = index === HEADER_COLUMNS.length - 1

        return (
          <th
            key={column.id}
            className={`${colClass(column.id)} relative px-3 py-2.5 text-left font-medium text-[var(--muted)]`}
            style={{ width: columnWidths[column.id], minWidth: columnWidths[column.id] }}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!sortable}
                onClick={() => {
                  if (column.sortField) onSort(column.sortField)
                }}
                className={`inline-flex items-center gap-1 text-xs ${sortable ? 'cursor-pointer hover:text-[var(--text)]' : 'cursor-default'}`}
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
              >
                ⋮
              </button>
            </div>

            {isLastColumn && (
              <div className="absolute right-3 top-1/2 z-30 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() => setShowColumnsPanel((prev) => !prev)}
                  className="rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                  data-testid="crawler-columns-toggle"
                  aria-label="列设置"
                  title="列设置"
                >
                  <span aria-hidden>⚙</span>
                  <span className="sr-only">列设置</span>
                </button>
                {showColumnsPanel && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-2 shadow-lg">
                    <p className="mb-2 text-xs text-[var(--muted)]">勾选显示列（名称/管理操作为必显）</p>
                    <div className="space-y-1">
                      {columnMeta.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]">
                          <input
                            type="checkbox"
                            checked={columns[item.id]}
                            disabled={requiredColumns.includes(item.id)}
                            onChange={() => onToggleColumn(item.id)}
                            className="accent-[var(--accent)]"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {openMenuColumn === column.id && (
              <ColumnMenu
                columnId={column.id}
                filters={filters}
                canSort={sortable}
                canFilter={column.canFilter === true}
                canHide={canHide}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortAsc={() => {
                  if (column.sortField) onSetSort(column.sortField, 'asc')
                  setOpenMenuColumn(null)
                }}
                onSortDesc={() => {
                  if (column.sortField) onSetSort(column.sortField, 'desc')
                  setOpenMenuColumn(null)
                }}
                onClearFilter={() => onClearColumnFilter(column.id)}
                onHideColumn={() => {
                  onToggleColumn(column.id)
                  setOpenMenuColumn(null)
                }}
                onPatchFilter={onPatchFilter}
                weightPresets={weightPresets}
                onPatchWeightPreset={onPatchWeightPreset}
              />
            )}

            <span
              data-testid={`resize-handle-${column.id}`}
              onMouseDown={(event) => {
                event.stopPropagation()
                startResize(column.id, event.clientX)
              }}
              className="absolute right-0 top-0 h-full w-2 cursor-col-resize before:absolute before:right-0 before:top-0 before:h-full before:w-px before:bg-[var(--border)] hover:bg-[var(--bg3)]/40"
            />
          </th>
        )
      })}
    </tr>
  )
}
