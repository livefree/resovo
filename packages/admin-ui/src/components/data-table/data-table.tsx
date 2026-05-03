'use client'

/**
 * data-table.tsx — DataTable v2 基座组件
 * 真源：ADR-103 §4.1 + §4.3（CHG-SN-2-13）
 *
 * 职责：渲染列/行/sticky header/hover/选区/sort indicator/两档分页（client/server）。
 * 不做：不内置 Toolbar/Pagination/ColumnSettingsPanel；不持有数据；不发请求。
 * client mode：内部 filter + sort + paginate；server mode：直接渲染 rows（当前页）。
 */
import React, { useState, useCallback, useMemo, useRef } from 'react'
import type {
  DataTableProps,
  TableColumn,
  FilterValue,
  TableQueryPatch,
  TableSortState,
} from './types'
import { DTStyles } from './dt-styles'
import { HeaderMenu } from './header-menu'
import { ViewsMenu } from './views-menu'
import { useRenderableSlot } from './react-node-utils'
import { PaginationFoot } from './pagination-foot'
import { HiddenColumnsMenu } from './hidden-columns-menu'
import { countHiddenColumns, setColumnVisibility } from './column-visibility'
import { FilterChips } from './filter-chips'

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
  background: 'transparent',
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
    enableHeaderMenu = false,
    toolbar,
    bulkActions,
    flashRowKeys,
    pagination,
  } = props

  // CHG-DESIGN-02 Step 4：toolbar 渲染门控
  // 每个 ReactNode slot 必须用 useRenderableSlot 检测，避免 null / false / [] /
  // 空 iterable 等合法但渲染为空的 ReactNode 触发空 toolbar 容器（Step 4 fix#）
  // useRef cache 同时处理 single-use iterable（generator）的物化
  const searchSlot = useRenderableSlot(toolbar?.search)
  const trailingSlot = useRenderableSlot(toolbar?.trailing)
  // viewsConfig 是 ViewsConfig 对象（非 ReactNode），缺省即 undefined；
  // 提供时 ViewsMenu 始终渲染触发按钮（"视图 · {label} ▾"），故 viewsConfig 提供
  // 即视为有内容
  const hasViewsContent = toolbar?.viewsConfig !== undefined
  // 注：showHiddenColumnsChip 在下方依赖 colMap 计算后才声明，故此处 toolbar 渲染门控
  // 计算时不能直接引用；改为在 JSX 中根据 (... || showHiddenColumnsChip) 决定显式包裹。
  const hasToolbarContent = (
    searchSlot.renderable || trailingSlot.renderable || hasViewsContent
  )

  // CHG-DESIGN-02 Step 5：bulk bar 渲染门控
  // 仅当 bulkActions 可渲染 + selection 非空时显示
  const bulkSlot = useRenderableSlot(bulkActions)
  const selectedCount = selection?.selectedKeys.size ?? 0
  const shouldRenderBulkBar = bulkSlot.renderable && selectedCount > 0

  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  // 表头菜单 popover 状态（仅 enableHeaderMenu=true 时使用）
  const [menuColId, setMenuColId] = useState<string | null>(null)
  const menuAnchorRef = useRef<HTMLElement | null>(null)

  // CHG-DESIGN-02 Step 7A：隐藏列 chip popover 状态
  const [hiddenColsOpen, setHiddenColsOpen] = useState(false)
  const hiddenColsAnchorRef = useRef<HTMLButtonElement | null>(null)

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

  // header menu callbacks
  const handleHeaderMenuSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    onQueryChange({ sort: { field, direction } } satisfies TableQueryPatch)
  }, [onQueryChange])
  const handleHeaderMenuClearSort = useCallback(() => {
    onQueryChange({ sort: { field: undefined, direction: 'asc' } } satisfies TableQueryPatch)
  }, [onQueryChange])
  const handleHeaderMenuHide = useCallback((colId: string) => {
    onQueryChange({ columns: setColumnVisibility(colMap, colId, false) } satisfies TableQueryPatch)
  }, [colMap, onQueryChange])

  // CHG-DESIGN-02 Step 7A：隐藏列 chip 渲染门控 + 计数
  const hiddenColumnsCount = useMemo(
    () => countHiddenColumns(columns, colMap),
    [columns, colMap],
  )
  const showHiddenColumnsChip =
    toolbar?.hideHiddenColumnsChip !== true && hiddenColumnsCount > 0

  const handleHiddenColsChange = useCallback(
    (next: ReadonlyMap<string, { readonly visible: boolean; readonly width?: number }>) => {
      onQueryChange({ columns: next } satisfies TableQueryPatch)
    },
    [onQueryChange],
  )
  const closeHeaderMenu = useCallback(() => {
    setMenuColId(null)
    menuAnchorRef.current = null
  }, [])

  const menuColumn = useMemo(
    () => (menuColId ? columns.find((c) => c.id === menuColId) ?? null : null),
    [menuColId, columns],
  )

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
        ? 'var(--admin-accent-soft)'
        : isHovered
          ? 'var(--bg-surface-row)'
          : 'transparent',
      cursor: onRowClick ? 'pointer' : 'default',
      transition: 'background var(--duration-fast) var(--easing-ease-out)',
    }
  }

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selection?.selectedKeys.has(rowKey(r)))
  const somePageSelected = !allPageSelected && pageRows.some((r) => selection?.selectedKeys.has(rowKey(r)))

  return (
    <div
      data-table
      data-testid={testId}
      role="grid"
      // CHG-DESIGN-02 Step 7B fix#2（Codex review）：frame 不承担滚动
      // 横向 + 纵向滚动统一发到内部 [data-table-scroll] 单一 viewport，避免
      // 横纵滚动容器分裂导致垂直滚动条随 scrollLeft 漂移。frame 自身保持
      // overflow:hidden（dt-styles 注入）+ flex column 语义。
      style={{ position: 'relative' }}
      aria-label="data table"
      aria-rowcount={effectiveTotalRows}
    >
      {/* CHG-DESIGN-02 Step 2/7：自包含 CSS 注入（framed surface + flash keyframe）
        * 模块级 flag 守卫，多个 DataTable 实例只注入一次 */}
      <DTStyles />
      {/* CHG-DESIGN-02 Step 4 + Step 7A：内置 toolbar
        * 槽位顺序：search → viewsMenu → 隐藏列 chip（Step 7A）→ trailing
        * toolbar.hidden=true 显式抑制；否则只要任一槽位有内容就渲染 toolbar 容器 */}
      {toolbar?.hidden !== true && (hasToolbarContent || showHiddenColumnsChip) && (
        <div data-table-toolbar role="toolbar" aria-label="表格工具栏">
          {searchSlot.renderable && (
            <div data-table-toolbar-search>{searchSlot.node}</div>
          )}
          {hasViewsContent && toolbar?.viewsConfig && (
            <ViewsMenu config={toolbar.viewsConfig} data-testid="views-trigger" />
          )}
          {showHiddenColumnsChip && (
            <button
              ref={hiddenColsAnchorRef}
              type="button"
              data-table-toolbar-hidden-cols-chip
              data-interactive="chip"
              aria-haspopup="menu"
              aria-expanded={hiddenColsOpen}
              onClick={() => setHiddenColsOpen((o) => !o)}
              data-testid="hidden-columns-chip"
            >
              已隐藏 <em>{hiddenColumnsCount}</em> 列
            </button>
          )}
          {trailingSlot.renderable && (
            <div data-table-toolbar-trailing>{trailingSlot.node}</div>
          )}
        </div>
      )}
      <HiddenColumnsMenu
        open={hiddenColsOpen}
        columns={columns}
        columnsValue={colMap}
        anchorRef={hiddenColsAnchorRef}
        onColumnsChange={handleHiddenColsChange}
        onClose={() => setHiddenColsOpen(false)}
      />
      {/* CHG-DESIGN-02 Step 7A：filter chips slot（独立第二 flex row，避开与 toolbar 同行 wrap 抖动）
        * 自动从 query.filters + columns 配对渲染；6 种 FilterValue.kind 默认 formatter；
        * column.renderFilterChip 完全接管逃生口；toolbar.hideFilterChips 兜底关闭。 */}
      {toolbar?.hideFilterChips !== true && (
        <FilterChips columns={columns} filters={query.filters} onChange={onQueryChange} />
      )}
      {/* CHG-DESIGN-02 Step 7B fix#2：单一 scrollport 容器
        * 横向 + 纵向滚动统一在 [data-table-scroll] 容器内发生，thead/body/bulk
        * 共享同一 scrollLeft；foot 留在 frame 直接子层（不进 scrollport），永远
        * 固定在底部不随横向滚动漂移。 */}
      <div data-table-scroll role="presentation">
      {/* sticky header */}
      <div
        role="rowgroup"
        style={{ position: 'sticky', top: 0, zIndex: 1 }}
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
            // enableHeaderMenu=true 时点击表头开 popover；否则保持原 sort-on-click
            const interactive = enableHeaderMenu || sortable
            const onHeaderActivate = (target: HTMLElement) => {
              if (enableHeaderMenu) {
                menuAnchorRef.current = target
                setMenuColId(col.id)
              } else if (sortable) {
                handleHeaderClick(col.id)
              }
            }
            const isMenuOpen = menuColId === col.id
            return (
              <div
                key={col.id}
                role="columnheader"
                aria-sort={isSorted ? (query.sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                aria-haspopup={enableHeaderMenu ? 'menu' : undefined}
                aria-expanded={enableHeaderMenu ? isMenuOpen : undefined}
                data-interactive={interactive ? 'icon' : undefined}
                style={{ ...TH_STYLE, cursor: interactive ? 'pointer' : 'default' }}
                tabIndex={interactive ? 0 : undefined}
                onClick={interactive ? (e) => onHeaderActivate(e.currentTarget) : undefined}
                onKeyDown={interactive ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHeaderActivate(e.currentTarget) }
                } : undefined}
              >
                {col.header}
                {sortable && <SortIcon direction={sortDir} />}
                {enableHeaderMenu && (
                  <span
                    aria-hidden="true"
                    style={{ marginLeft: '4px', opacity: isMenuOpen ? 1 : 0.45, fontSize: '12px', color: 'var(--fg-muted)' }}
                  >⋯</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* body — CHG-DESIGN-02 Step 7B fix#2：纵向滚动由父级 [data-table-scroll]
        * 承担，本 wrapper 仅作 row 容器（保留 [data-table-body] 标记供测试 / 选择器
        * 引用）；不再独立 overflow-y / flex / min-height。 */}
      <div role="rowgroup" data-table-body>
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
          const isFlashing = flashRowKeys?.has(key) ?? false
          return (
            <div
              key={key}
              role="row"
              aria-selected={selection?.selectedKeys.has(key)}
              data-flash={isFlashing ? 'true' : undefined}
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
      {/* CHG-DESIGN-02 Step 5/7 + 7B fix#3：bulk action bar 在 frame 直接子层
        * 上一轮（fix#2）把 bulk bar 留在 [data-table-scroll] 内 + sticky bottom，
        * 但 sticky 元素只在"自然位置接近 viewport 底部时"才贴底；长表 rows >>
        * viewport 时 bulk bar 自然位置远在 viewport 下方，导致 buried below
        * （Codex stop-time review fix#3）。
        *
        * 修复：bulk bar 与 foot 同样作 frame 直接子层（脱离 scroll 内容流），
        * frame flex column 内永远占 foot 之上一行 flex-shrink:0 slot；selection=0
        * 时不渲染。bulk bar 内容（已选 N 项 + 批量操作）与列宽 / scrollLeft
        * 无关，无需进入 scrollport 同步。 */}
      {shouldRenderBulkBar && (
        <div data-table-bulk role="region" aria-label="批量操作">
          <span data-table-bulk-count>
            已选 <em>{selectedCount}</em> 项
          </span>
          <span data-table-bulk-sep aria-hidden="true" />
          <div data-table-bulk-actions>{bulkSlot.node}</div>
          <span style={{ flex: 1 }} aria-hidden="true" />
          <button
            type="button"
            data-table-bulk-clear
            data-interactive="chip"
            onClick={() => onSelectionChange?.({ selectedKeys: new Set(), mode: selection?.mode ?? 'page' })}
          >
            清除选择
          </button>
        </div>
      )}
      {/* HeaderMenu portal — 渲染到 document.body，不参与 frame layout */}
      {enableHeaderMenu && (
        <HeaderMenu
          open={menuColId !== null}
          column={menuColumn}
          columnMenu={menuColumn?.columnMenu}
          anchorRef={menuAnchorRef}
          currentSort={query.sort}
          columnsValue={colMap}
          onSort={handleHeaderMenuSort}
          onClearSort={handleHeaderMenuClearSort}
          onHide={handleHeaderMenuHide}
          onClose={closeHeaderMenu}
        />
      )}
      {/* CHG-DESIGN-02 Step 7A + 7B fix#2/3：foot 在 [data-table-scroll] 之外，
        * frame 直接子层最末位，永远固定 frame 底部，不随 body 横向滚动漂移。 */}
      <PaginationFoot
        config={pagination}
        page={query.pagination.page}
        pageSize={query.pagination.pageSize}
        total={effectiveTotalRows}
        selectedCount={selectedCount}
        onChange={onQueryChange}
      />
    </div>
  )
}
