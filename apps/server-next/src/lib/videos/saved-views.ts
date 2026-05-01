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

// ── 4 默认 views（reference §5.3 视频库标杆）───────────────────────

/**
 * 4 默认 views（reference §5.3「我的待审 / 本周 / 封面失效 / 团队新增上架」）。
 *
 * 业务 filter 命名空间（VideoFilterFields.buildVideoFilter）：q / type / status /
 * visibilityStatus / reviewStatus / site —— 不直接覆盖时间区间 / image_health 字段。
 * 故对不到的 view 语义用最接近的近似 + 标 follow-up：
 *
 * - **我的待审**（精确）：filters reviewStatus=pending_review + sort created_at desc
 * - **本周**（近似）：sort created_at desc + pageSize 50（"近期"近似；精确时间区间需后端
 *   支持 createdSince filter，留 follow-up `VIDEO-FILTER-TIME-RANGE`）
 * - **封面失效**（近似）：sort created_at desc + columns 强制 image_health visible（视觉突出
 *   P0 失效列；精确 image_health filter 需后端 image-health enum 支持，留 follow-up
 *   `VIDEO-FILTER-IMAGE-HEALTH`）
 * - **团队新增上架**（精确）：filters status=published + sort created_at desc
 *
 * 默认 views 不可删除：id 用 `default-*` 前缀，与用户 view（`personal-*` / `team-*`）隔离。
 * 消费方在 viewsItems 合并时把默认放最前。
 */
const DEFAULT_VIEW_TIMESTAMP = '2026-04-30T00:00:00.000Z'

function makeDefaultView(
  id: string,
  label: string,
  scope: ViewScope,
  query: PersistedQuery,
): TableView {
  return {
    id: `default-${id}`,
    label,
    scope,
    query,
    createdAt: DEFAULT_VIEW_TIMESTAMP,
    updatedAt: DEFAULT_VIEW_TIMESTAMP,
  }
}

export const DEFAULT_VIEWS: readonly TableView[] = [
  makeDefaultView('my-pending-review', '我的待审', 'personal', {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: 'created_at', direction: 'desc' },
    filters: new Map([['reviewStatus', { kind: 'enum', value: ['pending_review'] }]]),
    columns: new Map(),
  }),
  makeDefaultView('this-week', '本周', 'personal', {
    pagination: { page: 1, pageSize: 50 },
    sort: { field: 'created_at', direction: 'desc' },
    // VIDEO-FILTER-TIME-RANGE follow-up：补 createdSince filter 后改精确时间区间
    filters: new Map(),
    columns: new Map(),
  }),
  makeDefaultView('image-broken', '封面失效', 'team', {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: 'created_at', direction: 'desc' },
    // VIDEO-FILTER-IMAGE-HEALTH follow-up：补 imageHealth enum filter 后改精确过滤
    filters: new Map(),
    // columns 空 Map（不操作列可见性）：useTableQuery 的 applyPatch.columns 是完全替换
    // 语义（不是 merge），单独写 image_health 会清空其他列可见性。视觉突出 P0 Pill 改由
    // VIDEO-FILTER-IMAGE-HEALTH follow-up 加 imageHealth filter 实现，本视图当前仅做
    // sort + label 标记。
    columns: new Map(),
  }),
  makeDefaultView('team-published', '团队新增上架', 'team', {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: 'created_at', direction: 'desc' },
    filters: new Map([['status', { kind: 'enum', value: ['published'] }]]),
    columns: new Map(),
  }),
]
