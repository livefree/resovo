/**
 * home-section.types.ts — Home Curation 区块设置与聚合（ADR-182）
 *
 * section ≠ slot（D-182-2）：banner section 真源是 home_banners 而非
 * home_modules slot；两枚举独立维护、不得互相 import 复用。
 * 新增 section 必须走新 ADR（继承 ADR-052 slot 扩展同款约束）。
 */

/** 7 区块，前台渲染顺序（D-182-2） */
export type HomeSectionKey =
  | 'banner'          // 真源 home_banners（ADR-181 D-181-1）
  | 'type_shortcuts'  // 真源 home_modules.type_shortcuts
  | 'featured'        // 真源 home_modules.featured
  | 'top10'           // 真源 home_modules.top10 + listTrendingVideos 补位
  | 'hot_movies'      // 真源 home_modules.hot_movies（pinned）+ 候选快照（ADR-183）
  | 'hot_series'
  | 'hot_anime'

export const HOME_SECTION_KEYS: readonly HomeSectionKey[] = [
  'banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime',
]

/** 自动填充模式（治理方案 §7.2 / ADR-182 D-182-3） */
export type HomeAutofillMode =
  | 'manual_only'
  | 'manual_plus_autofill'
  | 'suggest_only'
  | 'full_auto'

export const HOME_AUTOFILL_MODES: readonly HomeAutofillMode[] = [
  'manual_only', 'manual_plus_autofill', 'suggest_only', 'full_auto',
]

/** home_section_settings 行（migration 095） */
export interface HomeSectionSettings {
  id: string
  section: HomeSectionKey
  autofillMode: HomeAutofillMode
  /** 分钟；null = 不自动重算（worker 调度消费，ADR-183） */
  refreshIntervalMinutes: number | null
  /** 区块槽位数；空卡片占位 = max(0, displayCount − pinned − auto) */
  displayCount: number
  /** 跨区块去重豁免（方案 §7.1） */
  allowDuplicates: boolean
  /** full_auto 区块 pinned 头部上限；null = 不限 */
  pinnedLimit: number | null
  /** 非关键扩展项；禁关键策略字段（ADR-052 metadata 守则同款） */
  settings: Record<string, unknown>
  updatedAt: string
}

/** PATCH /admin/home/sections/:section/settings body（≥1 字段，D-182-4 #3） */
export interface UpdateHomeSectionSettingsInput {
  autofillMode?: HomeAutofillMode
  refreshIntervalMinutes?: number | null
  displayCount?: number
  allowDuplicates?: boolean
  pinnedLimit?: number | null
  /** JSONB 整体替换（非深合并，与 ADR-104 metadata 同语义） */
  settings?: Record<string, unknown>
}

/** GET /admin/home/sections 响应条目（D-182-4 #2：settings 全量 + 状态摘要） */
export interface HomeSectionSummary {
  settings: HomeSectionSettings
  /** 该 section 真源 pinned 数（banner → home_banners 行数；其余 → home_modules 行数） */
  pinnedCount: number
  /** 最近候选快照时间；null = 未生成（与端点 #4 snapshotAt 同语义同源，D-182-4.4） */
  lastSnapshotAt: string | null
  /** 最近快照候选数；null = 未生成 */
  candidateCount: number | null
  /** type_shortcuts 前台断裂标记（D-182-6.2：前台静态 ALL_CATEGORIES 暂未消费此配置） */
  frontendWired: boolean
}
