/**
 * registry.ts — Bangumi 派生合集注册表 + 抓取常量（ADR-189 D-189-2）
 *
 * Bangumi 无原生合集端点 → 用 search-sort 与 calendar 派生治理框架所需的「热门/排行/每日放送」：
 *   - trending = POST /v0/search/subjects sort=heat（+当季 air_date filter）
 *   - ranking  = POST /v0/search/subjects sort=rank（高分榜）
 *   - calendar = GET /calendar（每日放送，7 weekday 各一 collection）
 *
 * collection key = 治理框架展示拓扑（代码常量注册表，类比 douban-collections registry / ADR-187 D-187-2）。
 * 抓取常量 **bangumi 专属，不复用豆瓣**（豆瓣常量为页面反爬调；bangumi 是 Bearer Token 官方 API，
 * 限流模型不同，ADR-189 D-189-2 / arch H4）。
 */

import type { BangumiCollectionCategory } from '@/api/db/queries/bangumi-collections'

/** search 派生合集的排序维度（仅 trending/ranking） */
export type BangumiSearchSort = 'heat' | 'rank'

export interface BangumiCollectionEntry {
  /** 合集 key（落库 collection 列） */
  readonly key: string
  readonly category: BangumiCollectionCategory
  /** search 派生专属：sort 维度（trending=heat / ranking=rank） */
  readonly sort?: BangumiSearchSort
  /** calendar 专属：放送星期（1=周一..7=周日） */
  readonly weekday?: number
}

/** 7 weekday key（worker 按 GET /calendar 的 weekday.id 1-7 映射） */
export const CALENDAR_WEEKDAY_KEYS = [
  'bgm_calendar_mon',
  'bgm_calendar_tue',
  'bgm_calendar_wed',
  'bgm_calendar_thu',
  'bgm_calendar_fri',
  'bgm_calendar_sat',
  'bgm_calendar_sun',
] as const

/** 派生合集注册表（trending 1 + ranking 1 + calendar 7 = 9） */
export const BANGUMI_COLLECTIONS: readonly BangumiCollectionEntry[] = [
  { key: 'bgm_trending', category: 'trending', sort: 'heat' },
  { key: 'bgm_ranking', category: 'ranking', sort: 'rank' },
  ...CALENDAR_WEEKDAY_KEYS.map((key, i) => ({
    key,
    category: 'calendar' as const,
    weekday: i + 1, // 1=周一..7=周日
  })),
]

/** 仅 search 派生合集（trending/ranking） */
export const BANGUMI_SEARCH_COLLECTIONS = BANGUMI_COLLECTIONS.filter(
  (c): c is BangumiCollectionEntry & { sort: BangumiSearchSort } => c.sort !== undefined,
)

/** 仅 calendar 合集（7 weekday） */
export const BANGUMI_CALENDAR_COLLECTIONS = BANGUMI_COLLECTIONS.filter(
  (c): c is BangumiCollectionEntry & { weekday: number } => c.weekday !== undefined,
)

/** weekday.id（1-7）→ collection key（worker 按 GET /calendar 分组入库用） */
export function calendarKeyForWeekday(weekday: number): string | null {
  const entry = BANGUMI_CALENDAR_COLLECTIONS.find((c) => c.weekday === weekday)
  return entry?.key ?? null
}

// ── 抓取常量（ADR-189 D-189-2 / arch H4，bangumi 专属不复用豆瓣）─────────────────

/** search 单页 limit（POST /v0/search/subjects limit 上限 50） */
export const SEARCH_PAGE_SIZE = 50
/** trending/ranking 单合集封顶取数 */
export const SEARCH_MAX_ITEMS = 200
/** search 分页间礼貌延时（ms）——Token API 亦有 rate limit，保守 ≥500 */
export const SEARCH_PAGE_DELAY_MS = 500
/** 合集间礼貌延时（ms） */
export const COLLECTION_DELAY_MS = 1000

/** empty_guard 基线（trending/ranking per-collection）：上轮 item_count ≥ 此值才启用骤降守护 */
export const GUARD_MIN_BASELINE = 10
/** empty_guard 骤降比：新量 < 上轮 × 此比 → 视为异常不替换（防 API 失效静默清空） */
export const GUARD_DROP_RATIO = 0.5
/**
 * calendar 守护基线（7 天总量聚合，D-189-2 / arch H4）：calendar 守护落「7 weekday 总量」
 * 而非单 weekday（避免冷档期单日正常波动误判）；总量 ≥ 此值才启用骤降守护。
 */
export const CALENDAR_GUARD_MIN_BASELINE = 30
