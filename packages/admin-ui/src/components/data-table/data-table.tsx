/**
 * data-table.tsx — DataTable v2 基座组件
 * 真源：ADR-103 §4.1 + §4.3（CHG-SN-2-13）
 *
 * 职责：渲染列/行/sticky header/hover/选区/sort indicator/两档分页（client/server）。
 * 不做：不内置 Toolbar/Pagination/ColumnSettingsPanel；不持有数据；不发请求。
 * client mode：内部 filter + sort + paginate；server mode：直接渲染 rows（当前页）。
 */
import React, { useState, useCallback, useMemo } from 'react'
import type {
  DataTableProps,
  TableColumn,
  FilterValue,
  TableQueryPatch,
  TableSortState,
} from './types'

// ── client-mode data processing ──────────────────────────────────

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

function applyClientFilters<T>(
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

function applyClientSort<T>(
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

// ── style helpers ─────────────────────────────────────────────────

const SELECTION_COL_W = 40

function buildGridTemplate<T>(
  columns: readonly TableColumn<T>[],
  colMap: ReadonlyMap<string, { visible: boolean; width?: number }>,
  hasSelection: boolean,
): string {
  const tracks: string[] = []
  if (hasSelection) tracks.push(`${SELECTION_COL_W}px`)
  for (const col of columns) {
    const pref = colMap.get(col.id)
    if (pref ? !pref.visible && !col.pinned : col.defaultVisible === false && !col.pinned) continue
    const width = pref?.width ?? col.width
    tracks.push(width ? `${width}px` : `minmax(${col.minWidth ?? 80}px, 1fr)`)
  }
  return tracks.join(' ')
}

const TH_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '0 12px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  background: 'var(--bg-surface-elevated)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'default',
  userSelect: 'none',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

const TD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  fontSize: '13px',
  color: 'var(--fg-default)',
  borderBottom: '1px solid var(--border-subtle)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

// ── sort indicator (inline SVG) ───────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | 'none' }) {
  const color = direction === 'none' ? 'var(--fg-muted)' : 'var(--fg-default)'
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
      <path
        d="M5 1L2 4H8L5 1Z"
        fill={direction === 'asc' ? color : 'var(--fg-muted)'}
        opacity={direction === 'none' ? 0.4 : 1}
      />
      <path
        d="M5 11L2 8H8L5 11Z"
        fill={direction === 'desc' ? color : 'var(--fg-muted)'}
        opacity={direction === 'none' ? 0.4 : 1}
      />
    </svg>
  )
}

// ── DataTable component ───────────────────────────────────────────

