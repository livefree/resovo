'use client'

/**
 * data-table.tsx — DataTable v2 基座组件
 * 真源：ADR-103 §4.1 + §4.3（CHG-SN-2-13）
 *
 * 职责：编排列/行/sticky header/hover/选区/sort indicator/两档分页（client/server）。
 * 不做：不内置 Toolbar/Pagination/ColumnSettingsPanel；不持有数据；不发请求。
 * client mode：内部 filter + sort + paginate；server mode：直接渲染 rows（当前页）。
 *
 * DTR-A（SEQ-20260531-01）文件体积预拆：
 *   - client filter/sort → ./client-data-ops
 *   - 网格模板 + cell 样式原语 → ./data-table-grid
 *   - sticky 表头行 → ./data-table-header-row
 *   - 行渲染 rowgroup → ./data-table-body
 */
import React, { useState, useCallback, useMemo, useRef } from 'react'
import type {
  DataTableProps,
  FilterableColumn,
  TableQueryPatch,
  TableSortState,
  ColumnPreference,
} from './types'
import { DTStyles } from './dt-styles'
import { HeaderMenu } from './header-menu'
import { DataTableAutoFilter } from './data-table-auto-filter'
import { ViewsMenu } from './views-menu'
import { useRenderableSlot } from './react-node-utils'
import { PaginationFoot } from './pagination-foot'
// ADR-149 EP-3：hidden-columns-menu / filter-chips 已废弃删除，功能整合到 column-matrix-menu
import { setColumnVisibility, clearAllColumnFilters, resetColumnVisibility } from './column-visibility'
// ADR-149 EP-4.5 / D-149-16：矩阵触发器接入 DataTable 主组件
import { ColumnMatrixMenu } from './column-matrix-menu'
// DTR-A 文件体积预拆抽出
import { applyClientFilters, applyClientSort } from './client-data-ops'
import { buildGridTemplate } from './data-table-grid'
import { DataTableHeaderRow } from './data-table-header-row'
import { DataTableBody } from './data-table-body'
// DTR-B 列宽可调控制器（仅 enableColumnResizing 路径生效）
import { useColumnResizeController } from './use-column-resize'

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
    // DTR-B：表级列宽可调静态门控（默认 false / 现有消费方零回归）
    enableColumnResizing,
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

  // DTR-B 列宽可调（C1：静态门控，只读 props 字面值，不依赖可见列）。
  // 控制器集中持有 resize 接线（rootRef/rootStyle/headerContext）；legacy 路径走
  // buildGridTemplate 字面模板（C2 不引 CSS 变量），resize 路径 rows 用 var(--dt-grid-template)。
  const resizeEnabled = enableColumnResizing === true
  const resize = useColumnResizeController<T>({ enabled: resizeEnabled, columns, colMap, hasSelection, onQueryChange })
  const gridColumnsValue = resizeEnabled ? 'var(--dt-grid-template)' : buildGridTemplate(columns, colMap, hasSelection)

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

  // 打开列级 ⋯ popover（anchor = ⋯ button，非 th div）
  const handleOpenColumnMenu = useCallback((colId: string, anchorEl: HTMLElement) => {
    menuAnchorRef.current = anchorEl
    setMenuColId(colId)
  }, [])

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
      gridTemplateColumns: gridColumnsValue,
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
      // DTR-B：resize 路径挂 rootRef + `--dt-grid-template` CSS 变量（拖拽命令式改一处，
      // thead/body 各行 gridTemplateColumns 同用 var() 全行对齐）；ref 常挂无副作用。
      ref={resize.rootRef}
      // CHG-DESIGN-02 Step 7B fix#2（Codex review）：frame 不承担滚动
      // 横向 + 纵向滚动统一发到内部 [data-table-scroll] 单一 viewport，避免
      // 横纵滚动容器分裂导致垂直滚动条随 scrollLeft 漂移。frame 自身保持
      // overflow:hidden（dt-styles 注入）+ flex column 语义。
      // rootStyle = position:relative（+ resize 时 --dt-grid-template CSS 变量初值）。
      style={resize.rootStyle}
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
        {/* sticky header（DTR-A 抽至 DataTableHeaderRow）*/}
        <DataTableHeaderRow
          gridTemplate={gridColumnsValue}
          rowHeight={rowHeight}
          hasSelection={hasSelection}
          allPageSelected={allPageSelected}
          somePageSelected={somePageSelected}
          onSelectAll={handleSelectAll}
          visibleColumns={visibleColumns}
          sort={query.sort}
          filters={query.filters}
          columnTriggerVisibility={columnTriggerVisibility}
          openMenuColId={menuColId}
          onOpenMenu={handleOpenColumnMenu}
          onHeaderClick={handleHeaderClick}
          resize={resize.headerContext}
        />

        {/* body（DTR-A 抽至 DataTableBody）*/}
        <DataTableBody
          loading={loading}
          error={error}
          emptyState={emptyState}
          pageRows={pageRows}
          rowKey={rowKey}
          hasSelection={hasSelection}
          selection={selection}
          visibleColumns={visibleColumns}
          rowStyle={rowStyle}
          onRowHover={setHoveredKey}
          onSelectRow={handleSelectRow}
          onRowClick={onRowClick}
          flashRowKeys={flashRowKeys}
          expandedKeys={expandedKeys}
          renderExpandedRow={renderExpandedRow}
          resizeEnabled={resizeEnabled}
        />
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
       *  ADR-149 D-149-3：列级 ⋯ button 触发，anchor = ⋯ button（非 th div）
       *  ADR-150 阶段 2 / EP-1 Step 4：双范式 — menuColumn.filterable === true 时
       *  注入 DataTableAutoFilter 整段替换；否则走原 sort + columnMenu.filterContent slot + hide */}
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
        autoFilterContent={(() => {
          if (menuColumn === null) return undefined
          // AMD2 D-150-AMD2-1/2/8：kind === 'action' 不弹 popover / 'data' 默认 filterable + 显式 false 可禁用
          // / 'media' + 'computed' 默认 false / 显式 true 启用
          const kind = menuColumn.kind ?? 'data'
          if (kind === 'action') return undefined
          const explicitFilterable = (menuColumn as { filterable?: boolean }).filterable
          const effectiveFilterable = kind === 'data'
            ? explicitFilterable !== false  // data 默认 true / 显式 false 禁用
            : explicitFilterable === true   // media/computed 默认 false / 显式 true 启用
          if (!effectiveFilterable) return undefined
          const col = menuColumn
          // AMD2 D-150-AMD2-3：filterFieldName fallback column.id（D-150-4 桥接降级为覆盖语义）
          const key = (col as { filterFieldName?: string }).filterFieldName ?? col.id
          const autoFilterRows = mode === 'client' ? processedRows : pageRows
          // 显式 cast：AMD2 union narrow 后 filterable 仍为 boolean / FilterableColumn 入口需 filterable: true
          const filterableCol = col as unknown as FilterableColumn<T>
          return (
            <DataTableAutoFilter
              column={filterableCol}
              rows={autoFilterRows}
              currentFilter={query.filters.get(key)}
              onApply={(value) => {
                const next = new Map(query.filters)
                if (value === undefined) next.delete(key); else next.set(key, value)
                onQueryChange({ filters: next } satisfies TableQueryPatch)
                closeHeaderMenu()
              }}
              onCancel={closeHeaderMenu}
              currentSort={query.sort}
              onSort={handleHeaderMenuSort}
              onClearSort={handleHeaderMenuClearSort}
              onHide={col.pinned === true ? undefined : () => { handleHeaderMenuHide(col.id); closeHeaderMenu() }}
              // HOTFIX-PATCH-2B（2026-05-25）：distinct 端点 fetcher 透传（arch-reviewer Opus A- D1）
              distinctFetcher={props.distinctFetcher}
            />
          )
        })()}
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
        onResetColumnWidths={resizeEnabled ? resize.resetAllWidths : undefined}
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
