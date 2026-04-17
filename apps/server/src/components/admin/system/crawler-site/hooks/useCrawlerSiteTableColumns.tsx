/**
 * useCrawlerSiteTableColumns.tsx — 列定义 Hook（CHG-228 拆分）
 * CHG-327: 迁移至共享 ColumnHeaderMenu；删除 HeaderCell 依赖
 */
/* eslint-disable react/display-name */ // cell callbacks are render functions, not React components

import { useMemo } from 'react'
import type { CrawlerSite, UpdateCrawlerSiteInput } from '@/types'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { AdminDropdown } from '@/components/admin/shared/dropdown/AdminDropdown'
import { TableBadgeCell } from '@/components/admin/shared/modern-table/cells/TableBadgeCell'
import { TableCheckboxCell } from '@/components/admin/shared/modern-table/cells/TableCheckboxCell'
import { TableDateCell } from '@/components/admin/shared/modern-table/cells/TableDateCell'
import { TableSwitchCell } from '@/components/admin/shared/modern-table/cells/TableSwitchCell'
import { TableTextCell } from '@/components/admin/shared/modern-table/cells/TableTextCell'
import { TableUrlCell } from '@/components/admin/shared/modern-table/cells/TableUrlCell'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import { ColumnFilterPanel } from '@/components/admin/system/crawler-site/components/ColumnFilterPanel'
import type { ColumnId, FilterState, WeightPreset } from '../tableState'
import { DEFAULT_COLUMN_WIDTH, isColumnFiltered } from '../tableState'

type ValidateStatus = 'idle' | 'checking' | 'ok' | 'error' | 'timeout'

interface SiteColumnDeps {
  rowSaving: Record<string, boolean>
  runningBySite: Record<string, boolean>
  validateStates: Record<string, ValidateStatus>
  weightPresets: WeightPreset
  handleInlineUpdate: (site: CrawlerSite, patch: UpdateCrawlerSiteInput) => Promise<void>
  handleToggleDisabled: (site: CrawlerSite) => Promise<void>
  handleValidate: (site: CrawlerSite) => Promise<void>
  handleTriggerCrawl: (type: 'full-crawl' | 'incremental-crawl', site?: CrawlerSite) => Promise<void>
  handleDelete: (site: CrawlerSite) => Promise<void>
  setEditTarget: (site: CrawlerSite) => void
}

/** 可排序的列 id（同时也是有效的 SortField 值）*/
const SORTABLE_COLUMNS = new Set<ColumnId>([
  'name', 'key', 'typeFormat', 'weight', 'isAdult', 'enabled', 'fromConfig',
])

/** 可筛选的列 */
const FILTERABLE_COLUMNS = new Set<ColumnId>([
  'name', 'key', 'typeFormat', 'weight', 'isAdult', 'fromConfig', 'enabled',
])

/** 列标签映射 */
const COLUMN_LABELS: Record<ColumnId, string> = {
  name: '名称',
  key: 'Key',
  typeFormat: '类型 · 格式',
  weight: '权重',
  isAdult: '成人',
  fromConfig: '来源',
  enabled: '启用状态',
  lastCrawl: '最近采集',
  crawlOps: '采集操作',
  manageOps: '操作',
}

function normalizeWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function getWeightLevelLabel(weight: number, preset: WeightPreset): string {
  if (weight >= preset.high) return '高'
  if (weight >= preset.medium) return '中'
  return '低'
}

export function nextWeight(weight: number, preset: WeightPreset): number {
  const level = getWeightLevelLabel(weight, preset)
  if (level === '高') return preset.medium
  if (level === '中') return preset.low
  return preset.high
}

export function normalizeWeightPreset(level: keyof WeightPreset, input: string, prev: WeightPreset): WeightPreset {
  const next = normalizeWeight(Number(input))
  const draft = { ...prev, [level]: next }
  if (draft.high < draft.medium) draft.high = draft.medium
  if (draft.medium < draft.low) draft.medium = draft.low
  return draft
}

function formatTypeLabel(site: CrawlerSite): string {
  const type = site.sourceType === 'shortdrama' ? '短剧' : '长片'
  return `${type} · ${site.format.toUpperCase()}`
}