export function DataTable<T>(props: DataTableProps<T>): React.ReactElement {
  const {
    rows,
    columns,
    rowKey,
    mode,
    query,
    onQueryChange,
    totalRows,
    loading,
    error,
    emptyState,
    selection,
    onSelectionChange,
    onRowClick,
    density = 'comfortable',
    'data-testid': testId,
  } = props

  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const colMap = query.columns

  // visible columns (pinned always included)
  const visibleColumns = useMemo(
    () => columns.filter((c) => {
      const pref = colMap.get(c.id)
      if (c.pinned) return true
      return pref !== undefined ? pref.visible : c.defaultVisible !== false
    }),
    [columns, colMap],
  )

  // client-mode processed rows
  const processedRows = useMemo(() => {
    if (mode === 'server') return rows
    const filtered = applyClientFilters(rows, columns, query.filters)
    const sorted = applyClientSort(filtered, columns, query.sort)
    return sorted
  }, [mode, rows, columns, query.filters, query.sort])

  // client pagination
  const pageRows = useMemo(() => {
    if (mode === 'server') return processedRows
    const { page, pageSize } = query.pagination
    const start = (page - 1) * pageSize
    return processedRows.slice(start, start + pageSize)
  }, [mode, processedRows, query.pagination])

  const effectiveTotalRows = mode === 'server'
    ? (totalRows ?? rows.length)
    : processedRows.length

  const rowHeight = density === 'compact' ? 'var(--row-h-compact)' : 'var(--row-h)'
  const hasSelection = selection !== undefined
  const gridTemplate = buildGridTemplate(columns, colMap, hasSelection)

  // sort helpers
  const handleHeaderClick = useCallback((colId: string) => {
    const current = query.sort
    let next: TableSortState
    if (current.field === colId) {
      next = current.direction === 'asc'
        ? { field: colId, direction: 'desc' }
        : { field: undefined, direction: 'asc' }
    } else {
      next = { field: colId, direction: 'asc' }
    }
    onQueryChange({ sort: next } satisfies TableQueryPatch)
  }, [query.sort, onQueryChange])

  // selection helpers
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return
    const allKeys = pageRows.map((r) => rowKey(r))
    const allSelected = allKeys.every((k) => selection?.selectedKeys.has(k))
    onSelectionChange({
      selectedKeys: new Set(allSelected ? [] : allKeys),
      mode: 'page',
    })
  }, [pageRows, rowKey, selection, onSelectionChange])

  const handleSelectRow = useCallback((key: string) => {
    if (!onSelectionChange || !selection) return
    const next = new Set(selection.selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange({ selectedKeys: next, mode: selection.mode })
  }, [selection, onSelectionChange])

  const rowStyle = (key: string): React.CSSProperties => {
    const isSelected = selection?.selectedKeys.has(key) ?? false
    const isHovered = hoveredKey === key
    return {
      display: 'grid',
      gridTemplateColumns: gridTemplate,
      height: rowHeight,
      background: isSelected
        ? 'var(--accent-subtle)'
        : isHovered
          ? 'var(--bg-subtle)'
          : 'transparent',
      cursor: onRowClick ? 'pointer' : 'default',
      transition: 'background 80ms',
    }
  }

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selection?.selectedKeys.has(rowKey(r)))
  const somePageSelected = !allPageSelected && pageRows.some((r) => selection?.selectedKeys.has(rowKey(r)))

  return (
    <div
      data-table
      data-testid={testId}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', position: 'relative' }}
      aria-label="data table"
      aria-rowcount={effectiveTotalRows}
    >
      {/* sticky header */}
      <div
        role="rowgroup"
        style={{ position: 'sticky', top: 0, zIndex: 1, flexShrink: 0 }}
      >
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            height: rowHeight,
          }}
        >
          {hasSelection && (
            <div role="columnheader" style={{ ...TH_STYLE, justifyContent: 'center' }}>
              <input
                type="checkbox"
                checked={allPageSelected}
                ref={(el) => { if (el) el.indeterminate = somePageSelected }}
                onChange={handleSelectAll}
                aria-label="全选当前页"
              />
            </div>
          )}
          {visibleColumns.map((col) => {
            const isSorted = query.sort.field === col.id
            const sortDir = isSorted ? query.sort.direction : 'none'
            const sortable = col.enableSorting
            return (
              <div
                key={col.id}
                role="columnheader"
                aria-sort={isSorted ? (query.sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                style={{ ...TH_STYLE, cursor: sortable ? 'pointer' : 'default' }}
                onClick={sortable ? () => handleHeaderClick(col.id) : undefined}
              >
                {col.header}
                {sortable && <SortIcon direction={sortDir} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* body */}
      <div role="rowgroup" style={{ flex: 1 }}>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-muted)' }}>
            加载中…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--state-error-fg)' }}>
            {error.message}
          </div>
        )}
        {!loading && !error && pageRows.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-muted)' }}>
            {emptyState ?? '暂无数据'}
          </div>
        )}
        {!loading && !error && pageRows.map((row, idx) => {
          const key = rowKey(row)
          return (
            <div
              key={key}
              role="row"
              aria-selected={selection?.selectedKeys.has(key)}
              style={rowStyle(key)}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => onRowClick?.(row, idx)}
            >
              {hasSelection && (
                <div role="cell" style={{ ...TD_STYLE, justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selection?.selectedKeys.has(key) ?? false}
                    onChange={() => handleSelectRow(key)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`选择行 ${key}`}
                  />
                </div>
              )}
              {visibleColumns.map((col) => {
                const value = col.accessor(row)
                const content = col.cell
                  ? col.cell({ row, value, rowIndex: idx })
                  : String(value ?? '')
                return (
                  <div
                    key={col.id}
                    role="cell"
                    style={{
                      ...TD_STYLE,
                      ...(col.overflowVisible ? { overflow: 'visible' } : {}),
                    }}
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
