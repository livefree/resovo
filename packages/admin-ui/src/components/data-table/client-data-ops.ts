/**
 * client-data-ops.ts — DataTable client 模式 filter / sort 纯函数（DTR-A 拆自 data-table.tsx）
 *
 * client mode 下内部对 rows 做 filter + sort；server mode 不调用本模块。
 * 纯函数、零行为变化。
 */
import type { TableColumn, FilterValue, TableSortState } from './types'

function matchFilter(cellValue: unknown, filter: FilterValue): boolean {
  const str = String(cellValue ?? '')
  if (filter.kind === 'text') return str.toLowerCase().includes(filter.value.toLowerCase())
  if (filter.kind === 'number') return Number(cellValue) === filter.value
  if (filter.kind === 'bool') return Boolean(cellValue) === filter.value
  if (filter.kind === 'enum') return filter.value.includes(str)
  if (filter.kind === 'range') {
    const n = Number(cellValue)
    if (!Number.isFinite(n)) return false
    if (filter.min !== undefined && n < filter.min) return false
    if (filter.max !== undefined && n > filter.max) return false
    return true
  }
  if (filter.kind === 'date-range') {
    if (filter.from !== undefined && str < filter.from) return false
    if (filter.to !== undefined && str > filter.to) return false
    return true
  }
  return true
}

export function applyClientFilters<T>(
  rows: readonly T[],
  columns: readonly TableColumn<T>[],
  filters: ReadonlyMap<string, FilterValue>,
): readonly T[] {
  if (filters.size === 0) return rows
  return rows.filter((row) => {
    for (const [filterId, filter] of filters) {
      const col = columns.find((c) => c.id === filterId)
      if (!col) continue
      if (!matchFilter(col.accessor(row), filter)) return false
    }
    return true
  })
}

export function applyClientSort<T>(
  rows: readonly T[],
  columns: readonly TableColumn<T>[],
  sort: TableSortState,
): readonly T[] {
  if (sort.field === undefined) return rows
  const col = columns.find((c) => c.id === sort.field)
  if (!col) return rows
  return [...rows].sort((a, b) => {
    const av = col.accessor(a)
    const bv = col.accessor(b)
    const aStr = String(av ?? '')
    const bStr = String(bv ?? '')
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : aStr.localeCompare(bStr)
    return sort.direction === 'asc' ? cmp : -cmp
  })
}
