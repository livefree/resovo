import type { Dispatch, SetStateAction } from 'react'
import { DEFAULT_FILTERS } from '@/components/admin/system/crawler-site/tableState'
import type { FilterState } from '@/components/admin/system/crawler-site/tableState'

interface ActiveFilterChipsBarProps {
  filters: FilterState
  setFilters: Dispatch<SetStateAction<FilterState>>
}

interface FilterChip {
  key: string
  label: string
  remove: () => void
}

export function ActiveFilterChipsBar({ filters, setFilters }: ActiveFilterChipsBarProps) {
  const chips: FilterChip[] = []

  if (filters.keyOrName.trim()) {
    chips.push({
      key: 'keyOrName',
      label: `名称/Key: ${filters.keyOrName.trim()}`,
      remove: () => setFilters((prev) => ({ ...prev, keyOrName: '' })),
    })
  }
  if (filters.apiUrl.trim()) {
    chips.push({
      key: 'apiUrl',
      label: `API: ${filters.apiUrl.trim()}`,
      remove: () => setFilters((prev) => ({ ...prev, apiUrl: '' })),
    })
  }
  if (filters.sourceType !== 'all') {
    chips.push({
      key: 'sourceType',
      label: `类型: ${filters.sourceType === 'vod' ? '长片' : '短剧'}`,
      remove: () => setFilters((prev) => ({ ...prev, sourceType: 'all' })),
    })
  }
  if (filters.disabled !== 'all') {
    chips.push({
      key: 'disabled',
      label: `状态: ${filters.disabled === 'enabled' ? '运行中' : '停用'}`,
      remove: () => setFilters((prev) => ({ ...prev, disabled: 'all' })),
    })
  }
  if (filters.fromConfig !== 'all') {
    chips.push({
      key: 'fromConfig',
      label: `来源: ${filters.fromConfig === 'config' ? '配置' : '手工'}`,
      remove: () => setFilters((prev) => ({ ...prev, fromConfig: 'all' })),
    })
  }
  if (filters.format !== 'all') {
    chips.push({
      key: 'format',
      label: `格式: ${filters.format.toUpperCase()}`,
      remove: () => setFilters((prev) => ({ ...prev, format: 'all' })),
    })
  }
  if (filters.isAdult !== 'all') {
    chips.push({
      key: 'isAdult',
      label: `成人: ${filters.isAdult === 'yes' ? '是' : '否'}`,
      remove: () => setFilters((prev) => ({ ...prev, isAdult: 'all' })),
    })
  }
  if (filters.weightMin.trim()) {
    chips.push({
      key: 'weightMin',
      label: `权重≥${filters.weightMin.trim()}`,
      remove: () => setFilters((prev) => ({ ...prev, weightMin: '' })),
    })
  }
  if (filters.weightMax.trim()) {
    chips.push({
      key: 'weightMax',
      label: `权重≤${filters.weightMax.trim()}`,
      remove: () => setFilters((prev) => ({ ...prev, weightMax: '' })),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2">
      <span className="text-xs text-[var(--muted)]">生效筛选</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="rounded-full border border-[var(--border)] bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--text)] hover:bg-[var(--bg)]"
        >
          {chip.label} ×
        </button>
      ))}
      <button
        type="button"
        onClick={() => setFilters(DEFAULT_FILTERS)}
        className="ml-auto rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
      >
        清空筛选
      </button>
    </div>
  )
}
