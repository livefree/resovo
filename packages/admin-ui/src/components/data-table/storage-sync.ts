'use client'

/**
 * storage-sync.ts — DataTable 布局偏好 / saved views 持久化（纯函数，零副作用）
 * 真源：ADR-103 §4.2.2（CHG-SN-2-13）+ §4.2.2 AMENDMENT（DTR-D / SEQ-20260531-01 / arch-reviewer C3）
 *
 * **双 key 双介质（DTR-D / arch-reviewer C3）**：
 *   - 布局偏好（pagination.pageSize + columns 的 visible+width）→ **localStorage**
 *     key `admin-ui:table:{tableId}:v2`（跨会话持久 / 关标签页重开仍在 / 列宽需求 (5)）
 *   - saved views → **sessionStorage** key `admin-ui:table:{tableId}:views:v1`
 *     （会话内瞬态 / 关标签页清理，避免跨会话跨账号视图残留）
 *   - 旧合并 key `admin-ui:table:{tableId}:v1`（sessionStorage / pageSize+columns+views 合一）
 *     **一次性重置不迁移**（C3）：新代码不读取；readFromStorage 时 best-effort 清理该旧 key。
 *
 * 不持久化：page / sort / filters（走 URL）/ selection（瞬态）。
 * 容错：JSON.parse 失败 / schema 不匹配 → console.warn + 静默清除该 key + 返回 undefined（禁止空 catch）。
 * schema 加固（C3）：columns[*].width 仅接受 `Number.isFinite(w) && w > 0`；非法则丢弃该 width 保留 visible。
 * 模块顶层零副作用：window / localStorage / sessionStorage 访问全部在函数内 + SSR `typeof window` 守卫。
 *
 * 对外契约不变（StoredPrefs 合并形态 + 4 个导出签名），消费方（use-table-query）零逻辑改动。
 */
import type { TableQuerySnapshot, ColumnPreference, TableView } from './types'

const LAYOUT_VERSION = 'v2'
const VIEWS_VERSION = 'v1'

function layoutKey(tableId: string): string {
  return `admin-ui:table:${tableId}:${LAYOUT_VERSION}`
}
function viewsKey(tableId: string): string {
  return `admin-ui:table:${tableId}:views:${VIEWS_VERSION}`
}
/** 旧合并 key（sessionStorage，pageSize+columns+views 合一）；一次性清理不迁移。 */
function legacyKey(tableId: string): string {
  return `admin-ui:table:${tableId}:v1`
}

/**
 * StoredPrefs — readFromStorage 对外合并形态（布局 + views）。
 * 字段全 optional（每字段独立写入路径，未触发的字段不应被伪造默认值 / Step 6 fix#）。
 */
export interface StoredPrefs {
  readonly pageSize?: number
  readonly columns?: Readonly<Record<string, { visible: boolean; width?: number }>>
  /** Saved views（CHG-DESIGN-02 Step 6）；缺省即未保存任何视图 */
  readonly views?: readonly TableView[]
}

// ── SSR 安全存储原语 ──────────────────────────────────────────────

type Medium = 'local' | 'session'

function storageOf(medium: Medium): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  return medium === 'local' ? window.localStorage : window.sessionStorage
}

function safeGet(medium: Medium, key: string): string | null {
  try {
    return storageOf(medium)?.getItem(key) ?? null
  } catch (err) {
    console.warn(`[storage-sync] ${medium}Storage read error for "${key}":`, err)
    return null
  }
}
function safeSet(medium: Medium, key: string, value: string): void {
  try {
    storageOf(medium)?.setItem(key, value)
  } catch (err) {
    console.warn(`[storage-sync] ${medium}Storage write error for "${key}":`, err)
  }
}
function safeRemove(medium: Medium, key: string): void {
  try {
    storageOf(medium)?.removeItem(key)
  } catch {
    /* ignore — 清理失败无副作用 */
  }
}

// ── 布局偏好（localStorage :v2）────────────────────────────────────

interface LayoutPrefs {
  readonly pageSize?: number
  readonly columns?: Record<string, { visible: boolean; width?: number }>
}

/** schema 加固（C3）：width 仅接受有限正数。 */
function isValidWidth(w: unknown): w is number {
  return typeof w === 'number' && Number.isFinite(w) && w > 0
}

/**
 * 校验 + 清洗布局对象：pageSize 须 number；每列 visible 须 boolean；
 * width 仅留 `Number.isFinite && > 0`（C3），非法则丢弃该列 width 保留 visible。
 * 结构性非法（pageSize/columns/visible 类型错）→ null（整体清除该 key）。
 */
