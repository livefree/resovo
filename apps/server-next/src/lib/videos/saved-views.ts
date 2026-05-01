/**
 * saved-views.ts — 视频库 saved views localStorage 持久化（CHG-DESIGN-08 8B）
 *
 * 真源：reference §5.3「Saved views：我的待审、本周、封面失效、团队新增上架」+
 *      packages/admin-ui DataTable.viewsConfig 契约（TableView / ViewScope / PersistedQuery）
 *
 * 持久化策略：
 *   - personal scope：localStorage key `admin-videos-views-personal`
 *   - team scope：暂返空数组（M-SN-4+ 接入 GET /admin/views/team 真端点；§A4 决议后实装）
 *
 * 序列化：
 *   - PersistedQuery 含 Map / Set，JSON.stringify 不直接支持 → 转 [k, v][] entries
 *   - 反序列化时 new Map / new Set
 *   - 损坏的 localStorage 数据 → catch 后返空（不阻塞渲染）
 *
 * 4 默认 views（"我的待审" / "本周" / "封面失效" / "团队新增上架"）：
 *   reference §5.3 列出但 query 形态需业务调研（filter key 命名空间 / range 边界 / time delta），
 *   留 follow-up `VIDEO-DEFAULT-VIEWS-PRESET` 后续单独卡，本卡仅落 framework。
 */

import type { PersistedQuery, TableView, ViewScope, FilterValue, ColumnPreference } from '@resovo/admin-ui'

const STORAGE_KEY_PERSONAL = 'admin-videos-views-personal'

// ── 序列化工具（Map/Set → array entries）──────────────────────────

interface SerializedPersistedQuery {
  readonly pagination: PersistedQuery['pagination']
  readonly sort: PersistedQuery['sort']
  readonly filters: ReadonlyArray<readonly [string, FilterValue]>
  readonly columns: ReadonlyArray<readonly [string, ColumnPreference]>
}

interface SerializedView {
  readonly id: string
  readonly label: string
  readonly scope: ViewScope
  readonly query: SerializedPersistedQuery
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy?: string
}

function serializeQuery(q: PersistedQuery): SerializedPersistedQuery {
  return {
    pagination: q.pagination,
    sort: q.sort,
    filters: Array.from(q.filters.entries()),
    columns: Array.from(q.columns.entries()),
  }
}

function deserializeQuery(s: SerializedPersistedQuery): PersistedQuery {
  return {
    pagination: s.pagination,
    sort: s.sort,
    filters: new Map(s.filters),
    columns: new Map(s.columns),
  }
}

function serializeView(v: TableView): SerializedView {
  return {
    id: v.id,
    label: v.label,
    scope: v.scope,
    query: serializeQuery(v.query),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    ...(v.createdBy !== undefined ? { createdBy: v.createdBy } : {}),
  }
}

function deserializeView(s: SerializedView): TableView {
  return {
    id: s.id,
    label: s.label,
    scope: s.scope,
    query: deserializeQuery(s.query),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    ...(s.createdBy !== undefined ? { createdBy: s.createdBy } : {}),
  }
}

// ── localStorage 读写 ───────────────────────────────────────────────

/**
 * 加载所有 personal saved views（localStorage）。
 * 损坏 / 不存在 / SSR 路径返空数组。
 */
export function loadPersonalViews(): readonly TableView[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERSONAL)
    if (!raw) return []
    const parsed = JSON.parse(raw) as readonly SerializedView[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(deserializeView)
  } catch {
    return []
  }
}

/**
 * 保存 personal views 列表到 localStorage（覆盖式写入）。
 * SSR 路径 noop（typeof localStorage 守卫）。
 */
function savePersonalViews(views: readonly TableView[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    const serialized = views.map(serializeView)
    localStorage.setItem(STORAGE_KEY_PERSONAL, JSON.stringify(serialized))
  } catch {
    // localStorage 配额满 / 其他错误 → 静默失败（不阻塞渲染）
  }
}

// ── views 操作 helpers ─────────────────────────────────────────────

/**
 * 在 personal views 列表中追加一个新 view。
 * 返回新列表（不修改原数组）。
 */
export function appendPersonalView(
  current: readonly TableView[],
  view: TableView,
): readonly TableView[] {
  const next = [...current, view]
  savePersonalViews(next)
  return next
}

/**
 * 从 personal views 列表中移除一个 view（按 id）。
 * 返回新列表（不修改原数组）。
 */
export function removePersonalView(
  current: readonly TableView[],
  id: string,
): readonly TableView[] {
  const next = current.filter((v) => v.id !== id)
  savePersonalViews(next)
  return next
}

/**
 * 构造一个新 personal view（id 用 timestamp + random，避免冲突）。
 */
export function makePersonalView(label: string, query: PersistedQuery): TableView {
  const now = new Date().toISOString()
  const id = `personal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    label,
    scope: 'personal',
    query,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 加载 team views 列表（暂返空数组）。
 * follow-up `VIDEO-TEAM-VIEWS-API`：M-SN-4+ 接入 GET /admin/views/team 真端点。
 */
export function loadTeamViews(): readonly TableView[] {
  return []
}