function buildSiteCellRenderer(columnId: ColumnId, deps: SiteColumnDeps) {
  switch (columnId) {
    case 'name': return ({ row }: { row: CrawlerSite }) => <TableTextCell value={row.name} />
    case 'key': return ({ row }: { row: CrawlerSite }) => (
      <div className="flex items-center gap-2">
        <TableTextCell value={row.key} title={row.apiUrl} className="max-w-[120px] font-mono text-xs text-[var(--muted)]" />
        <TableUrlCell url={row.apiUrl} maxLength={22} onCopied={() => notify.success('已复制 API 地址')} />
      </div>
    )
    case 'typeFormat': return ({ row }: { row: CrawlerSite }) => <TableBadgeCell label={formatTypeLabel(row)} tone="info" />
    case 'weight': return ({ row }: { row: CrawlerSite }) => {
      const busy = deps.rowSaving[row.key] === true
      return (
        <button type="button" disabled={busy}
          onClick={() => { void deps.handleInlineUpdate(row, { weight: nextWeight(row.weight, deps.weightPresets) }) }}
          className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
        >{getWeightLevelLabel(row.weight, deps.weightPresets)}</button>
      )
    }
    case 'isAdult': return ({ row }: { row: CrawlerSite }) => {
      const busy = deps.rowSaving[row.key] === true
      return (
        <button type="button" disabled={busy} title={row.isAdult ? '成人源' : '非成人源'}
          onClick={() => { void deps.handleInlineUpdate(row, { isAdult: !row.isAdult }) }}
          className={`text-base ${row.isAdult ? 'text-red-400' : 'text-[var(--muted)]'} disabled:opacity-50`}
        >🔞</button>
      )
    }
    case 'fromConfig': return ({ row }: { row: CrawlerSite }) => (
      <TableBadgeCell label={row.fromConfig ? '配置文件' : '手动维护'} tone="neutral" />
    )
    case 'enabled': return ({ row }: { row: CrawlerSite }) => (
      <TableSwitchCell value={!row.disabled} disabled={deps.rowSaving[row.key] === true} onToggle={() => deps.handleToggleDisabled(row)} />
    )
    case 'lastCrawl': return ({ row }: { row: CrawlerSite }) => (
      <TableDateCell value={row.lastCrawledAt} fallback="未采集" className="text-xs" />
    )
    case 'crawlOps': return ({ row }: { row: CrawlerSite }) => {
      const running = deps.runningBySite[row.key] === true
      return (
        <div className="flex gap-1.5">
          <button type="button" disabled={running}
            onClick={() => { void deps.handleTriggerCrawl('incremental-crawl', row) }}
            className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
          >增量</button>
          <button type="button" disabled={running}
            onClick={() => { void deps.handleTriggerCrawl('full-crawl', row) }}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
          >全量</button>
        </div>
      )
    }
    case 'manageOps': return ({ row }: { row: CrawlerSite }) => (
      <AdminDropdown
        align="right"
        data-testid={`crawler-site-ops-${row.key}`}
        trigger={
          <button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]">
            操作
          </button>
        }
        items={[
          {
            key: 'validate',
            label: '检测',
            disabled: deps.validateStates[row.key] === 'checking',
            onClick: () => { void deps.handleValidate(row) },
          },
          {
            key: 'edit',
            label: '编辑',
            onClick: () => deps.setEditTarget(row),
          },
          {
            key: 'delete',
            label: '删除',
            danger: true,
            disabled: row.fromConfig,
            onClick: () => { void deps.handleDelete(row) },
          },
        ]}
      />
    )
    default: return undefined
  }
}

// ── column list (mirrors HEADER_COLUMNS order) ────────────────────

const DATA_COLUMNS: Array<{ id: ColumnId; label: string }> = [
  { id: 'name', label: COLUMN_LABELS.name },
  { id: 'key', label: COLUMN_LABELS.key },
  { id: 'typeFormat', label: COLUMN_LABELS.typeFormat },
  { id: 'weight', label: COLUMN_LABELS.weight },
  { id: 'isAdult', label: COLUMN_LABELS.isAdult },
  { id: 'fromConfig', label: COLUMN_LABELS.fromConfig },
  { id: 'enabled', label: COLUMN_LABELS.enabled },
  { id: 'lastCrawl', label: COLUMN_LABELS.lastCrawl },
  { id: 'crawlOps', label: COLUMN_LABELS.crawlOps },
  { id: 'manageOps', label: COLUMN_LABELS.manageOps },
]

// ── hook params ───────────────────────────────────────────────────

interface UseCrawlerSiteTableColumnsParams {
  displaySites: CrawlerSite[]
  selected: Set<string>
  allVisibleSelected: boolean
  filters: FilterState
  weightPresets: WeightPreset
  onPatchWeightPreset: (level: 'high' | 'medium' | 'low', value: string) => void
  setFilters: (patch: Partial<FilterState>) => void
  clearColumnFilter: (columnId: ColumnId) => void
  toggleSelect: (key: string) => void
  toggleAll: () => void
  deps: SiteColumnDeps
}

export function useCrawlerSiteTableColumns(p: UseCrawlerSiteTableColumnsParams): TableColumn<CrawlerSite>[] {
  return useMemo<TableColumn<CrawlerSite>[]>(() => {
    const result: TableColumn<CrawlerSite>[] = [{
      id: 'selection',
      header: <TableCheckboxCell checked={p.allVisibleSelected} ariaLabel="全选当前页" onChange={() => p.toggleAll()} />,
      accessor: (site) => site.key,
      width: 44, minWidth: 44, enableResizing: false,
      cell: ({ row }) => <TableCheckboxCell checked={p.selected.has(row.key)} ariaLabel={`选择 ${row.name}`} onChange={() => p.toggleSelect(row.key)} />,
    }]

    for (const column of DATA_COLUMNS) {
      const canSort = SORTABLE_COLUMNS.has(column.id)
      const canFilter = FILTERABLE_COLUMNS.has(column.id)
      const isFiltered = canFilter ? isColumnFiltered(column.id, p.filters) : false

      const filterContent = canFilter ? (
        <ColumnFilterPanel
          columnId={column.id}
          filters={p.filters}
          onPatch={p.setFilters}
          weightPresets={p.deps.weightPresets}
          onPatchWeightPreset={p.onPatchWeightPreset}
        />
      ) : undefined

      const onClearFilter = canFilter
        ? () => p.clearColumnFilter(column.id)
        : undefined

      result.push({
        id: column.id,
        header: column.label,
        accessor: (site) => site.key,
        width: DEFAULT_COLUMN_WIDTH[column.id as ColumnId],
        minWidth: 72,
        enableSorting: canSort,
        cell: buildSiteCellRenderer(column.id, p.deps),
        columnMenu: {
          canSort,
          canHide: true,
          isFiltered,
          filterContent,
          onClearFilter,
        },
      })
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    p.allVisibleSelected, p.selected, p.toggleAll, p.toggleSelect,
    p.filters, p.deps, p.clearColumnFilter, p.setFilters, p.onPatchWeightPreset,
  ])
}
