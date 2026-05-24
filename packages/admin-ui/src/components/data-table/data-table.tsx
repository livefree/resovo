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
  ColumnPreference,
} from './types'
import { DTStyles } from './dt-styles'
import { HeaderMenu } from './header-menu'
import { ViewsMenu } from './views-menu'
import { useRenderableSlot } from './react-node-utils'
import { PaginationFoot } from './pagination-foot'
// ADR-149 EP-3：hidden-columns-menu / filter-chips 已废弃删除，功能整合到 column-matrix-menu
import { setColumnVisibility, clearAllColumnFilters, resetColumnVisibility } from './column-visibility'
// ADR-149 EP-4.5 / D-149-16：矩阵触发器接入 DataTable 主组件
import { ColumnMatrixMenu } from './column-matrix-menu'

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
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  // CHG-UX-05d：bg 必须不透明（sticky 表头滚动时下方 row 不能穿透）；
  // 与 [data-table] 容器同色（surface-raised），视觉与 CHG-UI-05a 透明继承等效
  background: 'var(--bg-surface-raised)',
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
  fontSize: 'var(--font-size-sm-tight)',
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
    // @deprecated ADR-149 D-149-1：enableHeaderMenu 已废弃（EP-2 起 noop ignored，
    // 不从 props 解构中读取；消费方仍可传 true/false 不破 typecheck，多余 prop 被忽略）。
    // 列级 ⋯ 触发器由 columnTriggerVisibility 控制；EP-4-B 完全从类型中删除。
    // ADR-149 D-149-3：列级 ⋯ 触发器可见性（默认 'auto'：static + dynamic 5 条件 OR）
    columnTriggerVisibility = 'auto',
    // ADR-149 D-149-2 / AMENDMENT 2 D-149-16：矩阵触发器位置（默认 'toolbar-right'）
    // toolbar.hidden=true 时自动 fallback 到 'thead-right'（**当前 EP-4.5 仅实装 toolbar-right；
    // thead-right 推 N1-149-11**：0 消费方实测使用 toolbar.hidden=true / 无需阻塞 EP-4.5）
    headerMenuTriggerPosition = 'toolbar-right',
    toolbar,
    bulkActions,
    flashRowKeys,
    pagination,
    renderExpandedRow,
    expandedKeys,
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
  // ADR-149 EP-3：showHiddenColumnsChip 已删；hasToolbarContent 现在直接判定 3 槽位
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

  // ADR-149 EP-3：隐藏列 chip + popover 已删除（功能迁移到 column-matrix-menu）

  // ADR-149 EP-4.5 / D-149-16：矩阵触发器 popover 状态
  const [matrixOpen, setMatrixOpen] = useState(false)
  const matrixAnchorRef = useRef<HTMLButtonElement | null>(null)

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

  const rowHeight =
    density === 'compact' ? 'var(--row-h-compact)' :
    density === 'poster'  ? 'var(--row-h-poster)'  :
    'var(--row-h)'
  const hasSelection = selection !== undefined
  const gridTemplate = buildGridTemplate(columns, colMap, hasSelection)

  // sort helpers — ADR-149 D-149-4：列名点击二态互斥 asc ↔ desc（不可回 none / 业界范式）
  // 清除排序入口移到列级 ⋯ popover 「清除排序」按钮 + 矩阵 popover × 按钮
  const handleHeaderClick = useCallback((colId: string) => {
    const current = query.sort
    let next: TableSortState
    if (current.field === colId) {
      // 同列再点 → asc ↔ desc 互斥切换（不可回 none）
      next = { field: colId, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    } else {
      // 不同列 → 默认 asc
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

  // ADR-149 EP-3：hiddenColumnsCount / showHiddenColumnsChip / handleHiddenColsChange 已删除
  // 列可见性管理统一到 column-matrix-menu（EP-4.5 已接入矩阵触发器）

  // ADR-149 EP-4.5 / D-149-16 §(4)：ColumnMatrixMenu wiring
  // columnMenus map：从 columns 提取 columnMenu 配置（业务 key 桥接 D-149-15）
  const columnMenus = useMemo(
    () => new Map(columns.map((c) => [c.id, c.columnMenu ?? {}] as const)),
    [columns],
  )
  const handleMatrixColumnsChange = useCallback(
    (next: ReadonlyMap<string, ColumnPreference>) => {
      onQueryChange({ columns: next } satisfies TableQueryPatch)
    },
    [onQueryChange],
  )
  const handleMatrixClearColumnFilter = useCallback(
    (colId: string) => {
      const next = new Map(query.filters)
      next.delete(colId)
      onQueryChange({ filters: next } satisfies TableQueryPatch)
    },
    [query.filters, onQueryChange],
  )
  // ADR-149 D-149-16 §(5) BLOCKER R-AMEND-2-3：业务 key 桥接 clearAllColumnFilters
  // 优先调 columnMenu.onClearFilter（业务 key 自管），fallback 清空 column.id 命名空间
  const handleMatrixClearAllFilters = useCallback(
    () => {
      clearAllColumnFilters(
        columns,
        query.filters,
        (next) => onQueryChange({ filters: next } satisfies TableQueryPatch),
      )
    },
    [columns, query.filters, onQueryChange],
  )
  // ADR-149 D-149-16 §(6) R-AMEND-2-4：合并式 reset 保留 width
  const handleMatrixResetColumnVisibility = useCallback(
    () => {
      onQueryChange({
        columns: resetColumnVisibility(columns, query.columns),
      } satisfies TableQueryPatch)
    },
    [columns, query.columns, onQueryChange],
  )
  const handleMatrixClose = useCallback(() => setMatrixOpen(false), [])
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
      {/* CHG-DESIGN-02 Step 4 + ADR-149 EP-3/EP-4.5：内置 toolbar
        * 槽位顺序：search → viewsMenu → trailing → 矩阵触发器
        * ADR-149 D-149-14 三槽位职责闭合：viewsConfig + search + trailing
        * AMENDMENT 2 D-149-16 §(1)/§(2)：矩阵触发器永远渲染 / toolbar 容器永驻
        *   - 默认 headerMenuTriggerPosition='toolbar-right'：触发器渲染在 toolbar 内最右
        *   - toolbar.hidden=true → 强制 fallback 到 'thead-right'（thead 最右列后）
        * R-AMEND-2-1 修订：渲染条件改为 toolbar?.hidden !== true（不再 hasToolbarContent 守卫）
        * toolbar.hideHiddenColumnsChip / hideFilterChips props 保留 @deprecated noop（EP-6 删类型） */}
      {toolbar?.hidden !== true && (
        <div data-table-toolbar role="toolbar" aria-label="表格工具栏">
          {searchSlot.renderable && (
            <div data-table-toolbar-search>{searchSlot.node}</div>
          )}
          {hasViewsContent && toolbar?.viewsConfig && (
            <ViewsMenu config={toolbar.viewsConfig} data-testid="views-trigger" />
          )}
          {trailingSlot.renderable && (
            <div data-table-toolbar-trailing>{trailingSlot.node}</div>
          )}
          {/* ADR-149 D-149-16 §(3) R-AMEND-2-2：矩阵触发器（toolbar-right 默认）
            * 独立 [data-table-matrix-trigger] data attribute + 独立样式块（opacity:1 恒显）
            * 视觉与列级 ⋯ [data-th-menu-icon]（thead 内 opacity:0 hover 显隐）完全隔离 */}
          {headerMenuTriggerPosition === 'toolbar-right' && (
            <button
              ref={matrixAnchorRef}
              type="button"
              data-table-matrix-trigger
              data-active={matrixOpen ? 'true' : undefined}
              aria-haspopup="dialog"
              aria-expanded={matrixOpen}
              aria-label="表格设置"
              data-testid="matrix-trigger"
              onClick={() => setMatrixOpen((o) => !o)}
            >
              ⋯
            </button>
          )}
        </div>
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
            const sortable = col.enableSorting === true
            // ADR-149 D-149-3 R-149-2：列级 ⋯ 触发器可见性判定
            // auto（默认）= static + dynamic 5 条件 OR：
            //   可排序 OR 有 filterContent OR 可隐藏（非 pinned + canHide !== false）
            //   OR 当前已过滤 OR 当前已排序
            const hasFilter = col.columnMenu?.filterContent !== undefined
            const hidable = col.pinned !== true && col.columnMenu?.canHide !== false
            const isFiltered = col.columnMenu?.isFiltered === true || query.filters.has(col.id)
            const isMenuOpen = menuColId === col.id
            const showTrigger =
              columnTriggerVisibility === 'always' ? true :
              columnTriggerVisibility === 'never' ? false :
              sortable || hasFilter || hidable || isFiltered || isSorted
            // 列名整体可点 → toggle 排序（如该列可排序）
            const interactive = sortable
            return (
              <div
                key={col.id}
                role="columnheader"
                aria-sort={isSorted ? (query.sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                data-th-interactive={interactive ? 'true' : undefined}
                style={{ ...TH_STYLE, cursor: interactive ? 'pointer' : 'default' }}
                tabIndex={interactive ? 0 : undefined}
                onClick={interactive ? () => handleHeaderClick(col.id) : undefined}
                onKeyDown={interactive ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHeaderClick(col.id) }
                } : undefined}
              >
                {col.header}
                {sortable && <SortIcon direction={sortDir} />}
                {showTrigger && (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    aria-label={`${typeof col.header === 'string' ? col.header : col.id} 列操作`}
                    data-th-menu-icon
                    data-open={isMenuOpen ? 'true' : undefined}
                    data-active={isSorted || isFiltered ? 'true' : undefined}
                    data-testid={`th-menu-trigger-${col.id}`}
                    onClick={(e) => {
                      // ADR-149 D-149-3 R-149-6：必须 stopPropagation 防冒泡到列名 toggle 排序
                      e.stopPropagation()
                      menuAnchorRef.current = e.currentTarget
                      setMenuColId(col.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        e.preventDefault()
                        menuAnchorRef.current = e.currentTarget
                        setMenuColId(col.id)
                      }
                    }}
                  >⋯</button>
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
          const isExpanded = expandedKeys?.has(key) ?? false
          return (
            <React.Fragment key={key}>
              <div
                role="row"
                aria-selected={selection?.selectedKeys.has(key)}
                aria-expanded={renderExpandedRow ? isExpanded : undefined}
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
              {isExpanded && renderExpandedRow && (
                <div data-table-expand-panel role="region" aria-label={`展开行 ${key}`}>
                  {renderExpandedRow(row)}
                </div>
              )}
            </React.Fragment>
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
      {/* HeaderMenu portal — 渲染到 document.body，不参与 frame layout
       *  ADR-149 D-149-3：列级 ⋯ button 触发，anchor = ⋯ button（非 th div） */}
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
      {/* ADR-149 EP-4.5 / D-149-16：矩阵 popover portal 挂载（无 confirm / 即时生效）
        * wiring 完全对接 EP-1 ColumnMatrixMenu 14 个 props；业务 key 桥接走
        * columnMenus map（D-149-15 / line 320-321 已实装） */}
      <ColumnMatrixMenu
        open={matrixOpen}
        columns={columns}
        columnMenus={columnMenus}
        columnsValue={colMap}
        currentSort={query.sort}
        currentFilters={query.filters}
        anchorRef={matrixAnchorRef}
        onColumnsChange={handleMatrixColumnsChange}
        onClearColumnFilter={handleMatrixClearColumnFilter}
        onSort={handleHeaderMenuSort}
        onClearSort={handleHeaderMenuClearSort}
        onClearAllFilters={handleMatrixClearAllFilters}
        onResetColumnVisibility={handleMatrixResetColumnVisibility}
        onClose={handleMatrixClose}
      />
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
