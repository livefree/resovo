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

// ── preview 聚合 DTO（CHG-HOME-PREVIEW-API-B / ADR-182 D-182-4 #1）──────────

/** 卡片来源（D-182-4 #1） */
export type HomePreviewCardSource = 'pinned' | 'auto' | 'fallback' | 'empty'

/**
 * 风险态 flags（警告级，方案 §6 不阻断）。
 * missing_wide_image（banner 专属尺寸/比例警告）与 unplayable 的判定深化归
 * Phase 2 IMAGE-GUARD-BANNER / Phase 3 候选过滤链；本版 unplayable = sourceCount 0。
 */
export type HomePreviewCardFlag =
  | 'missing_image'
  | 'missing_wide_image'
  | 'pending'      // 待生效（startAt > at）
  | 'expired'      // 已过期（endAt ≤ at）
  | 'disabled'     // enabled=false / is_active=false
  | 'ref_broken'   // video 引用失效（已下线/未发布）
  | 'unplayable'   // 无可播源

export interface HomePreviewCard {
  source: HomePreviewCardSource
  /** pinned 时为 home_modules.id / home_banners.id；auto·fallback 为 null；empty 为 null */
  refId: string | null
  videoId: string | null
  title: string | null
  imageUrl: string | null
  /** 跳转目标摘要（banner linkTarget / video slug / video_type 值） */
  linkHint: string | null
  /** D-181-3 统一时间窗 DTO（home_banners.active_from→startAt / active_to→endAt / is_active→enabled） */
  startAt: string | null
  endAt: string | null
  enabled: boolean
  flags: HomePreviewCardFlag[]
  /** auto / fallback 卡解释摘要（origin 开放字符串，D-182-4.4 同口径） */
  explain: { origin: string; rank: number; score: number | null } | null
}

export interface HomePreviewSection {
  key: HomeSectionKey
  settings: HomeSectionSettings
  cards: HomePreviewCard[]
}

/** GET /admin/home/preview 响应（Phase 1 = 正式配置预览，无草稿叠加，D-182-4 #1） */
export interface HomePreview {
  sections: HomePreviewSection[]
  generatedAt: string
  /** 请求上下文回显（device 仅 UI 用，不影响数据） */
  context: {
    brandSlug: string | null
    locale: string | null
    at: string | null
    device: 'desktop' | 'mobile'
  }
}

// ── 自动填充候选与缺口 DTO（ADR-182 D-182-4.4 + ADR-183 D-183-7.3）──────────

/** 候选视频摘要（快照 JSONB 内嵌；展示最小集，非 VideoCard 全量） */
export interface AutofillVideoSummary {
  title: string
  slug: string
  coverUrl: string | null
  /** 站内 videos.type（D-183-1 分池信号，值域同 VideoType） */
  type: string
  year: number | null
  rating: number | null
  /** 可播源计数（重校验参考；apply 时仍须实时重查，方案 §12） */
  sourceCount: number
}

/**
 * 端点 #4 候选条目（D-182-4.4 已锁 DTO）。
 * `origin` 为开放字符串（当前 worker 产出 douban / bangumi / trending；
 * 新值随 policy_version 递增引入，不构成 DTO break，消费端对未知值降级展示）。
 * `filterReason` 同为开放字符串（解释模型，常量集见
 * apps/api services/home-autofill/filters.ts FILTER_REASONS）。
 */
export interface AutofillCandidate {
  /** 候选稳定标识（快照生成时分配；端点 #5 apply 按此定位） */
  id: string
  videoId: string
  videoSummary: AutofillVideoSummary
  /** D-183-4 策略分（0–1，惩罚后下钳 0） */
  score: number
  /** 池内排名（1 起；filtered 条目不占名次） */
  rank: number
  origin: string
  /** D-183-4.5 单区块确定性过滤结果（跨区块去重不在快照阶段，D-183-6.1） */
  filtered: boolean
  filterReason?: string
  /** 已被 apply 为 pinned 的时间；未应用为 null/缺省 */
  appliedAt?: string | null
}

/**
 * 内容缺口条目（D-183-7.3：未映射到站内可播视频的外部条目，仅 admin 视图）。
 * 独立 DTO 不复用 AutofillCandidate——无 videoId / videoSummary，结构上不可与候选混淆。
 */
export interface ContentGap {
  /** 'douban' | 'bangumi' 开放字符串 */
  provider: string
  externalId: string
  title: string
  coverUrl?: string | null
  /** D-183-4.1 分数（缺口 top-N 排序依据） */
  score: number
  rank?: number | null
  /** 提示性字段（豆瓣 media_type 不参与分池判定，D-183-1.2） */
  mediaTypeHint?: string | null
}

/**
 * 候选快照行（migration 096 / D-183-2）：worker 整份写入不可变，
 * 端点 #4 整份只读消费；每 section 保留最近 10 份（写入+清理同事务）。
 */
export interface HomeAutofillSnapshot {
  id: string
  section: HomeSectionKey
  /** 即端点 #4 snapshotAt（与 #2 摘要「最近候选快照时间」同语义同源） */
  generatedAt: string
  /** 定时 vs 手动刷新（端点 #7） */
  trigger: 'scheduled' | 'manual'
  /** 策略代码版本（D-183-5；语义变更必须递增） */
  policyVersion: string
  /** 重算时的 section settings 快照（审计回溯链，方案 §11.2） */
  settingsSnapshot: Record<string, unknown>
  candidates: AutofillCandidate[]
  /** 缺口 top-N（D-183-7.3） */
  gaps: ContentGap[]
  createdAt: string
}

/** GET /admin/home/sections/:section/autofill-candidates 响应（D-182-4.4 + gaps additive 扩展） */
export interface AutofillCandidatesResult {
  candidates: AutofillCandidate[]
  /** null = 快照未生成（200 非 404——section 存在即合法） */
  snapshotAt: string | null
  /** 随快照携带；未生成时 null */
  policyVersion: string | null
  /** include_filtered=true 时返回（D-183-7.3 additive，纯增量非 break） */
  gaps?: ContentGap[]
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
