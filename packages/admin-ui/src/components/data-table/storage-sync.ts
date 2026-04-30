'use client'

/**
 * storage-sync.ts — snapshot ↔ sessionStorage 互转（纯函数，零副作用）
 * 真源：ADR-103 §4.2.2 sessionStorage 同步规约（CHG-SN-2-13）
 *       reference.md §4.4 / arch-reviewer Step 6 — saved views 持久化（CHG-DESIGN-02）
 *
 * 存储 key：`admin-ui:table:{tableId}:v1`
 * 持久化字段：
 *   - pagination.pageSize
 *   - columns（visible + width）
 *   - views（saved views，CHG-DESIGN-02 Step 6 新增）
 * 不持久化：page / sort / filters（走 URL）/ selection（瞬态）/ view 内的 selection
 *
 * 容错：JSON.parse 失败 / schema 不匹配 → console.warn + 静默清除 + 返回 undefined。
 * 升级语义：写入 snapshot/views 时通过先 read + merge 保留另一侧字段（避免 writeToStorage
 * 覆盖 views 或反之）。
 */
import type { TableQuerySnapshot, ColumnPreference, TableView } from './types'

const STORAGE_VERSION = 'v1'
const DEFAULT_PAGE_SIZE = 20

function storageKey(tableId: string): string {
  return `admin-ui:table:${tableId}:${STORAGE_VERSION}`
}

export interface StoredPrefs {
  readonly pageSize: number
  readonly columns: Readonly<Record<string, { visible: boolean; width?: number }>>
  /** Saved views（CHG-DESIGN-02 Step 6）；缺省即未保存任何视图 */
  readonly views?: readonly TableView[]
}

function isPersistedView(val: unknown): val is TableView {
  if (typeof val !== 'object' || val === null) return false
  const v = val as Record<string, unknown>
  if (typeof v['id'] !== 'string') return false
  if (typeof v['label'] !== 'string') return false
  if (v['scope'] !== 'personal' && v['scope'] !== 'team') return false
  if (typeof v['createdAt'] !== 'string') return false
  if (typeof v['updatedAt'] !== 'string') return false
  if (v['createdBy'] !== undefined && typeof v['createdBy'] !== 'string') return false
  if (typeof v['query'] !== 'object' || v['query'] === null) return false
  // query 内部 shape 不深度校验（pagination/sort/filters/columns 复杂 Map 结构需还原）
  return true
}

function isStoredPrefs(val: unknown): val is StoredPrefs {
  if (typeof val !== 'object' || val === null) return false
  const v = val as Record<string, unknown>
  if (typeof v['pageSize'] !== 'number') return false
  if (typeof v['columns'] !== 'object' || v['columns'] === null) return false
  const cols = v['columns'] as Record<string, unknown>
  for (const entry of Object.values(cols)) {
    if (typeof entry !== 'object' || entry === null) return false
    if (typeof (entry as Record<string, unknown>)['visible'] !== 'boolean') return false
  }
  if (v['views'] !== undefined) {
    if (!Array.isArray(v['views'])) return false
    for (const view of v['views']) {
      if (!isPersistedView(view)) return false
    }
  }
  return true
}

/**
 * View 的 query 在 JSON 序列化时丢失 Map 结构（filters / columns），
 * 反序列化后还原为 Map。
 */
function reviveView(stored: TableView): TableView {
  // JSON.parse 后 query.filters / query.columns 是 plain object，需还原为 Map
  const rawQuery = stored.query as unknown as {
    pagination: { page: number; pageSize: number }
    sort: { field: string | undefined; direction: 'asc' | 'desc' }
    filters: Record<string, unknown> | ReadonlyMap<string, unknown>
    columns: Record<string, ColumnPreference> | ReadonlyMap<string, ColumnPreference>
  }
  const filters = rawQuery.filters instanceof Map
    ? rawQuery.filters
    : new Map(Object.entries(rawQuery.filters ?? {}))
  const columns = rawQuery.columns instanceof Map
    ? rawQuery.columns
    : new Map(Object.entries(rawQuery.columns ?? {}))
  return {
    ...stored,
    query: {
      pagination: rawQuery.pagination,
      sort: rawQuery.sort,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filters: filters as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columns: columns as any,
    },
  }
}

