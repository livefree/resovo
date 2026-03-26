import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CrawlerSite, UpdateCrawlerSiteInput } from '@/types'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { TableBadgeCell } from '@/components/admin/shared/modern-table/cells/TableBadgeCell'
import { TableCheckboxCell } from '@/components/admin/shared/modern-table/cells/TableCheckboxCell'
import { TableDateCell } from '@/components/admin/shared/modern-table/cells/TableDateCell'
import { TableSwitchCell } from '@/components/admin/shared/modern-table/cells/TableSwitchCell'
import { TableTextCell } from '@/components/admin/shared/modern-table/cells/TableTextCell'
import { TableUrlCell } from '@/components/admin/shared/modern-table/cells/TableUrlCell'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type {
  ColumnId,
  ColumnWidthState,
  FilterState,
  SortDir,
  SortField,
} from '@/components/admin/system/crawler-site/tableState'
import { DEFAULT_FILTERS } from '@/components/admin/system/crawler-site/tableState'
import { ColumnMenu } from '@/components/admin/system/crawler-site/components/ColumnMenu'

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

interface WeightPreset {
  high: number
  medium: number
  low: number
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

function normalizeWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getWeightLevelLabel(weight: number, preset: WeightPreset): string {
  if (weight >= preset.high) return '高'
  if (weight >= preset.medium) return '中'
  return '低'
}

function nextWeight(weight: number, preset: WeightPreset): number {
  const level = getWeightLevelLabel(weight, preset)
  if (level === '高') return preset.medium
  if (level === '中') return preset.low
  return preset.high
}

function formatTypeLabel(site: CrawlerSite): string {
  const type = site.sourceType === 'shortdrama' ? '短剧' : '长片'
  const format = site.format.toUpperCase()
  return `${type} · ${format}`
}

function buildVisibilityColumns(columns: Record<ColumnId, boolean>): Set<ColumnId> {
  return new Set(
    HEADER_COLUMNS
      .map((column) => column.id)
      .filter((columnId) => columns[columnId]),
  )
}

interface HeaderCellProps {
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

function HeaderCell({
  column,
  sortBy,
  sortDir,
  filters,
  setSort,
  toggleColumn,
  showColumnsPanel,
  setShowColumnsPanel,
  columns,
  columnMeta,
  requiredColumns,
  isLastColumn,
  openMenuColumn,
  setOpenMenuColumn,
  onPatchFilter,
  onClearColumnFilter,
  weightPresets,
  onPatchWeightPreset,
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
      >
        ⋮
      </button>

      {isLastColumn ? (
        <div className="ml-auto relative">
          <button
            type="button"
            onClick={() => setShowColumnsPanel((prev) => !prev)}
            className="rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            data-testid="crawler-columns-toggle"
            aria-label="列设置"
            title="列设置"
          >
            列设置
          </button>
          {showColumnsPanel ? (
            <div className="absolute right-0 mt-2 w-56 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-2 shadow-lg">
              <p className="mb-2 text-xs text-[var(--muted)]">勾选显示列（名称/管理操作为必显）</p>
              <div className="space-y-1">
                {columnMeta.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]">
                    <input
                      type="checkbox"
                      checked={columns[item.id]}
                      disabled={requiredColumns.includes(item.id)}
                      onChange={() => toggleColumn(item.id)}
                      className="accent-[var(--accent)]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
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
          onSortAsc={() => {
            if (column.sortField) setSort(column.sortField, 'asc')
            setOpenMenuColumn(null)
          }}
          onSortDesc={() => {
            if (column.sortField) setSort(column.sortField, 'desc')
            setOpenMenuColumn(null)
          }}
          onClearFilter={() => onClearColumnFilter(column.id)}
          onHideColumn={() => {
            toggleColumn(column.id)
            setOpenMenuColumn(null)
          }}
          onPatchFilter={onPatchFilter}
          weightPresets={weightPresets}
          onPatchWeightPreset={onPatchWeightPreset}
        />
      ) : null}
    </div>
  )
}

export function CrawlerSiteTable({
  displaySites,
  selected,
  allVisibleSelected,
  sortBy,
  sortDir,
  filters,
  columnWidths,
  validateStates,
  rowSaving,
  runningBySite,
  setFilters,
  setSort,
  toggleColumn,
  showColumnsPanel,
  setShowColumnsPanel,
  columns,
  columnMeta,
  requiredColumns,
  setColumnWidth,
  toggleSelect,
  toggleAll,
  handleInlineUpdate,
  handleToggleDisabled,
  handleValidate,
  handleTriggerCrawl,
  handleDelete,
  setEditTarget,
  showToast,
}: CrawlerSiteTableProps) {
  const [openMenuColumn, setOpenMenuColumn] = useState<ColumnId | null>(null)
  const [weightPresets, setWeightPresets] = useState<WeightPreset>({ high: 80, medium: 50, low: 20 })
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(event.target as Node)) return
      setOpenMenuColumn(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [])

  const visibleColumns = useMemo(() => buildVisibilityColumns(columns), [columns])

  const clearColumnFilter = useMemo(
    () => (columnId: ColumnId) => {
      switch (columnId) {
        case 'name':
          setFilters((prev) => ({ ...prev, keyOrName: DEFAULT_FILTERS.keyOrName }))
          break
        case 'key':
          setFilters((prev) => ({ ...prev, apiUrl: DEFAULT_FILTERS.apiUrl }))
          break
        case 'typeFormat':
          setFilters((prev) => ({ ...prev, sourceType: DEFAULT_FILTERS.sourceType, format: DEFAULT_FILTERS.format }))
          break
        case 'weight':
          setFilters((prev) => ({ ...prev, weightMin: DEFAULT_FILTERS.weightMin, weightMax: DEFAULT_FILTERS.weightMax }))
          break
        case 'isAdult':
          setFilters((prev) => ({ ...prev, isAdult: DEFAULT_FILTERS.isAdult }))
          break
        case 'fromConfig':
          setFilters((prev) => ({ ...prev, fromConfig: DEFAULT_FILTERS.fromConfig }))
          break
        case 'enabled':
          setFilters((prev) => ({ ...prev, disabled: DEFAULT_FILTERS.disabled }))
          break
        default:
          break
      }
    },
    [setFilters],
  )

  function updateWeightPreset(level: keyof WeightPreset, input: string) {
    const next = normalizeWeight(Number(input))
    setWeightPresets((prev) => {
      const draft = { ...prev, [level]: next }
      if (draft.high < draft.medium) draft.high = draft.medium
      if (draft.medium < draft.low) draft.medium = draft.low
      return draft
    })
  }

  const tableColumns = useMemo<Array<TableColumn<CrawlerSite>>>(() => {
    const result: Array<TableColumn<CrawlerSite>> = [
      {
        id: 'selection',
        header: (
          <TableCheckboxCell
            checked={allVisibleSelected}
            ariaLabel="全选当前页"
            onChange={() => toggleAll()}
          />
        ),
        accessor: (site) => site.key,
        width: 44,
        minWidth: 44,
        enableResizing: false,
        cell: ({ row }) => (
          <TableCheckboxCell
            checked={selected.has(row.key)}
            ariaLabel={`选择 ${row.name}`}
            onChange={() => toggleSelect(row.key)}
          />
        ),
      },
    ]

    for (const [index, column] of HEADER_COLUMNS.entries()) {
      if (!visibleColumns.has(column.id)) continue

      const width = columnWidths[column.id]
      const isLastVisible = HEADER_COLUMNS.slice(index + 1).every((candidate) => !visibleColumns.has(candidate.id))

      const header = (
        <HeaderCell
          column={column}
          sortBy={sortBy}
          sortDir={sortDir}
          filters={filters}
          setSort={setSort}
          toggleColumn={toggleColumn}
          showColumnsPanel={showColumnsPanel}
          setShowColumnsPanel={setShowColumnsPanel}
          columns={columns}
          columnMeta={columnMeta}
          requiredColumns={requiredColumns}
          isLastColumn={isLastVisible}
          openMenuColumn={openMenuColumn}
          setOpenMenuColumn={setOpenMenuColumn}
          onPatchFilter={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClearColumnFilter={clearColumnFilter}
          weightPresets={weightPresets}
          onPatchWeightPreset={updateWeightPreset}
        />
      )

      const baseColumn: TableColumn<CrawlerSite> = {
        id: column.id,
        header,
        accessor: (site) => site.key,
        width,
        minWidth: 72,
        enableSorting: false,
      }

      switch (column.id) {
        case 'name':
          baseColumn.cell = ({ row }) => <TableTextCell value={row.name} />
          break
        case 'key':
          baseColumn.cell = ({ row }) => (
            <div className="flex items-center gap-2">
              <TableTextCell value={row.key} title={row.apiUrl} className="max-w-[120px] font-mono text-xs text-[var(--muted)]" />
              <TableUrlCell url={row.apiUrl} maxLength={22} onCopied={() => showToast('已复制 API 地址', true)} />
            </div>
          )
          break
        case 'typeFormat':
          baseColumn.cell = ({ row }) => (
            <TableBadgeCell label={formatTypeLabel(row)} tone="info" />
          )
          break
        case 'weight':
          baseColumn.cell = ({ row }) => {
            const rowBusy = rowSaving[row.key] === true
            return (
              <button
                type="button"
                disabled={rowBusy}
                onClick={() => {
                  const value = nextWeight(row.weight, weightPresets)
                  void handleInlineUpdate(row, { weight: value })
                }}
                className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
              >
                {getWeightLevelLabel(row.weight, weightPresets)}
              </button>
            )
          }
          break
        case 'isAdult':
          baseColumn.cell = ({ row }) => {
            const rowBusy = rowSaving[row.key] === true
            return (
              <button
                type="button"
                disabled={rowBusy}
                onClick={() => { void handleInlineUpdate(row, { isAdult: !row.isAdult }) }}
                className={`text-base ${row.isAdult ? 'text-red-400' : 'text-[var(--muted)]'} disabled:opacity-50`}
                title={row.isAdult ? '成人源' : '非成人源'}
              >
                🔞
              </button>
            )
          }
          break
        case 'fromConfig':
          baseColumn.cell = ({ row }) => (
            <TableBadgeCell label={row.fromConfig ? '配置文件' : '手动维护'} tone="neutral" />
          )
          break
        case 'enabled':
          baseColumn.cell = ({ row }) => {
            const rowBusy = rowSaving[row.key] === true
            return (
              <TableSwitchCell
                value={!row.disabled}
                disabled={rowBusy}
                onToggle={() => handleToggleDisabled(row)}
              />
            )
          }
          break
        case 'lastCrawl':
          baseColumn.cell = ({ row }) => (
            <TableDateCell
              value={row.lastCrawledAt}
              fallback="未采集"
              className="text-xs"
            />
          )
          break
        case 'crawlOps':
          baseColumn.cell = ({ row }) => {
            const siteRunning = runningBySite[row.key] === true
            return (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { void handleTriggerCrawl('incremental-crawl', row) }}
                  disabled={siteRunning}
                  className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
                >
                  增量
                </button>
                <button
                  type="button"
                  onClick={() => { void handleTriggerCrawl('full-crawl', row) }}
                  disabled={siteRunning}
                  className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                >
                  全量
                </button>
              </div>
            )
          }
          break
        case 'manageOps':
          baseColumn.cell = ({ row }) => (
            <details className="group relative">
              <summary className="cursor-pointer list-none rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]">
                操作
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-24 rounded border border-[var(--border)] bg-[var(--bg2)] p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => { void handleValidate(row) }}
                  disabled={validateStates[row.key] === 'checking'}
                  className="block w-full rounded px-2 py-1 text-left text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                >
                  检测
                </button>
                <button
                  type="button"
                  onClick={() => setEditTarget(row)}
                  className="mt-0.5 block w-full rounded px-2 py-1 text-left text-xs text-[var(--text)] hover:bg-[var(--bg3)]"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => { void handleDelete(row) }}
                  disabled={row.fromConfig}
                  className="mt-0.5 block w-full rounded px-2 py-1 text-left text-xs text-red-400 hover:bg-red-500/10 disabled:text-[var(--muted)] disabled:hover:bg-transparent"
                >
                  删除
                </button>
              </div>
            </details>
          )
          break
      }

      result.push(baseColumn)
    }

    return result
  }, [
    allVisibleSelected,
    clearColumnFilter,
    columnMeta,
    columnWidths,
    columns,
    filters,
    handleDelete,
    handleInlineUpdate,
    handleToggleDisabled,
    handleTriggerCrawl,
    handleValidate,
    openMenuColumn,
    requiredColumns,
    rowSaving,
    runningBySite,
    selected,
    setEditTarget,
    setFilters,
    setShowColumnsPanel,
    setSort,
    showColumnsPanel,
    showToast,
    sortBy,
    sortDir,
    toggleAll,
    toggleColumn,
    toggleSelect,
    validateStates,
    visibleColumns,
    weightPresets,
  ])

  function handleColumnWidthChange(columnId: string, nextWidth: number) {
    if (columnId === 'selection') return
    setColumnWidth(columnId as ColumnId, nextWidth)
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
