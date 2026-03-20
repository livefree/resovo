import type { Dispatch, SetStateAction } from "react"
import type { CrawlerSite, UpdateCrawlerSiteInput } from "@/types"
import type {
  ColumnId,
  ColumnWidthState,
  FilterState,
  SortDir,
  SortField,
} from "@/components/admin/system/crawler-site/tableState"
import { CrawlerSiteFilters } from "@/components/admin/system/crawler-site/components/CrawlerSiteFilters"

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
  crawlTriggering: Record<string, boolean>
  setFilters: Dispatch<SetStateAction<FilterState>>
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
  crawlTriggering,
  setFilters,
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
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div data-testid="crawler-sites-scroll-container" className="h-[60vh] min-h-[420px] max-h-[720px] overflow-y-auto overflow-x-auto">
        <table className="w-full table-fixed text-sm" style={{ minWidth: `${visibleTableMinWidth}px` }}>
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg2)]">
              <th className="w-8 px-3 py-3 text-left">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="accent-[var(--accent)]" />
              </th>
              <th className={`${colClass("name")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.name, minWidth: columnWidths.name }} onClick={() => handleSort("name")}>
                名称 / Key {sortBy === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-name" onMouseDown={(e) => { e.stopPropagation(); startResize("name", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("apiUrl")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.apiUrl, minWidth: columnWidths.apiUrl }} onClick={() => handleSort("apiUrl")}>
                API 地址 {sortBy === "apiUrl" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-apiUrl" onMouseDown={(e) => { e.stopPropagation(); startResize("apiUrl", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("sourceType")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.sourceType, minWidth: columnWidths.sourceType }} onClick={() => handleSort("sourceType")}>
                类型 {sortBy === "sourceType" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-sourceType" onMouseDown={(e) => { e.stopPropagation(); startResize("sourceType", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("format")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.format, minWidth: columnWidths.format }} onClick={() => handleSort("format")}>
                格式 {sortBy === "format" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-format" onMouseDown={(e) => { e.stopPropagation(); startResize("format", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("weight")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.weight, minWidth: columnWidths.weight }} onClick={() => handleSort("weight")}>
                权重 {sortBy === "weight" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-weight" onMouseDown={(e) => { e.stopPropagation(); startResize("weight", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("isAdult")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.isAdult, minWidth: columnWidths.isAdult }} onClick={() => handleSort("isAdult")}>
                成人 {sortBy === "isAdult" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-isAdult" onMouseDown={(e) => { e.stopPropagation(); startResize("isAdult", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("fromConfig")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.fromConfig, minWidth: columnWidths.fromConfig }} onClick={() => handleSort("fromConfig")}>
                来源 {sortBy === "fromConfig" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-fromConfig" onMouseDown={(e) => { e.stopPropagation(); startResize("fromConfig", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("disabled")} relative px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer`} style={{ width: columnWidths.disabled, minWidth: columnWidths.disabled }} onClick={() => handleSort("disabled")}>
                状态 {sortBy === "disabled" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                <span data-testid="resize-handle-disabled" onMouseDown={(e) => { e.stopPropagation(); startResize("disabled", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("lastCrawl")} relative px-3 py-3 text-left font-medium text-[var(--muted)]`} style={{ width: columnWidths.lastCrawl, minWidth: columnWidths.lastCrawl }}>
                最近采集
                <span data-testid="resize-handle-lastCrawl" onMouseDown={(e) => { e.stopPropagation(); startResize("lastCrawl", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("crawlOps")} relative px-3 py-3 text-left font-medium text-[var(--muted)]`} style={{ width: columnWidths.crawlOps, minWidth: columnWidths.crawlOps }}>
                采集操作
                <span data-testid="resize-handle-crawlOps" onMouseDown={(e) => { e.stopPropagation(); startResize("crawlOps", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
              <th className={`${colClass("manageOps")} relative px-3 py-3 text-left font-medium text-[var(--muted)]`} style={{ width: columnWidths.manageOps, minWidth: columnWidths.manageOps }}>
                管理操作
                <span data-testid="resize-handle-manageOps" onMouseDown={(e) => { e.stopPropagation(); startResize("manageOps", e.clientX) }} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--border)]" />
              </th>
            </tr>
            <CrawlerSiteFilters filters={filters} colClass={colClass} setFilters={setFilters} />
          </thead>
          <tbody>
            {displaySites.length === 0 && (
              <tr>
                <td colSpan={visibleColumnCount + 1} className="px-3 py-10 text-center text-[var(--muted)] text-sm">没有符合当前筛选条件的源站</td>
              </tr>
            )}
            {displaySites.map((site) => {
              const vs = validateStates[site.key] ?? "idle"
              const rowBusy = rowSaving[site.key] === true
              const canInlineEdit = !site.fromConfig
              const incrementalKey = `${site.key}:incremental-crawl`
              const fullKey = `${site.key}:full-crawl`
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
                  <td className={`${colClass("fromConfig")} px-3 py-3`}>{site.fromConfig ? <Badge color="blue">配置文件</Badge> : <span className="text-xs text-[var(--muted)]">手工</span>}</td>
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
                          {site.lastCrawlStatus === "ok" && <Badge color="green">成功</Badge>}
                          {site.lastCrawlStatus === "failed" && <Badge color="red">失败</Badge>}
                          {site.lastCrawlStatus === "running" && <Badge color="yellow">采集中</Badge>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">未采集</span>
                    )}
                  </td>
                  <td className={`${colClass("crawlOps")} px-3 py-3`}>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleTriggerCrawl("incremental-crawl", site)} disabled={crawlTriggering[incrementalKey] === true} className="rounded px-2 py-1 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50">增量</button>
                      <button onClick={() => handleTriggerCrawl("full-crawl", site)} disabled={crawlTriggering[fullKey] === true} className="rounded px-2 py-1 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50">全量</button>
                    </div>
                  </td>
                  <td className={`${colClass("manageOps")} px-3 py-3`}>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleValidate(site)} disabled={vs === "checking"} className="rounded px-2 py-1 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50">检测</button>
                      <button onClick={() => setEditTarget(site)} className="rounded px-2 py-1 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">编辑</button>
                      {!site.fromConfig && <button onClick={() => handleDelete(site)} className="rounded px-2 py-1 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10">删除</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
