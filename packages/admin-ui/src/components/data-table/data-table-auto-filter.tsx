/**
 * DataTableAutoFilter — ADR-150 阶段 2 / EP-1 Step 3
 *
 * 列固有自动过滤 Google Sheets 范式三段 popover 内容组件。
 * 由 header-menu.tsx 提供 popover 容器（createPortal + 定位）+ 本组件渲染内容。
 *
 * 三段布局（sub 1 HOTFIX 2026-05-24 简化 §4）：
 *   段 1：排序（升序 / 降序 / 清除）— **始终渲染**；enableSorting !== true 时按钮 disabled + title
 *   段 2：值列表 —— 按 filterKind 渲染 4 种控件（enum / text / number / date）
 *   段 3：隐藏此列（onHide 缺省不渲染）
 *   按钮区：取消 / 应用 OK
 *
 * sub 1 HOTFIX 变更：
 *   - 删除原"过滤方式 kind radio 3 选"段（按值/按条件 v2 灰/按颜色 v3 灰）：
 *     v2/v3 灰化项徒增噪音；只有"按值过滤"可用，radio 形态对用户无意义。
 *   - 排序段去 sortable 门控：始终渲染，enableSorting !== true 时按钮 disabled + tooltip。
 *
 * 关键约束：
 *   - column.filterable 必须为 true（FilterableColumn<T> narrow）
 *   - onApply 走 OK 按钮（pending state 解耦 URL 同步）/ 取消走 currentFilter 恢复
 *   - filterOptions 与 filterDistinctEndpoint 互斥（dev warn）
 *   - 零硬编码颜色（全 CSS variable / dt-styles.tsx 集中声明）
 */

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFilterKindInference } from './use-filter-kind-inference'
import type {
  AutoFilterKind,
  DistinctOption,
  FilterableColumn,
  FilterValue,
  TableSortState,
} from './types'

export interface DataTableAutoFilterProps<T> {
  readonly column: FilterableColumn<T>
  readonly rows: readonly T[]
  readonly currentFilter: FilterValue | undefined
  readonly onApply: (value: FilterValue | undefined) => void
  readonly onCancel: () => void
  readonly currentSort: TableSortState
  readonly onSort: (field: string, direction: 'asc' | 'desc') => void
  readonly onClearSort: () => void
  readonly onHide?: () => void
  readonly distinctFetcher?: (table: string, field: string, q?: string) => Promise<readonly DistinctOption[]>
  readonly 'data-testid'?: string
}

export function DataTableAutoFilter<T>(props: DataTableAutoFilterProps<T>): React.ReactElement {
  const { column, rows, currentFilter, onApply, onCancel, currentSort, onSort, onClearSort, onHide, distinctFetcher } = props
  const testId = props['data-testid'] ?? `dt-autofilter-${column.id}`

  if (process.env.NODE_ENV === 'development') {
    if (column.filterOptions && column.filterDistinctEndpoint) {
      // eslint-disable-next-line no-console
      console.warn(`[DataTableAutoFilter] column "${column.id}" both filterOptions and filterDistinctEndpoint set; filterOptions takes precedence`)
    }
    if (column.filterDistinctEndpoint && !column.filterDistinctTable) {
      // eslint-disable-next-line no-console
      console.warn(`[DataTableAutoFilter] column "${column.id}" has filterDistinctEndpoint but no filterDistinctTable; distinct fetch will be skipped`)
    }
    if (column.columnMenu?.filterContent !== undefined) {
      // eslint-disable-next-line no-console
      console.warn(`[DataTableAutoFilter] column "${column.id}" has both filterable: true and columnMenu.filterContent; filterable auto-filter takes precedence (ADR-150 D-150-6 互斥约束)`)
    }
  }

  const filterKind: AutoFilterKind = useFilterKindInference(column, rows)
  const [pending, setPending] = useState<FilterValue | undefined>(currentFilter)
  useEffect(() => { setPending(currentFilter) }, [currentFilter])

  const isSortedAsc = currentSort.field === column.id && currentSort.direction === 'asc'
  const isSortedDesc = currentSort.field === column.id && currentSort.direction === 'desc'
  const isSorted = isSortedAsc || isSortedDesc
  const sortable = column.enableSorting === true

  const handleApply = useCallback(() => onApply(pending), [pending, onApply])
  const handleClear = useCallback(() => { setPending(undefined); onApply(undefined) }, [onApply])

  // sub 1 HOTFIX：排序段始终渲染，enableSorting !== true 时按钮 disabled + tooltip
  const sortDisabledTitle = sortable ? undefined : '本列不支持排序'

  return (
    <div data-autofilter-popover data-testid={testId} role="menu" aria-label={`列操作 - ${typeof column.header === 'string' ? column.header : column.id}`}>
      <div data-section="sort">
        <button
          type="button"
          role="menuitemradio"
          aria-checked={isSortedAsc}
          aria-disabled={!sortable}
          disabled={!sortable}
          title={sortDisabledTitle}
          data-active={isSortedAsc ? 'true' : undefined}
          data-testid={`${testId}-sort-asc`}
          onClick={() => onSort(column.id, 'asc')}
        >
          <span aria-hidden="true">↑</span>
          <span>A → Z（升序）</span>
        </button>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={isSortedDesc}
          aria-disabled={!sortable}
          disabled={!sortable}
          title={sortDisabledTitle}
          data-active={isSortedDesc ? 'true' : undefined}
          data-testid={`${testId}-sort-desc`}
          onClick={() => onSort(column.id, 'desc')}
        >
          <span aria-hidden="true">↓</span>
          <span>Z → A（降序）</span>
        </button>
        {sortable && isSorted && (
          <button
            type="button"
            role="menuitem"
            data-testid={`${testId}-sort-clear`}
            onClick={onClearSort}
          >
            <span aria-hidden="true">×</span>
            <span>清除排序</span>
          </button>
        )}
      </div>
      <div data-section-divider />
      {/* sub 1 HOTFIX：删除原 "data-section=kind" 三 radio（按值/按条件/按颜色）；
       *  只有"按值过滤"可用，radio + v2/v3 灰化语义不清；直接显示值列表更清晰。 */}
      <div data-section="value">
        {filterKind === 'enum' && (
          <EnumValueList
            column={column}
            rows={rows}
            pending={pending}
            setPending={setPending}
            distinctFetcher={distinctFetcher}
            testId={testId}
          />
        )}
        {filterKind === 'text' && (
          <TextValueInput pending={pending} setPending={setPending} testId={testId} />
        )}
        {filterKind === 'number' && (
          <NumberRangeInput pending={pending} setPending={setPending} testId={testId} />
        )}
        {filterKind === 'date' && (
          <DateRangeInput pending={pending} setPending={setPending} testId={testId} />
        )}
      </div>
      {onHide && (
        <>
          <div data-section-divider />
          <div data-section="hide">
            <button type="button" role="menuitem" data-testid={`${testId}-hide`} onClick={onHide}>
              <span aria-hidden="true">⊘</span>
              <span>隐藏此列</span>
            </button>
          </div>
        </>
      )}
      <div data-section-divider />
      <div data-actions>
        {pending !== undefined && (
          <button type="button" data-testid={`${testId}-clear`} onClick={handleClear}>清空</button>
        )}
        <span data-actions-spacer />
        <button type="button" data-testid={`${testId}-cancel`} onClick={onCancel}>取消</button>
        <button type="button" data-primary="true" data-testid={`${testId}-apply`} onClick={handleApply}>应用</button>
      </div>
    </div>
  )
}

