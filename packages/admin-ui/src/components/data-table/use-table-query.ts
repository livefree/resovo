/**
 * use-table-query.ts — DataTable v2 query 状态管理 hook
 * 真源：ADR-103 §4.2（CHG-SN-2-13）
 *
 * 职责：
 *   - 初始化：URL 参数 + sessionStorage 合并 → 初始 snapshot
 *   - 状态：订阅 tableQueryStore（useSyncExternalStore）
 *   - patch：PATCH 语义变更 + 同步 URL（router.replace）+ 同步 sessionStorage
 *   - reset：恢复到 defaults
 *
 * 约束（ADR-103 §4.10）：
 *   - 模块顶层零 window / sessionStorage / document 访问（全在 useEffect 内）
 *   - router 反向注入：不直 import next/navigation
 *   - 零 any
 */
import { useEffect, useCallback, useSyncExternalStore, useRef } from 'react'
import type { UseTableQueryOptions, TableQueryPatch, TableQuerySnapshot } from './types'
import { tableQueryStore, buildDefaultSnapshot, applyPatch } from './table-query-store'
import { snapshotToSearchParams, searchParamsToSnapshot } from './url-sync'
import { readFromStorage, writeToStorage, storedPrefsToColumnMap } from './storage-sync'

export function useTableQuery(options: UseTableQueryOptions): {
  readonly snapshot: TableQuerySnapshot
  readonly patch: (next: TableQueryPatch) => void
  readonly reset: () => void
} {
  const { tableId, router, defaults, urlNamespace, columns } = options

  // Stable ref to options to avoid stale closures in callbacks
  const optionsRef = useRef(options)
  useEffect(() => { optionsRef.current = options })

  // Subscribe to store
  const snapshot = useSyncExternalStore(
    tableQueryStore.subscribe,
    () => tableQueryStore.getState().snapshots.get(tableId) ?? buildDefaultSnapshot(columns, defaults),
    () => buildDefaultSnapshot(columns, defaults),
  )

  // Initialize from URL + sessionStorage on mount
  useEffect(() => {
    const { tableId: tid, router: r, defaults: defs, urlNamespace: ns, columns: cols } = optionsRef.current
    const existing = tableQueryStore.getState().snapshots.get(tid)
    if (existing) return // already initialized (e.g. HMR / StrictMode second effect)

    const base = buildDefaultSnapshot(cols, defs)

    // 1. Parse URL params
    let urlParams: ReturnType<typeof searchParamsToSnapshot>
    try {
      urlParams = searchParamsToSnapshot(r.getSearchParams(), {
        pagination: base.pagination,
        sort: base.sort,
      }, cols, ns)
    } catch (err) {
      console.warn('[use-table-query] URL parse failed:', err)
      urlParams = { page: base.pagination.page, sort: base.sort, filters: new Map() }
    }

    // 2. Read sessionStorage
    const stored = readFromStorage(tid)

    // 3. Merge: URL wins for page/sort/filters; storage wins for pageSize/columns
    const pageSize = stored?.pageSize ?? base.pagination.pageSize
    const columnMap = stored ? storedPrefsToColumnMap(stored) : base.columns

    const initial: TableQuerySnapshot = {
      pagination: { page: urlParams.page, pageSize },
      sort: urlParams.sort,
      filters: urlParams.filters,
      columns: columnMap,
      selection: base.selection,
    }

    tableQueryStore.getState().setSnapshot(tid, initial)
  }, [tableId]) // only tableId is a stable dep; options via ref

  // patch: PATCH semantics + URL + storage sync
  const patch = useCallback((next: TableQueryPatch) => {
    const { tableId: tid, router: r, defaults: defs, urlNamespace: ns, columns: cols } = optionsRef.current
    const current = tableQueryStore.getState().snapshots.get(tid) ?? buildDefaultSnapshot(cols, defs)
    const updated = applyPatch(current, next)

    // Reset page to 1 on sort/filter/column change (not on explicit page patch)
    const shouldResetPage = (next.sort !== undefined || next.filters !== undefined) && !next.pagination?.page
    const final: TableQuerySnapshot = shouldResetPage
      ? applyPatch(updated, { pagination: { page: 1 } })
      : updated

    tableQueryStore.getState().setSnapshot(tid, final)

    // URL sync
    try {
      const currentParams = r.getSearchParams()
      const nextParams = snapshotToSearchParams(
        { pagination: final.pagination, sort: final.sort, filters: final.filters },
        { pagination: final.pagination, sort: { field: undefined, direction: 'asc' } },
        currentParams,
        ns,
      )
      r.replace(nextParams)
    } catch (err) {
      console.warn('[use-table-query] URL sync failed:', err)
    }

    // Storage sync
    writeToStorage(tid, final)
  }, []) // stable; options via ref

  // reset: restore defaults + clear URL filter/sort params
  const reset = useCallback(() => {
    const { tableId: tid, router: r, defaults: defs, urlNamespace: ns, columns: cols } = optionsRef.current
    const base = buildDefaultSnapshot(cols, defs)
    tableQueryStore.getState().setSnapshot(tid, base)

    try {
      const currentParams = r.getSearchParams()
      const nextParams = snapshotToSearchParams(
        { pagination: base.pagination, sort: base.sort, filters: base.filters },
        { pagination: base.pagination, sort: { field: undefined, direction: 'asc' } },
        currentParams,
        ns,
      )
      r.replace(nextParams)
    } catch (err) {
      console.warn('[use-table-query] reset URL sync failed:', err)
    }

    writeToStorage(tid, base)
  }, [])

  return { snapshot, patch, reset }
}
