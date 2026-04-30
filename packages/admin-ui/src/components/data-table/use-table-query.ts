'use client'

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
import type {
  UseTableQueryOptions,
  TableQueryPatch,
  TableQuerySnapshot,
  TableView,
  ViewScope,
  PersistedQuery,
} from './types'
import { tableQueryStore, buildDefaultSnapshot, applyPatch } from './table-query-store'
import { snapshotToSearchParams, searchParamsToSnapshot } from './url-sync'
import { readFromStorage, writeToStorage, writeViewsToStorage, storedPrefsToColumnMap } from './storage-sync'

export function useTableQuery(options: UseTableQueryOptions): {
  readonly snapshot: TableQuerySnapshot
  readonly patch: (next: TableQueryPatch) => void
  readonly reset: () => void
  // CHG-DESIGN-02 Step 6 — saved views API
  readonly views: readonly TableView[]
  readonly saveView: (label: string, scope: ViewScope) => TableView
  readonly applyView: (view: TableView | string) => void
  readonly deleteView: (viewId: string) => void
} {
  const { tableId, router, defaults, urlNamespace, columns } = options

  // Stable ref to options to avoid stale closures in callbacks
  const optionsRef = useRef(options)
  useEffect(() => { optionsRef.current = options })

  // Cache default snapshot via lazy ref —— useSyncExternalStore 要求 getServerSnapshot
  // 返回稳定引用，否则触发"infinite loop"警告（React 18+ 严格模式下报错）。
  // 同时 getClientSnapshot 在 store 未初始化时的 fallback 也复用此 ref，避免每次 render 重建。
  // (fix(CHG-DESIGN-04)#3 / 由 VideoListClient SSR 路径触发)
  const defaultSnapshotRef = useRef<TableQuerySnapshot | null>(null)
  if (defaultSnapshotRef.current === null) {
    defaultSnapshotRef.current = buildDefaultSnapshot(columns, defaults)
  }

  // Subscribe to store
  const snapshot = useSyncExternalStore(
    tableQueryStore.subscribe,
    () =>
      tableQueryStore.getState().snapshots.get(tableId)
        ?? (defaultSnapshotRef.current as TableQuerySnapshot),
    () => defaultSnapshotRef.current as TableQuerySnapshot,
  )

  // CHG-DESIGN-02 Step 6 — saved views 订阅
  const emptyViewsRef = useRef<readonly TableView[]>([])
  const views = useSyncExternalStore(
    tableQueryStore.subscribe,
    () => tableQueryStore.getState().views.get(tableId) ?? emptyViewsRef.current,
    () => emptyViewsRef.current,
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

    // 3. Merge: URL wins for page/sort/filters; storage wins for pageSize/columns（如存在）
    // 注意：StoredPrefs 字段全 optional（Step 6 fix#），仅当对应字段实际存储过才优先；
    // 否则回退到 base（消费方在 defaults 提供的真实默认）。
    const pageSize = stored?.pageSize ?? base.pagination.pageSize
    const columnMap = stored?.columns !== undefined
      ? storedPrefsToColumnMap(stored)
      : base.columns

    const initial: TableQuerySnapshot = {
      pagination: { page: urlParams.page, pageSize },
      sort: urlParams.sort,
      filters: urlParams.filters,
      columns: columnMap,
      selection: base.selection,
    }

    tableQueryStore.getState().setSnapshot(tid, initial)

    // CHG-DESIGN-02 Step 6 — 把已持久化的 views 加载进 store
    if (stored?.views && stored.views.length > 0) {
      tableQueryStore.getState().setViews(tid, stored.views)
    }
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

    // URL sync — defaults 必须用用户定义的真实默认值，而非 final.pagination（否则
    // page !== defaultPage 永远 false，任何非默认页都会被删掉）
    try {
      const urlDefaults = {
        pagination: { page: defs?.pagination?.page ?? 1, pageSize: defs?.pagination?.pageSize ?? 20 },
        sort: defs?.sort ?? { field: undefined, direction: 'asc' as const },
      }
      const currentParams = r.getSearchParams()
      const nextParams = snapshotToSearchParams(
        { pagination: final.pagination, sort: final.sort, filters: final.filters },
        urlDefaults,
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
      const urlDefaults = {
        pagination: { page: defs?.pagination?.page ?? 1, pageSize: defs?.pagination?.pageSize ?? 20 },
        sort: defs?.sort ?? { field: undefined, direction: 'asc' as const },
      }
      const currentParams = r.getSearchParams()
      const nextParams = snapshotToSearchParams(
        { pagination: base.pagination, sort: base.sort, filters: base.filters },
        urlDefaults,
        currentParams,
        ns,
      )
      r.replace(nextParams)
    } catch (err) {
      console.warn('[use-table-query] reset URL sync failed:', err)
    }

    writeToStorage(tid, base)
  }, [])

  // ── CHG-DESIGN-02 Step 6 — saved views API ──────────────────────

  /**
   * 把当前 snapshot 转换为 PersistedQuery（剔除 selection；arch-reviewer C-4）。
   */
  const buildPersistedQuery = (curr: TableQuerySnapshot): PersistedQuery => ({
    pagination: curr.pagination,
    sort: curr.sort,
    filters: curr.filters,
    columns: curr.columns,
  })

  const saveView = useCallback((label: string, scope: ViewScope): TableView => {
    const { tableId: tid } = optionsRef.current
    const current = tableQueryStore.getState().snapshots.get(tid)
      ?? (defaultSnapshotRef.current as TableQuerySnapshot)
    const now = new Date().toISOString()
    // crypto.randomUUID 在现代浏览器和 Node 19+ 可用；降级为时间戳 + 随机
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newView: TableView = {
      id,
      label,
      scope,
      query: buildPersistedQuery(current),
      createdAt: now,
      updatedAt: now,
    }
    const existing = tableQueryStore.getState().views.get(tid) ?? []
    const next = [...existing, newView]
    tableQueryStore.getState().setViews(tid, next)
    writeViewsToStorage(tid, next)
    return newView
  }, [])

  const applyView = useCallback((view: TableView | string) => {
    const { tableId: tid, router: r, defaults: defs, urlNamespace: ns, columns: cols } = optionsRef.current
    const list = tableQueryStore.getState().views.get(tid) ?? []
    const target = typeof view === 'string'
      ? list.find((v) => v.id === view)
      : view
    if (!target) {
      console.warn(`[use-table-query] applyView: view not found "${typeof view === 'string' ? view : view.id}"`)
      return
    }
    const current = tableQueryStore.getState().snapshots.get(tid)
      ?? buildDefaultSnapshot(cols, defs)
    const next: TableQuerySnapshot = {
      ...target.query,
      // selection 保持当前值（视图与选区无关，arch-reviewer C-4）
      selection: current.selection,
    }
    tableQueryStore.getState().setSnapshot(tid, next)

    // URL sync
    try {
      const urlDefaults = {
        pagination: { page: defs?.pagination?.page ?? 1, pageSize: defs?.pagination?.pageSize ?? 20 },
        sort: defs?.sort ?? { field: undefined, direction: 'asc' as const },
      }
      const currentParams = r.getSearchParams()
      const nextParams = snapshotToSearchParams(
        { pagination: next.pagination, sort: next.sort, filters: next.filters },
        urlDefaults,
        currentParams,
        ns,
      )
      r.replace(nextParams)
    } catch (err) {
      console.warn('[use-table-query] applyView URL sync failed:', err)
    }

    // Storage sync（pageSize/columns 可能变化）
    writeToStorage(tid, next)
  }, [])

  const deleteView = useCallback((viewId: string) => {
    const { tableId: tid } = optionsRef.current
    const existing = tableQueryStore.getState().views.get(tid) ?? []
    const next = existing.filter((v) => v.id !== viewId)
    tableQueryStore.getState().setViews(tid, next)
    writeViewsToStorage(tid, next)
  }, [])

  return { snapshot, patch, reset, views, saveView, applyView, deleteView }
}