// ── 段 3 / 4 种 filterKind 子组件 ────────────────────────────────────────

interface EnumValueListProps<T> {
  readonly column: FilterableColumn<T>
  readonly rows: readonly T[]
  readonly pending: FilterValue | undefined
  readonly setPending: (v: FilterValue | undefined) => void
  readonly distinctFetcher?: (table: string, field: string, q?: string) => Promise<readonly DistinctOption[]>
  readonly testId: string
}

function EnumValueList<T>(props: EnumValueListProps<T>): React.ReactElement {
  const { column, rows, pending, setPending, distinctFetcher, testId } = props
  const [search, setSearch] = useState('')
  const [fetched, setFetched] = useState<readonly DistinctOption[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | undefined>()

  const optionsFromRows = useMemo<readonly DistinctOption[]>(() => {
    // sub 2 EXTEND（2026-05-24）：filterOptions 空数组 truthy 不退化 BUG 修复
    // 消费方 enums 异步未加载完时传 filterOptions: [] → 旧版直接返回 [] / value-list 空 / 看似"灰"
    // 修复：length > 0 才采用 filterOptions / 否则退化到 fetched / rows 派生（与 distinctFetcher 路径一致）
    if (column.filterOptions && column.filterOptions.length > 0) return column.filterOptions
    if (fetched) return fetched
    // 阶段 2：无 filterOptions + 无 distinctFetcher 时退化为当前 rows distinct（页内推导 / D-150-1 简化）
    const set = new Map<string, number>()
    for (const r of rows) {
      const v = column.accessor(r)
      if (v === null || v === undefined) continue
      const s = String(v)
      set.set(s, (set.get(s) ?? 0) + 1)
    }
    return [...set.entries()].map(([value, count]) => ({ value, count }))
  }, [column, rows, fetched])

  useEffect(() => {
    if (column.filterOptions || !distinctFetcher || !column.filterDistinctTable) return
    const field = column.filterFieldName ?? column.id
    setFetching(true)
    setFetchError(undefined)
    distinctFetcher(column.filterDistinctTable, field, search || undefined)
      .then((r) => setFetched(r))
      .catch((e: unknown) => setFetchError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setFetching(false))
  }, [column, distinctFetcher, search])

  const visibleOptions = useMemo(() => {
    if (!search) return optionsFromRows
    const q = search.toLowerCase()
    return optionsFromRows.filter((o) => {
      const label = (o.label ?? o.value).toLowerCase()
      return label.includes(q) || o.value.toLowerCase().includes(q)
    })
  }, [optionsFromRows, search])

  const selectedSet = useMemo<ReadonlySet<string>>(() => {
    if (pending?.kind !== 'enum') return new Set()
    return new Set(pending.value)
  }, [pending])

  const toggleValue = (v: string) => {
    const next = new Set(selectedSet)
    if (next.has(v)) next.delete(v); else next.add(v)
    setPending(next.size === 0 ? undefined : { kind: 'enum', value: [...next] })
  }
  const selectAllVisible = () => {
    const next = new Set(selectedSet)
    for (const o of visibleOptions) next.add(o.value)
    setPending(next.size === 0 ? undefined : { kind: 'enum', value: [...next] })
  }
  const invertVisible = () => {
    const next = new Set(selectedSet)
    for (const o of visibleOptions) {
      if (next.has(o.value)) next.delete(o.value); else next.add(o.value)
    }
    setPending(next.size === 0 ? undefined : { kind: 'enum', value: [...next] })
  }

  return (
    <>
      <div data-search-box>
        <input
          type="search"
          placeholder="搜索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="搜索过滤选项"
          data-testid={`${testId}-search`}
        />
      </div>
      <div data-actions-row>
        <button type="button" data-testid={`${testId}-select-all`} onClick={selectAllVisible}>全选</button>
        <button type="button" data-testid={`${testId}-invert`} onClick={invertVisible}>反选</button>
      </div>
      {fetching && <div data-status>加载中…</div>}
      {fetchError && <div data-status data-error="true">{fetchError}</div>}
      <ul data-value-list data-testid={`${testId}-list`}>
        {visibleOptions.map((o) => {
          const checked = selectedSet.has(o.value)
          return (
            <li key={o.value}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleValue(o.value)}
                  data-testid={`${testId}-opt-${o.value}`}
                />
                <span>{o.label ?? o.value}</span>
                {o.count !== undefined && <span data-count> ({o.count})</span>}
              </label>
            </li>
          )
        })}
      </ul>
      <div data-count-tail>
        显示 {visibleOptions.length} / 共 {optionsFromRows.length} 项
      </div>
    </>
  )
}

