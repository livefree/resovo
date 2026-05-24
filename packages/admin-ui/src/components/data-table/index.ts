/**
 * data-table/index.ts — DataTable v2 公开 API 桶导出（CHG-SN-2-13）
 * 真源：ADR-103 §4.1 + §4.2（影响文件列表）
 */

// Components
export { DataTable } from './data-table'
export { Toolbar } from './toolbar'
export { SelectionActionBar } from './selection-action-bar'
export type { SelectionActionBarProps, SelectionAction } from './selection-action-bar'
export type { ToolbarProps } from './toolbar'
// ADR-149 EP-3 / D-149-11：FilterChip + FilterChipBar 保留为业务独立组件
// （VideoListClient + components-demo 在用；矩阵 popover 不直接消费这两个组件）
export { FilterChip, FilterChipBar } from './filter-chip'
export type { FilterChipProps, FilterChipBarProps } from './filter-chip'
export { ColumnSettingsPanel } from './column-settings-panel'
export type { ColumnSettingsPanelProps } from './column-settings-panel'
// ADR-149 / CHG-SN-9-DT-HEADER-REDESIGN-EP-1 — 统一矩阵 popover
export { ColumnMatrixMenu } from './column-matrix-menu'
export type { ColumnMatrixMenuProps } from './column-matrix-menu'
// ADR-149 D-149-8 + AMENDMENT 1 D-149-13 / CHG-SN-9-DT-HEADER-REDESIGN-EP-4 — search input 原语（IME + debounce + Enter 立即）
export { DataTableSearchInput } from './search-input'
export type { DataTableSearchInputProps } from './search-input'

// Hook
export { useTableQuery } from './use-table-query'

// Store（server-next 应用层禁止直接消费；仅供特殊测试场景访问）
export { tableQueryStore, buildDefaultSnapshot, applyPatch } from './table-query-store'
export type { TableQueryStoreApi } from './table-query-store'

// Pure sync utils（供 server-next lib/table-router-adapter 等使用）
export { snapshotToSearchParams, searchParamsToSnapshot } from './url-sync'
export { readFromStorage, writeToStorage, storedPrefsToColumnMap } from './storage-sync'
export type { StoredPrefs } from './storage-sync'

// All types
export type {
  DataTableProps,
  TableColumn,
  TableCellContext,
  TableSortState,
  TableSelectionState,
  ColumnMenuConfig,
  ColumnDescriptor,
  UseTableQueryOptions,
  TableRouterAdapter,
  TableQuerySnapshot,
  TableQueryPatch,
  ColumnPreference,
  FilterValue,
  TableQueryDefaults,
  // CHG-DESIGN-02 Step 4
  ToolbarConfig,
  ViewsConfig,
  ViewScope,
  TableView,
  PersistedQuery,
  // CHG-DESIGN-02 Step 7A
  PaginationConfig,
  PaginationSummaryContext,
  FilterChipContext,
} from './types'

// CHG-DESIGN-02 Step 7A — 工具与子组件（不在 DataTable 内部使用时也可独立消费）
// ADR-149 EP-3：formatFilterValue 已删（filter-chips.tsx 整文件删）；
// column-visibility.ts 4 函数保留（column-matrix-menu 内部消费 + 外部业务可调）
export {
  setColumnVisibility,
  isColumnVisible,
  getHidableColumns,
  countHiddenColumns,
} from './column-visibility'
