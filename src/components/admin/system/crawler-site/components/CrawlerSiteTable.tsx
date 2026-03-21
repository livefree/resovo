import type { Dispatch, SetStateAction } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { CrawlerSite, UpdateCrawlerSiteInput } from "@/types"
import type {
  ColumnId,
  ColumnWidthState,
  FilterState,
  SortDir,
  SortField,
} from "@/components/admin/system/crawler-site/tableState"
import { DEFAULT_FILTERS } from "@/components/admin/system/crawler-site/tableState"
import { AdminTableState } from "@/components/admin/shared/feedback/AdminTableState"
import { AdminTableFrame } from "@/components/admin/shared/table/AdminTableFrame"
import { CrawlerSiteTableLiteHeader } from "@/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader"
import type { CrawlMode, CrawlTaskDTO } from "@/components/admin/system/crawler-site/crawlTask.types"

type ValidateStatus = "idle" | "checking" | "ok" | "error" | "timeout"

function Badge({ children, color }: { children: React.ReactNode; color: "green" | "red" | "yellow" | "gray" | "blue" }) {
  const cls = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    gray: "bg-[var(--bg3)] text-[var(--muted)] border-[var(--border)]",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  }[color]

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${cls}`}>
      {children}
    </span>
  )
}

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
  runningModeBySite: Record<string, CrawlMode | null>
  latestTaskBySite: Record<string, CrawlTaskDTO | null>
  autoConfig: {
    globalEnabled: boolean
    defaultMode: 'incremental' | 'full'
    perSiteOverrides: Record<string, { enabled: boolean; mode: 'inherit' | 'incremental' | 'full' }>
  } | null
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
  handleTriggerCrawl: (type: "full-crawl" | "incremental-crawl", site?: CrawlerSite) => Promise<void>
  handleDelete: (site: CrawlerSite) => Promise<void>
  setEditTarget: (site: CrawlerSite) => void
  showToast: (msg: string, ok: boolean) => void
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
  runningModeBySite,
  latestTaskBySite,
  autoConfig,
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
  const wrapperRef = useRef<HTMLTableSectionElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(event.target as Node)) return
      setOpenMenuColumn(null)
    }
    window.addEventListener("mousedown", onPointerDown)
    return () => window.removeEventListener("mousedown", onPointerDown)
  }, [])

  const clearColumnFilter = useMemo(() => (
    (columnId: ColumnId) => {
      switch (columnId) {
        case "name":
          setFilters((prev) => ({ ...prev, keyOrName: DEFAULT_FILTERS.keyOrName }))
          break
        case "apiUrl":
          setFilters((prev) => ({ ...prev, apiUrl: DEFAULT_FILTERS.apiUrl }))
          break
        case "sourceType":
          setFilters((prev) => ({ ...prev, sourceType: DEFAULT_FILTERS.sourceType }))
          break
        case "format":
          setFilters((prev) => ({ ...prev, format: DEFAULT_FILTERS.format }))
          break
        case "weight":
          setFilters((prev) => ({ ...prev, weightMin: DEFAULT_FILTERS.weightMin, weightMax: DEFAULT_FILTERS.weightMax }))
          break
        case "isAdult":
          setFilters((prev) => ({ ...prev, isAdult: DEFAULT_FILTERS.isAdult }))
          break
        case "fromConfig":
          setFilters((prev) => ({ ...prev, fromConfig: DEFAULT_FILTERS.fromConfig }))
          break
        case "disabled":
          setFilters((prev) => ({ ...prev, disabled: DEFAULT_FILTERS.disabled }))
          break
        default:
          break
      }
    }
  ), [setFilters])

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
      </thead>
      <tbody>
        <AdminTableState
          isEmpty={displaySites.length === 0}
          colSpan={visibleColumnCount + 1}
          emptyText="没有符合当前筛选条件的源站"
        />
        {displaySites.map((site) => {
              const vs = validateStates[site.key] ?? "idle"
              const rowBusy = rowSaving[site.key] === true
              const canInlineEdit = !site.fromConfig
              const siteRunning = runningBySite[site.key] === true
              const siteRunningMode = runningModeBySite[site.key]
              const latestTask = latestTaskBySite[site.key]
              const siteAutoOverride = autoConfig?.perSiteOverrides?.[site.key]
              const siteAutoEnabled = autoConfig?.globalEnabled === true && (
                siteAutoOverride ? siteAutoOverride.enabled : true
              )
              const siteAutoMode = siteAutoOverride?.mode === 'inherit' || !siteAutoOverride
                ? autoConfig?.defaultMode ?? 'incremental'
                : siteAutoOverride.mode
              return (
                <tr key={site.key} className="border-b border-[var(--border)] hover:bg-[var(--bg2)] transition-colors">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(site.key)} onChange={() => toggleSelect(site.key)} className="accent-[var(--accent)]" /></td>
                  <td className={`${colClass("name")} px-3 py-3`}><div className="font-medium text-[var(--text)]">{site.name}</div><div className="mt-0.5 text-xs text-[var(--muted)]">{site.key}</div></td>
                  <td className={`${colClass("apiUrl")} px-3 py-3`}><span className="block truncate text-xs text-[var(--muted)]">{site.apiUrl}</span></td>
                  <td className={`${colClass("sourceType")} px-3 py-3`}>
                    <select value={site.sourceType} disabled={!canInlineEdit || rowBusy} onChange={(e) => handleInlineUpdate(site, { sourceType: e.target.value as "vod" | "shortdrama" })} className="w-24 rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50">
                      <option value="vod">长片</option>
                      <option value="shortdrama">短剧</option>
                    </select>
                  </td>
                  <td className={`${colClass("format")} px-3 py-3`}>
                    <select value={site.format} disabled={!canInlineEdit || rowBusy} onChange={(e) => handleInlineUpdate(site, { format: e.target.value as "json" | "xml" })} className="w-20 rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50">
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                    </select>
                  </td>
                  <td className={`${colClass("weight")} px-3 py-3`}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={site.weight}
                      disabled={!canInlineEdit || rowBusy}
                      onBlur={(e) => {
                        const next = Number(e.target.value)
                        if (Number.isNaN(next) || next < 0 || next > 100) {
                          e.target.value = String(site.weight)
                          showToast("权重必须是 0-100", false)
                          return
                        }
                        if (next !== site.weight) {
                          void handleInlineUpdate(site, { weight: next })
                        }
                      }}
                      className="w-16 rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
                    />
                  </td>
                  <td className={`${colClass("isAdult")} px-3 py-3`}>
                    <label className="inline-flex items-center gap-1 text-xs text-[var(--text)]">
                      <input type="checkbox" checked={site.isAdult} disabled={!canInlineEdit || rowBusy} onChange={(e) => handleInlineUpdate(site, { isAdult: e.target.checked })} className="accent-[var(--accent)]" />成人
                    </label>
                  </td>
                  <td className={`${colClass("fromConfig")} px-3 py-3`}>
                    {site.fromConfig ? <Badge color="blue">配置文件</Badge> : <span className="text-xs text-[var(--muted)]">手工</span>}
                    <div className="mt-1 text-[11px] text-[var(--muted)]">
                      自动：
                      {autoConfig == null ? (
                        <span className="ml-1">加载中…</span>
                      ) : siteAutoEnabled ? (
                        <span className="ml-1 text-green-400">
                          开启({siteAutoMode === 'full' ? '全量' : '增量'})
                        </span>
                      ) : (
                        <span className="ml-1 text-red-400">关闭</span>
                      )}
                    </div>
                  </td>
                  <td className={`${colClass("disabled")} px-3 py-3`}>
                    <button onClick={() => handleToggleDisabled(site)} disabled={!canInlineEdit || rowBusy} className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${site.disabled ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"} disabled:opacity-50`}>
                      {site.disabled ? "已停用" : "运行中"}
                    </button>
                    {!canInlineEdit && <div className="mt-1 text-[11px] text-[var(--muted)]">配置文件维护</div>}
                    {vs !== "idle" && (
                      <div className="mt-1">
                        {vs === "checking" && <span className="text-xs text-[var(--muted)]">检测中…</span>}
                        {vs === "ok" && <Badge color="green">可达</Badge>}
                        {vs === "error" && <Badge color="red">不可达</Badge>}
                        {vs === "timeout" && <Badge color="yellow">超时</Badge>}
                      </div>
                    )}
                  </td>
                  <td className={`${colClass("lastCrawl")} px-3 py-3`}>
                    {site.lastCrawledAt ? (
                      <div className="text-xs text-[var(--muted)] whitespace-nowrap">
                        {new Date(site.lastCrawledAt).toLocaleString()}
                        <div className="mt-1">
                          {siteRunning && <Badge color="yellow">采集中</Badge>}
                          {latestTask?.status === "paused" && <Badge color="gray">已暂停</Badge>}
                          {latestTask?.status === "cancelled" && <Badge color="gray">已取消</Badge>}
                          {latestTask?.status === "timeout" && <Badge color="yellow">超时</Badge>}
                          {!siteRunning && site.lastCrawlStatus === "ok" && <Badge color="green">成功</Badge>}
                          {!siteRunning && site.lastCrawlStatus === "failed" && <Badge color="red">失败</Badge>}
                          {!siteRunning && site.lastCrawlStatus === "running" && <Badge color="yellow">采集中</Badge>}
                          {!siteRunning && latestTask?.status === "failed" && latestTask.message ? (
                            <span className="ml-2 text-[11px] text-red-400">{latestTask.message}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--muted)]">
                        <span>未采集</span>
                        {siteRunning ? (
                          <div className="mt-1">
                            <Badge color="yellow">采集中</Badge>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className={`${colClass("crawlOps")} px-3 py-3`}>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleTriggerCrawl("incremental-crawl", site)}
                        disabled={siteRunning}
                        className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
                      >
                        {latestTask?.status === "paused" && siteRunningMode === "incremental" ? "增量已暂停" : siteRunning && siteRunningMode === "incremental" ? "增量中…" : "增量"}
                      </button>
                      <button
                        onClick={() => handleTriggerCrawl("full-crawl", site)}
                        disabled={siteRunning}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                      >
                        {latestTask?.status === "paused" && siteRunningMode === "full" ? "全量已暂停" : siteRunning && siteRunningMode === "full" ? "全量中…" : "全量"}
                      </button>
                    </div>
                  </td>
                  <td className={`${colClass("manageOps")} px-3 py-3`}>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditTarget(site)}
                        className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--accent)]/20"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleValidate(site)}
                        disabled={vs === "checking"}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                      >
                        检测
                      </button>
                      {!site.fromConfig && <button onClick={() => handleDelete(site)} className="rounded px-2 py-1 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10">删除</button>}
                    </div>
                  </td>
                </tr>
              )
        })}
      </tbody>
    </AdminTableFrame>
  )
}