/**
 * View 的 query 序列化前把 Map 转 plain object，否则 JSON.stringify 丢失。
 */
function serializeView(view: TableView): TableView {
  const q = view.query
  const filtersMap = q.filters as unknown as Map<string, unknown>
  const columnsMap = q.columns as unknown as Map<string, ColumnPreference>
  return {
    ...view,
    query: {
      pagination: q.pagination,
      sort: q.sort,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filters: Object.fromEntries(filtersMap) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columns: Object.fromEntries(columnsMap) as any,
    },
  }
}

export function readFromStorage(tableId: string): StoredPrefs | undefined {
  if (typeof window === 'undefined') return undefined
  let raw: string | null
  try {
    raw = window.sessionStorage.getItem(storageKey(tableId))
  } catch (err) {
    console.warn(`[storage-sync] sessionStorage read error for "${tableId}":`, err)
    return undefined
  }
  if (raw === null) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(`[storage-sync] JSON.parse failed for "${tableId}", clearing`)
    try { window.sessionStorage.removeItem(storageKey(tableId)) } catch { /* ignore */ }
    return undefined
  }
  if (!isStoredPrefs(parsed)) {
    console.warn(`[storage-sync] schema mismatch for "${tableId}", clearing`)
    try { window.sessionStorage.removeItem(storageKey(tableId)) } catch { /* ignore */ }
    return undefined
  }
  // 还原 views 中 query 的 Map 结构
  if (parsed.views) {
    return { ...parsed, views: parsed.views.map(reviveView) }
  }
  return parsed
}

function writeRaw(tableId: string, prefs: StoredPrefs): void {
  if (typeof window === 'undefined') return
  try {
    // views 中的 Map 结构序列化前转为 plain object
    const serialized: StoredPrefs = prefs.views
      ? { ...prefs, views: prefs.views.map(serializeView) }
      : prefs
    window.sessionStorage.setItem(storageKey(tableId), JSON.stringify(serialized))
  } catch (err) {
    console.warn(`[storage-sync] sessionStorage write error for "${tableId}":`, err)
  }
}

export function writeToStorage(tableId: string, snapshot: TableQuerySnapshot): void {
  // 读取现有 prefs 以保留 views（避免 snapshot 写入覆盖 views）
  const existing = readFromStorage(tableId)
  const prefs: StoredPrefs = {
    pageSize: snapshot.pagination.pageSize,
    columns: Object.fromEntries(
      Array.from(snapshot.columns.entries()).map(([id, pref]) => [
        id,
        { visible: pref.visible, ...(pref.width !== undefined ? { width: pref.width } : {}) },
      ]),
    ),
    ...(existing?.views ? { views: existing.views } : {}),
  }
  writeRaw(tableId, prefs)
}

/**
 * 写入 saved views（CHG-DESIGN-02 Step 6）。先 read + merge 以保留 pageSize / columns。
 */
export function writeViewsToStorage(tableId: string, views: readonly TableView[]): void {
  const existing = readFromStorage(tableId)
  const prefs: StoredPrefs = {
    pageSize: existing?.pageSize ?? DEFAULT_PAGE_SIZE,
    columns: existing?.columns ?? {},
    views,
  }
  writeRaw(tableId, prefs)
}

export function storedPrefsToColumnMap(
  prefs: StoredPrefs,
): ReadonlyMap<string, ColumnPreference> {
  return new Map(
    Object.entries(prefs.columns).map(([id, p]) => [
      id,
      { visible: p.visible, ...(p.width !== undefined ? { width: p.width } : {}) },
    ]),
  )
}
