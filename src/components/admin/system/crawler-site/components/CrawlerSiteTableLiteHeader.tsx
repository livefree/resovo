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
  requiredColumns: ColumnId[]
  openMenuColumn: ColumnId | null
  setOpenMenuColumn: (columnId: ColumnId | null) => void
}

const HEADER_COLUMNS: Array<{ id: ColumnId; label: string; sortField?: SortField; canFilter?: boolean }> = [
  { id: 'name', label: '名称 / Key', sortField: 'name', canFilter: true },
  { id: 'apiUrl', label: 'API 地址', sortField: 'apiUrl', canFilter: true },
  { id: 'sourceType', label: '类型', sortField: 'sourceType', canFilter: true },
  { id: 'format', label: '格式', sortField: 'format', canFilter: true },
  { id: 'weight', label: '权重', sortField: 'weight', canFilter: true },
  { id: 'isAdult', label: '成人', sortField: 'isAdult', canFilter: true },
  { id: 'fromConfig', label: '来源', sortField: 'fromConfig', canFilter: true },
  { id: 'disabled', label: '状态', sortField: 'disabled', canFilter: true },
  { id: 'lastCrawl', label: '最近采集' },
  { id: 'crawlOps', label: '采集操作' },
  { id: 'manageOps', label: '管理操作' },
]

function isColumnFiltered(columnId: ColumnId, filters: FilterState) {
  switch (columnId) {
    case 'name': return filters.keyOrName.trim() !== ''
    case 'apiUrl': return filters.apiUrl.trim() !== ''
    case 'sourceType': return filters.sourceType !== 'all'
    case 'format': return filters.format !== 'all'
    case 'weight': return filters.weightMin.trim() !== '' || filters.weightMax.trim() !== ''
    case 'isAdult': return filters.isAdult !== 'all'
    case 'fromConfig': return filters.fromConfig !== 'all'
    case 'disabled': return filters.disabled !== 'all'
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
  requiredColumns,
  openMenuColumn,
  setOpenMenuColumn,
}: CrawlerSiteTableLiteHeaderProps) {
  return (
    <tr className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg2)]">
      <th className="w-8 px-3 py-2.5 text-left">
        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="accent-[var(--accent)]" />
      </th>
      {HEADER_COLUMNS.map((column) => {
        const isSorted = column.sortField != null && sortBy === column.sortField
        const sortable = column.sortField != null
        const filtered = isColumnFiltered(column.id, filters)
        const canHide = !requiredColumns.includes(column.id)

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
              />
            )}

            <span
              data-testid={`resize-handle-${column.id}`}
              onMouseDown={(event) => {
                event.stopPropagation()
                startResize(column.id, event.clientX)
              }}
              className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]"
            />
          </th>
        )
      })}
    </tr>
  )
}
