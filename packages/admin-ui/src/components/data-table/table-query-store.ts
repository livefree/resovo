/**
 * table-query-store.ts — DataTable v2 多表格 query 状态单例 store（zustand/vanilla）
 * 真源：ADR-103 §4.2.3 + §4.10-1（Provider 不下沉；zustand 单例非 Context Provider）
 * 范式参照：shell/toast-store.ts（CHG-SN-2-03）
 *
 * 设计要点：
 *   - 单例 store：模块顶层 createStore，无任何副作用（SSR 安全）
 *   - 多表格共存：以 tableId 为 Map key 持有多份 snapshot
 *   - setSnapshot：useTableQuery hook 内部在 useEffect / 事件 handler 调用（非顶层）
 *   - getSnapshot：纯读，供 useSyncExternalStore 使用
 */
import { createStore } from 'zustand/vanilla'
import type { TableQuerySnapshot, ColumnDescriptor, TableQueryDefaults } from './types'

const DEFAULT_PAGE_SIZE = 20

export interface TableQueryStoreState {
  /** tableId → snapshot */
  readonly snapshots: ReadonlyMap<string, TableQuerySnapshot>
}

export interface TableQueryStoreActions {
  readonly getSnapshot: (tableId: string) => TableQuerySnapshot | undefined
  readonly setSnapshot: (tableId: string, snapshot: TableQuerySnapshot) => void
}

export type TableQueryStoreApi = ReturnType<typeof createTableQueryStore>

export function createTableQueryStore() {
  return createStore<TableQueryStoreState & TableQueryStoreActions>()((set, get) => ({
    snapshots: new Map(),
    getSnapshot: (tableId) => get().snapshots.get(tableId),
    setSnapshot: (tableId, snapshot) => {
      set((state) => {
        const next = new Map(state.snapshots)
        next.set(tableId, snapshot)
        return { snapshots: next }
      })
    },
  }))
}

/** 应用全局单例（ADR-103 §4.10-1 Provider 不下沉）*/
export const tableQueryStore: TableQueryStoreApi = createTableQueryStore()

// ── snapshot builders ────────────────────────────────────────────

export function buildDefaultSnapshot(
  columns: readonly ColumnDescriptor[],
  defaults: Partial<TableQueryDefaults> | undefined,
): TableQuerySnapshot {
  return {
    pagination: {
      page: defaults?.pagination?.page ?? 1,
      pageSize: defaults?.pagination?.pageSize ?? DEFAULT_PAGE_SIZE,
    },
    sort: defaults?.sort ?? { field: undefined, direction: 'asc' },
    filters: defaults?.filters ?? new Map(),
    columns: buildDefaultColumns(columns),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}

function buildDefaultColumns(columns: readonly ColumnDescriptor[]): ReadonlyMap<string, import('./types').ColumnPreference> {
  return new Map(
    columns.map((c) => [c.id, { visible: c.defaultVisible !== false }]),
  )
}

export function applyPatch(
  current: TableQuerySnapshot,
  patch: import('./types').TableQueryPatch,
): TableQuerySnapshot {
  return {
    pagination: patch.pagination
      ? { ...current.pagination, ...patch.pagination }
      : current.pagination,
    sort: patch.sort !== undefined ? patch.sort : current.sort,
    filters: patch.filters !== undefined ? patch.filters : current.filters,
    columns: patch.columns !== undefined ? patch.columns : current.columns,
    selection: patch.selection !== undefined ? patch.selection : current.selection,
  }
}