interface TextValueInputProps {
  readonly pending: FilterValue | undefined
  readonly setPending: (v: FilterValue | undefined) => void
  readonly testId: string
}

function TextValueInput({ pending, setPending, testId }: TextValueInputProps): React.ReactElement {
  const value = pending?.kind === 'text' ? pending.value : ''
  return (
    <input
      type="text"
      data-text-input
      placeholder="包含…"
      value={value}
      onChange={(e) => {
        const v = e.target.value
        setPending(v ? { kind: 'text', value: v } : undefined)
      }}
      aria-label="文本过滤"
      data-testid={`${testId}-text-input`}
    />
  )
}

interface NumberRangeInputProps {
  readonly pending: FilterValue | undefined
  readonly setPending: (v: FilterValue | undefined) => void
  readonly testId: string
}

function NumberRangeInput({ pending, setPending, testId }: NumberRangeInputProps): React.ReactElement {
  const range = pending?.kind === 'range' ? pending : { min: undefined, max: undefined }
  const setRange = (patch: { min?: number; max?: number }) => {
    const min = patch.min !== undefined ? patch.min : range.min
    const max = patch.max !== undefined ? patch.max : range.max
    setPending(min === undefined && max === undefined ? undefined : { kind: 'range', min, max })
  }
  return (
    <div data-number-range>
      <input
        type="number"
        placeholder="最小"
        value={range.min ?? ''}
        onChange={(e) => setRange({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
        aria-label="范围最小值"
        data-testid={`${testId}-number-min`}
      />
      <span aria-hidden="true">—</span>
      <input
        type="number"
        placeholder="最大"
        value={range.max ?? ''}
        onChange={(e) => setRange({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
        aria-label="范围最大值"
        data-testid={`${testId}-number-max`}
      />
    </div>
  )
}

interface DateRangeInputProps {
  readonly pending: FilterValue | undefined
  readonly setPending: (v: FilterValue | undefined) => void
  readonly testId: string
}

function DateRangeInput({ pending, setPending, testId }: DateRangeInputProps): React.ReactElement {
  const range = pending?.kind === 'date-range' ? pending : { from: undefined, to: undefined }
  const setRange = (patch: { from?: string; to?: string }) => {
    const from = patch.from !== undefined ? (patch.from || undefined) : range.from
    const to = patch.to !== undefined ? (patch.to || undefined) : range.to
    setPending(from === undefined && to === undefined ? undefined : { kind: 'date-range', from, to })
  }
  return (
    <div data-date-range>
      <input
        type="date"
        value={range.from ?? ''}
        onChange={(e) => setRange({ from: e.target.value })}
        aria-label="日期范围起"
        data-testid={`${testId}-date-from`}
      />
      <span aria-hidden="true">→</span>
      <input
        type="date"
        value={range.to ?? ''}
        onChange={(e) => setRange({ to: e.target.value })}
        aria-label="日期范围止"
        data-testid={`${testId}-date-to`}
      />
    </div>
  )
}
