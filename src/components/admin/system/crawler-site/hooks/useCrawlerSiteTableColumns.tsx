/**
 * useCrawlerSiteTableColumns.tsx — 列定义 Hook（CHG-228 拆分）
 */
/* eslint-disable react/display-name */ // cell callbacks are render functions, not React components

import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import type { CrawlerSite, UpdateCrawlerSiteInput } from '@/types'
import { AdminDropdown } from '@/components/admin/shared/dropdown/AdminDropdown'
import { TableBadgeCell } from '@/components/admin/shared/modern-table/cells/TableBadgeCell'
import { TableCheckboxCell } from '@/components/admin/shared/modern-table/cells/TableCheckboxCell'
import { TableDateCell } from '@/components/admin/shared/modern-table/cells/TableDateCell'
import { TableSwitchCell } from '@/components/admin/shared/modern-table/cells/TableSwitchCell'
import { TableTextCell } from '@/components/admin/shared/modern-table/cells/TableTextCell'
import { TableUrlCell } from '@/components/admin/shared/modern-table/cells/TableUrlCell'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type { ColumnId, FilterState, SortDir, SortField } from '../tableState'
import { DEFAULT_COLUMN_WIDTH } from '../tableState'
import {
  HEADER_COLUMNS,
  HeaderCell,
  type WeightPreset,
} from '../components/CrawlerSiteTableHead'

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
  showToast: (msg: string, ok: boolean) => void
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
        <TableUrlCell url={row.apiUrl} maxLength={22} onCopied={() => deps.showToast('已复制 API 地址', true)} />
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

interface UseCrawlerSiteTableColumnsParams {
  displaySites: CrawlerSite[]
  selected: Set<string>
  allVisibleSelected: boolean
  sortBy: SortField
  sortDir: SortDir
  filters: FilterState
  openMenuColumn: ColumnId | null
  setOpenMenuColumn: Dispatch<SetStateAction<ColumnId | null>>
  weightPresets: WeightPreset
  onPatchWeightPreset: (level: 'high' | 'medium' | 'low', value: string) => void
  setFilters: Dispatch<SetStateAction<FilterState>>
  clearColumnFilter: (columnId: ColumnId) => void
  setSort: (field: SortField, dir: SortDir) => void
  onHideColumn: (columnId: ColumnId) => void
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

    for (const column of HEADER_COLUMNS) {
      const header = (
        <HeaderCell
          column={column} sortBy={p.sortBy} sortDir={p.sortDir} filters={p.filters}
          setSort={p.setSort} onHideColumn={p.onHideColumn}
          openMenuColumn={p.openMenuColumn}
          setOpenMenuColumn={p.setOpenMenuColumn as (id: ColumnId | null) => void}
          onPatchFilter={(patch) => p.setFilters((prev) => ({ ...prev, ...patch }))}
          onClearColumnFilter={p.clearColumnFilter}
          weightPresets={p.deps.weightPresets} onPatchWeightPreset={p.onPatchWeightPreset}
        />
      )
      result.push({
        id: column.id, header, accessor: (site) => site.key,
        width: DEFAULT_COLUMN_WIDTH[column.id as ColumnId], minWidth: 72, enableSorting: false,
        cell: buildSiteCellRenderer(column.id, p.deps),
      })
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.allVisibleSelected, p.selected, p.toggleAll, p.toggleSelect, p.sortBy, p.sortDir, p.filters, p.setSort, p.onHideColumn, p.openMenuColumn, p.setOpenMenuColumn, p.deps, p.clearColumnFilter, p.setFilters, p.onPatchWeightPreset])
}
