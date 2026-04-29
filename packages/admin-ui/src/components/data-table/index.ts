/**
 * data-table/index.ts — DataTable v2 公开 API 桶导出（CHG-SN-2-13）
 * 真源：ADR-103 §4.1 + §4.2（影响文件列表）
 */

// Component
export { DataTable } from './data-table'

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
} from './types'
