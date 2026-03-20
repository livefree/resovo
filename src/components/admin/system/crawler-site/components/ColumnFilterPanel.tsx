import type { FilterState } from '@/components/admin/system/crawler-site/tableState'
import type { ColumnId } from '@/components/admin/system/crawler-site/tableState'

interface ColumnFilterPanelProps {
  columnId: ColumnId
  filters: FilterState
  onPatch: (patch: Partial<FilterState>) => void
}

export function ColumnFilterPanel({ columnId, filters, onPatch }: ColumnFilterPanelProps) {
  if (columnId === 'name') {
    return (
      <input
        value={filters.keyOrName}
        onChange={(event) => onPatch({ keyOrName: event.target.value })}
        placeholder="筛选 名称 / key"
        className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
      />
    )
  }
  if (columnId === 'apiUrl') {
    return (
      <input
        value={filters.apiUrl}
        onChange={(event) => onPatch({ apiUrl: event.target.value })}
        placeholder="筛选 API 地址"
        className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
      />
    )
  }
  if (columnId === 'sourceType') {
    return (
      <select
        value={filters.sourceType}
        onChange={(event) => onPatch({ sourceType: event.target.value as FilterState['sourceType'] })}
        className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
      >
        <option value="all">全部</option>
        <option value="vod">长片</option>
        <option value="shortdrama">短剧</option>
      </select>
    )
  }
  if (columnId === 'format') {
    return (
      <select
        value={filters.format}
        onChange={(event) => onPatch({ format: event.target.value as FilterState['format'] })}
        className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
      >
        <option value="all">全部</option>
        <option value="json">JSON</option>
        <option value="xml">XML</option>
      </select>
    )
  }
  if (columnId === 'isAdult') {
    return (
      <select
        value={filters.isAdult}
        onChange={(event) => onPatch({ isAdult: event.target.value as FilterState['isAdult'] })}
        className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
      >
        <option value="all">全部</option>
        <option value="yes">是</option>
        <option value="no">否</option>
      </select>
    )
  }
  if (columnId === 'fromConfig') {
    return (
      <select
        value={filters.fromConfig}
        onChange={(event) => onPatch({ fromConfig: event.target.value as FilterState['fromConfig'] })}
        className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
      >
        <option value="all">全部</option>
        <option value="config">配置</option>
        <option value="manual">手工</option>
      </select>
    )
  }
  if (columnId === 'disabled') {
    return (
      <select
        value={filters.disabled}
        onChange={(event) => onPatch({ disabled: event.target.value as FilterState['disabled'] })}
        className="w-full rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)]"
      >
        <option value="all">全部</option>
        <option value="enabled">运行中</option>
        <option value="disabled">停用</option>
      </select>
    )
  }
  if (columnId === 'weight') {
    return (
      <div className="flex gap-1">
        <input
          value={filters.weightMin}
          onChange={(event) => onPatch({ weightMin: event.target.value })}
          placeholder="最小"
          className="w-16 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-1 text-xs text-[var(--text)]"
        />
        <input
          value={filters.weightMax}
          onChange={(event) => onPatch({ weightMax: event.target.value })}
          placeholder="最大"
          className="w-16 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-1 text-xs text-[var(--text)]"
        />
      </div>
    )
  }

  return null
}
