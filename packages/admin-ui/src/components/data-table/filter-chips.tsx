'use client'

/**
 * filter-chips.tsx — DataTable filter chips slot（CHG-DESIGN-02 Step 7A）
 *
 * 真源：reference.md §4.4.1 — toolbar 内 active filter 可视化（{column.header}: {value} ×）
 *
 * 渲染策略：
 *   - 自动从 query.filters + columns 配对，每列一个 chip
 *   - 6 种 FilterValue.kind 内置默认 formatter（避免 raw String(filter) → "[object Object]"）
 *   - column.renderFilterChip 完全接管逃生口（消费方拿 filter / column / onClear）
 *   - 没有 active filter 时整个容器不渲染（消费方门控由 DataTable 决定）
 *
 * 位置：toolbar 容器内独立第二 flex row（避开与 search/views/trailing 同行 wrap 抖动；
 *      arch-reviewer R-3 风险缓解）
 */
import React from 'react'
import type {
  ColumnDescriptor,
  FilterValue,
  TableColumn,
  TableQueryPatch,
} from './types'

interface FilterChipsProps<T> {
  readonly columns: readonly TableColumn<T>[]
  readonly filters: ReadonlyMap<string, FilterValue>
  readonly onChange: (patch: TableQueryPatch) => void
}

export function FilterChips<T>({
  columns,
  filters,
  onChange,
}: FilterChipsProps<T>): React.ReactElement | null {
  if (filters.size === 0) return null

  const chips: React.ReactNode[] = []
  for (const [colId, filter] of filters) {
    const column = columns.find((c) => c.id === colId)
    if (!column) continue
    const onClear = () => {
      const next = new Map(filters)
      next.delete(colId)
      onChange({ filters: next })
    }
    const ctx = { filter, column, onClear }
    if (column.renderFilterChip) {
      const node = column.renderFilterChip(ctx)
      if (node === null || node === undefined) continue
      chips.push(
        <React.Fragment key={colId}>{node}</React.Fragment>,
      )
    } else {
      chips.push(
        <DefaultFilterChip
          key={colId}
          column={column}
          filter={filter}
          onClear={onClear}
        />,
      )
    }
  }

  if (chips.length === 0) return null

  return (
    <div data-table-filter-chips role="region" aria-label="筛选条件">
      {chips}
    </div>
  )
}

interface DefaultFilterChipProps {
  readonly column: ColumnDescriptor
  readonly filter: FilterValue
  readonly onClear: () => void
}

function DefaultFilterChip({ column, filter, onClear }: DefaultFilterChipProps): React.ReactElement {
  const value = formatFilterValue(filter)
  return (
    <span data-table-filter-chip data-testid={`filter-chip-${column.id}`}>
      <span data-table-filter-chip-label>{column.header}</span>
      <span data-table-filter-chip-sep aria-hidden="true">：</span>
      <span data-table-filter-chip-value>{value}</span>
      <button
        type="button"
        data-table-filter-chip-clear
        onClick={onClear}
        aria-label={`清除 ${typeof column.header === 'string' ? column.header : '此'} 筛选`}
      >×</button>
    </span>
  )
}

/**
 * 6 种 FilterValue.kind 默认 formatter（CHG-DESIGN-02 Step 7A arch-reviewer 必修项）。
 * 禁止 raw `String(filter)` 渲染（对 enum/range/date-range 这类对象会输出 "[object Object]"）。
 */
export function formatFilterValue(filter: FilterValue): string {
  switch (filter.kind) {
    case 'text':
      return filter.value
    case 'number':
      return String(filter.value)
    case 'bool':
      return filter.value ? '是' : '否'
    case 'enum': {
      const items = filter.value
      if (items.length === 0) return '（空）'
      if (items.length <= 3) return items.join(', ')
      return `${items.slice(0, 3).join(', ')}…及 ${items.length - 3} 项`
    }
    case 'range': {
      const min = filter.min !== undefined ? String(filter.min) : '−∞'
      const max = filter.max !== undefined ? String(filter.max) : '+∞'
      return `${min} – ${max}`
    }
    case 'date-range': {
      const from = filter.from ?? '*'
      const to = filter.to ?? '*'
      return `${from} ~ ${to}`
    }
  }
}
