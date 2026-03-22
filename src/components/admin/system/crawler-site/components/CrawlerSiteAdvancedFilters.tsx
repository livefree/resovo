import type { Dispatch, SetStateAction } from 'react'
import type { FilterState } from '@/components/admin/system/crawler-site/tableState'

interface CrawlerSiteAdvancedFiltersProps {
  filters: FilterState
  setFilters: Dispatch<SetStateAction<FilterState>>
}

export function CrawlerSiteAdvancedFilters({ filters, setFilters }: CrawlerSiteAdvancedFiltersProps) {
  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-3">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[var(--muted)]">
          API 地址
          <input
            value={filters.apiUrl}
            onChange={(event) => setFilters((prev) => ({ ...prev, apiUrl: event.target.value }))}
            placeholder="筛选 API 地址"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5 text-xs text-[var(--text)]"
          />
        </label>

        <label className="text-xs text-[var(--muted)]">
          格式
          <select
            value={filters.format}
            onChange={(event) => setFilters((prev) => ({ ...prev, format: event.target.value as typeof prev.format }))}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5 text-xs text-[var(--text)]"
          >
            <option value="all">全部</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </select>
        </label>

        <label className="text-xs text-[var(--muted)]">
          成人
          <select
            value={filters.isAdult}
            onChange={(event) => setFilters((prev) => ({ ...prev, isAdult: event.target.value as typeof prev.isAdult }))}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5 text-xs text-[var(--text)]"
          >
            <option value="all">全部</option>
            <option value="yes">是</option>
            <option value="no">否</option>
          </select>
        </label>

        <div className="text-xs text-[var(--muted)]">
          权重范围
          <div className="mt-1 flex gap-2">
            <input
              value={filters.weightMin}
              onChange={(event) => setFilters((prev) => ({ ...prev, weightMin: event.target.value }))}
              placeholder="最小"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5 text-xs text-[var(--text)]"
            />
            <input
              value={filters.weightMax}
              onChange={(event) => setFilters((prev) => ({ ...prev, weightMax: event.target.value }))}
              placeholder="最大"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5 text-xs text-[var(--text)]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