function parseLayout(val: unknown): LayoutPrefs | null {
  if (typeof val !== 'object' || val === null) return null
  const v = val as Record<string, unknown>
  if (v['pageSize'] !== undefined && typeof v['pageSize'] !== 'number') return null
  let columns: Record<string, { visible: boolean; width?: number }> | undefined
  if (v['columns'] !== undefined) {
    if (typeof v['columns'] !== 'object' || v['columns'] === null) return null
    columns = {}
    for (const [id, entry] of Object.entries(v['columns'] as Record<string, unknown>)) {
      if (typeof entry !== 'object' || entry === null) return null
      const e = entry as Record<string, unknown>
      if (typeof e['visible'] !== 'boolean') return null
      columns[id] = isValidWidth(e['width'])
        ? { visible: e['visible'], width: e['width'] }
        : { visible: e['visible'] }
    }
  }
  return {
    ...(typeof v['pageSize'] === 'number' ? { pageSize: v['pageSize'] } : {}),
    ...(columns !== undefined ? { columns } : {}),
  }
}

function readLayout(tableId: string): LayoutPrefs | null {
  const raw = safeGet('local', layoutKey(tableId))
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(`[storage-sync] layout JSON.parse failed for "${tableId}", clearing`)
    safeRemove('local', layoutKey(tableId))
    return null
  }
  const layout = parseLayout(parsed)
  if (layout === null) {
    console.warn(`[storage-sync] layout schema mismatch for "${tableId}", clearing`)
    safeRemove('local', layoutKey(tableId))
  }
  return layout
}

// ── saved views（sessionStorage :views:v1）─────────────────────────

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

/** View 的 query 在 JSON 序列化时丢失 Map 结构（filters / columns），反序列化后还原为 Map。 */
function reviveView(stored: TableView): TableView {
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

/** View 的 query 序列化前把 Map 转 plain object，否则 JSON.stringify 丢失。 */
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

function readViews(tableId: string): readonly TableView[] | null {
  const raw = safeGet('session', viewsKey(tableId))
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(`[storage-sync] views JSON.parse failed for "${tableId}", clearing`)
    safeRemove('session', viewsKey(tableId))
    return null
  }
  if (!Array.isArray(parsed) || !parsed.every(isPersistedView)) {
    console.warn(`[storage-sync] views schema mismatch for "${tableId}", clearing`)
    safeRemove('session', viewsKey(tableId))
    return null
  }
  return (parsed as TableView[]).map(reviveView)
}

// ── 对外 API（签名不变）──────────────────────────────────────────

export function readFromStorage(tableId: string): StoredPrefs | undefined {
  if (typeof window === 'undefined') return undefined
  // 旧合并 :v1（sessionStorage）一次性清理不迁移（C3）
  safeRemove('session', legacyKey(tableId))

  const layout = readLayout(tableId)
  const views = readViews(tableId)
  if (layout === null && views === null) return undefined
  return {
    ...(layout ?? {}),
    ...(views !== null ? { views } : {}),
  }
}

export function writeToStorage(tableId: string, snapshot: TableQuerySnapshot): void {
  if (typeof window === 'undefined') return
  // 布局偏好 → localStorage :v2（views 在独立 sessionStorage key，无需 read-merge）
  const layout: LayoutPrefs = {
    pageSize: snapshot.pagination.pageSize,
    columns: Object.fromEntries(
      Array.from(snapshot.columns.entries()).map(([id, pref]) => [
        id,
        isValidWidth(pref.width) ? { visible: pref.visible, width: pref.width } : { visible: pref.visible },
      ]),
    ),
  }
  safeSet('local', layoutKey(tableId), JSON.stringify(layout))
}

/**
 * 写入 saved views（CHG-DESIGN-02 Step 6）→ sessionStorage :views:v1。
 * 仅写 views（布局在独立 localStorage key，无需 read-merge / 不伪造 pageSize/columns）。
 */
export function writeViewsToStorage(tableId: string, views: readonly TableView[]): void {
  if (typeof window === 'undefined') return
  safeSet('session', viewsKey(tableId), JSON.stringify(views.map(serializeView)))
}

export function storedPrefsToColumnMap(
  prefs: StoredPrefs,
): ReadonlyMap<string, ColumnPreference> {
  if (!prefs.columns) return new Map()
  return new Map(
    Object.entries(prefs.columns).map(([id, p]) => [
      id,
      { visible: p.visible, ...(p.width !== undefined ? { width: p.width } : {}) },
    ]),
  )
}
