import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CrawlerSite, UpdateCrawlerSiteInput } from '@/types'
import type {
  ColumnId,
  ColumnWidthState,
  FilterState,
  SortDir,
  SortField,
} from '@/components/admin/system/crawler-site/tableState'
import { DEFAULT_FILTERS } from '@/components/admin/system/crawler-site/tableState'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { CrawlerSiteTableLiteHeader } from '@/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader'

type ValidateStatus = 'idle' | 'checking' | 'ok' | 'error' | 'timeout'

interface CrawlerSiteTableProps {
  displaySites: CrawlerSite[]
  selected: Set<string>
  allVisibleSelected: boolean
  sortBy: SortField
  sortDir: SortDir
  filters: FilterState
  columnWidths: ColumnWidthState
  visibleColumnCount: number
  visibleTableMinWidth: number
  validateStates: Record<string, ValidateStatus>
  rowSaving: Record<string, boolean>
  runningBySite: Record<string, boolean>
  setFilters: Dispatch<SetStateAction<FilterState>>
  setSort: (field: SortField, dir: SortDir) => void
  toggleColumn: (columnId: ColumnId) => void
  requiredColumns: ColumnId[]
  colClass: (id: ColumnId) => string
  handleSort: (field: SortField) => void
  startResize: (columnId: ColumnId, clientX: number) => void
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

function getRelativeTimeLabel(value: string | null): string {
  if (!value) return '未采集'
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return '未采集'
  const diffMs = Date.now() - ts
  if (diffMs < 60_000) return '刚刚'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function formatAbsoluteTime(value: string | null): string {
  if (!value) return '未采集'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '未采集'
  return date.toLocaleString()
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
  if (weight === preset.high) return preset.medium
  if (weight === preset.medium) return preset.low
  return preset.high
}

function formatTypeLabel(site: CrawlerSite): string {
  const type = site.sourceType === 'shortdrama' ? '短剧' : '长片'
  const format = site.format.toUpperCase()
  return `${type} · ${format}`
}

export function CrawlerSiteTable({
  displaySites,
  selected,
  allVisibleSelected,
  sortBy,
  sortDir,
  filters,
  columnWidths,
  visibleColumnCount,
  visibleTableMinWidth,
  validateStates,
  rowSaving,
  runningBySite,
  setFilters,
  setSort,
  toggleColumn,
  requiredColumns,
  colClass,
  handleSort,
  startResize,
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
  const wrapperRef = useRef<HTMLTableSectionElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(event.target as Node)) return
      setOpenMenuColumn(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [])

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

  async function handleCopyApi(apiUrl: string) {
    try {
      await navigator.clipboard.writeText(apiUrl)
      showToast('已复制 API 地址', true)
    } catch {
      showToast('复制失败', false)
    }
  }

  function updateWeightPreset(level: keyof WeightPreset, input: string) {
    const next = normalizeWeight(Number(input))
    setWeightPresets((prev) => {
      const draft = { ...prev, [level]: next }
      if (draft.high < draft.medium) draft.high = draft.medium
      if (draft.medium < draft.low) draft.medium = draft.low
      return draft
    })
  }

  return (
    <AdminTableFrame minWidth={visibleTableMinWidth} scrollTestId="crawler-sites-scroll-container">
      <thead ref={wrapperRef}>
        <CrawlerSiteTableLiteHeader
          sortBy={sortBy}
          sortDir={sortDir}
          filters={filters}
          columnWidths={columnWidths}
          colClass={colClass}
          allVisibleSelected={allVisibleSelected}
          toggleAll={toggleAll}
          startResize={startResize}
          onSort={handleSort}
          onSetSort={setSort}
          onPatchFilter={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClearColumnFilter={clearColumnFilter}
          onToggleColumn={toggleColumn}
          requiredColumns={requiredColumns}
          openMenuColumn={openMenuColumn}
          setOpenMenuColumn={setOpenMenuColumn}
        />
        <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
          <th className={`${colClass('weight')} px-3 py-2`} style={{ width: columnWidths.weight, minWidth: columnWidths.weight }}>
            <div className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
              <span>高</span>
              <input
                type="number"
                className="w-10 rounded border border-[var(--border)] bg-[var(--bg3)] px-1 py-0.5 text-[11px] text-[var(--text)]"
                value={weightPresets.high}
                onChange={(event) => updateWeightPreset('high', event.target.value)}
              />
              <span>中</span>
              <input
                type="number"
                className="w-10 rounded border border-[var(--border)] bg-[var(--bg3)] px-1 py-0.5 text-[11px] text-[var(--text)]"
                value={weightPresets.medium}
                onChange={(event) => updateWeightPreset('medium', event.target.value)}
              />
              <span>低</span>
              <input
                type="number"
                className="w-10 rounded border border-[var(--border)] bg-[var(--bg3)] px-1 py-0.5 text-[11px] text-[var(--text)]"
                value={weightPresets.low}
                onChange={(event) => updateWeightPreset('low', event.target.value)}
              />
            </div>
          </th>
          <th colSpan={visibleColumnCount + 1} className="px-3 py-2 text-left text-[11px] text-[var(--muted)]">
            权重档位可编辑，行内点击“高/中/低”循环切换并保存。
          </th>
        </tr>
      </thead>
      <tbody>
        <AdminTableState
          isEmpty={displaySites.length === 0}
          colSpan={visibleColumnCount + 1}
          emptyText="没有符合当前筛选条件的源站"
        />
        {displaySites.map((site) => {
          const rowBusy = rowSaving[site.key] === true
          const canInlineEdit = !site.fromConfig
          const siteRunning = runningBySite[site.key] === true
          const domainLabel = site.key

          return (
            <tr key={site.key} className="border-b border-[var(--border)] hover:bg-[var(--bg2)] transition-colors">
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(site.key)}
                  onChange={() => toggleSelect(site.key)}
                  className="accent-[var(--accent)]"
                />
              </td>

              <td className={`${colClass('name')} px-3 py-3`}>
                <div className="truncate font-medium text-[var(--text)]" title={site.name}>{site.name}</div>
              </td>

              <td className={`${colClass('key')} px-3 py-3`}>
                <div className="flex items-center gap-1">
                  <span className="max-w-[160px] truncate text-xs text-[var(--muted)]" title={site.apiUrl}>{domainLabel}</span>
                  <button
                    type="button"
                    onClick={() => { void handleCopyApi(site.apiUrl) }}
                    className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    复制
                  </button>
                </div>
              </td>

              <td className={`${colClass('typeFormat')} px-3 py-3`}>
                <span className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]">
                  {formatTypeLabel(site)}
                </span>
              </td>

              <td className={`${colClass('weight')} px-3 py-3`}>
                <button
                  type="button"
                  disabled={!canInlineEdit || rowBusy}
                  onClick={() => {
                    const value = nextWeight(site.weight, weightPresets)
                    void handleInlineUpdate(site, { weight: value })
                  }}
                  className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
                >
                  {getWeightLevelLabel(site.weight, weightPresets)} · {site.weight}
                </button>
              </td>

              <td className={`${colClass('isAdult')} px-3 py-3`}>
                <button
                  type="button"
                  disabled={!canInlineEdit || rowBusy}
                  onClick={() => { void handleInlineUpdate(site, { isAdult: !site.isAdult }) }}
                  className={`text-base ${site.isAdult ? 'text-red-400' : 'text-[var(--muted)]'} disabled:opacity-50`}
                  title={site.isAdult ? '成人源' : '非成人源'}
                >
                  🔞
                </button>
              </td>

              <td className={`${colClass('fromConfig')} px-3 py-3`}>
                <span className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--muted)]">
                  {site.fromConfig ? '配置文件' : '手动维护'}
                </span>
              </td>

              <td className={`${colClass('enabled')} px-3 py-3`}>
                <button
                  type="button"
                  onClick={() => { void handleToggleDisabled(site) }}
                  disabled={!canInlineEdit || rowBusy}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors disabled:opacity-50 ${
                    site.disabled ? 'border-[var(--border)] bg-[var(--bg3)]' : 'border-green-500/30 bg-green-500/30'
                  }`}
                  title={site.disabled ? '已禁用' : '已启用'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      site.disabled ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
              </td>

              <td className={`${colClass('lastCrawl')} px-3 py-3`}>
                <span className="text-xs text-[var(--muted)]" title={formatAbsoluteTime(site.lastCrawledAt)}>
                  {getRelativeTimeLabel(site.lastCrawledAt)}
                </span>
              </td>

              <td className={`${colClass('crawlOps')} px-3 py-3`}>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { void handleTriggerCrawl('incremental-crawl', site) }}
                    disabled={siteRunning}
                    className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
                  >
                    增量
                  </button>
                  <button
                    onClick={() => { void handleTriggerCrawl('full-crawl', site) }}
                    disabled={siteRunning}
                    className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                  >
                    全量
                  </button>
                </div>
              </td>

              <td className={`${colClass('manageOps')} px-3 py-3`}>
                <details className="group relative">
                  <summary className="cursor-pointer list-none rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]">
                    操作
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-24 rounded border border-[var(--border)] bg-[var(--bg2)] p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => { void handleValidate(site) }}
                      disabled={validateStates[site.key] === 'checking'}
                      className="block w-full rounded px-2 py-1 text-left text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                    >
                      检测
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTarget(site)}
                      className="mt-0.5 block w-full rounded px-2 py-1 text-left text-xs text-[var(--text)] hover:bg-[var(--bg3)]"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleDelete(site) }}
                      disabled={site.fromConfig}
                      className="mt-0.5 block w-full rounded px-2 py-1 text-left text-xs text-red-400 hover:bg-red-500/10 disabled:text-[var(--muted)] disabled:hover:bg-transparent"
                    >
                      删除
                    </button>
                  </div>
                </details>
              </td>
            </tr>
          )
        })}
      </tbody>
    </AdminTableFrame>
  )
}
