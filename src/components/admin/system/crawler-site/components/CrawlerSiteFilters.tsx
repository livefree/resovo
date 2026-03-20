import type { Dispatch, SetStateAction } from 'react'
import type { ColumnId, FilterState } from '@/components/admin/system/crawler-site/tableState'

interface CrawlerSiteFiltersProps {
  filters: FilterState
  colClass: (id: ColumnId) => string
  setFilters: Dispatch<SetStateAction<FilterState>>
}

export function CrawlerSiteFilters({ filters, colClass, setFilters }: CrawlerSiteFiltersProps) {
  return (
    <tr className="sticky top-[45px] z-10 border-b border-[var(--border)] bg-[var(--bg2)] align-top">
      <th className="px-2 py-2" />
      <th className={`${colClass('name')} px-2 py-2`}>
        <input
          value={filters.keyOrName}
          onChange={(event) => setFilters((prev) => ({ ...prev, keyOrName: event.target.value }))}
          placeholder="筛选 名称 / key"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
        />
      </th>
      <th className={`${colClass('apiUrl')} px-2 py-2`}>
        <input
          value={filters.apiUrl}
          onChange={(event) => setFilters((prev) => ({ ...prev, apiUrl: event.target.value }))}
          placeholder="筛选 API 地址"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
        />
      </th>
      <th className={`${colClass('sourceType')} px-2 py-2`}>
        <select
          value={filters.sourceType}
          onChange={(event) => setFilters((prev) => ({ ...prev, sourceType: event.target.value as typeof prev.sourceType }))}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
        >
          <option value="all">全部</option>
          <option value="vod">长片</option>
          <option value="shortdrama">短剧</option>
        </select>
      </th>
      <th className={`${colClass('format')} px-2 py-2`}>
        <select
          value={filters.format}
          onChange={(event) => setFilters((prev) => ({ ...prev, format: event.target.value as typeof prev.format }))}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
        >
          <option value="all">全部</option>
          <option value="json">JSON</option>
          <option value="xml">XML</option>
        </select>
      </th>
      <th className={`${colClass('weight')} px-2 py-2`}>
        <div className="flex gap-1">
          <input
            value={filters.weightMin}
            onChange={(event) => setFilters((prev) => ({ ...prev, weightMin: event.target.value }))}
            placeholder="最小"
            className="w-16 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-1 text-xs text-[var(--text)]"
          />
          <input
            value={filters.weightMax}
            onChange={(event) => setFilters((prev) => ({ ...prev, weightMax: event.target.value }))}
            placeholder="最大"
            className="w-16 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-1 text-xs text-[var(--text)]"
          />
        </div>
      </th>
      <th className={`${colClass('isAdult')} px-2 py-2`}>
        <select
          value={filters.isAdult}
          onChange={(event) => setFilters((prev) => ({ ...prev, isAdult: event.target.value as typeof prev.isAdult }))}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
        >
          <option value="all">全部</option>
          <option value="yes">是</option>
          <option value="no">否</option>
        </select>
      </th>
      <th className={`${colClass('fromConfig')} px-2 py-2`}>
        <select
          value={filters.fromConfig}
          onChange={(event) => setFilters((prev) => ({ ...prev, fromConfig: event.target.value as typeof prev.fromConfig }))}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
        >
          <option value="all">全部</option>
          <option value="config">配置</option>
          <option value="manual">手工</option>
        </select>
      </th>
      <th className={`${colClass('disabled')} px-2 py-2`}>
        <select
          value={filters.disabled}
          onChange={(event) => setFilters((prev) => ({ ...prev, disabled: event.target.value as typeof prev.disabled }))}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
        >
          <option value="all">全部</option>
          <option value="enabled">运行中</option>
          <option value="disabled">停用</option>
        </select>
      </th>
      <th className={`${colClass('lastCrawl')} px-2 py-2`} />
      <th className={`${colClass('crawlOps')} px-2 py-2`} />
      <th className={`${colClass('manageOps')} px-2 py-2`} />
    </tr>
  )
}
