/**
 * metadata-status.types.ts — 统一「元数据状态」契约（ADR-201 / META-32-A）
 *
 * 后台审核详情、视频编辑抽屉、视频库表格三处的元数据展示**唯一**消费 `MetadataStatusSummary`，
 * 不再各自拼接 `douban_status` / `bangumi_status` / `meta_score` / `externalRefs` 形成临时状态
 * （ADR-201 D-201-2）。服务端集中派生（`buildMetadataStatusSummary`，
 * `apps/api/src/db/queries/metadata-status.derive.ts`），UI 只读、不在 cell/tooltip 现算核心状态。
 *
 * 旧 `EnrichmentSummary`（video.types.ts）进入过渡兼容层（D-201-D），API 兼容期同时返回两者，
 * 新 UI 只读 `metadataStatus`。
 *
 * 枚举一律 const + type 双形态（ADR-157 D-157-1），供服务端派生 / zod `csvEnum` 过滤校验
 * （META-32-B）/ 单测对拍复用。
 */

import type { VideoType } from './video.types'

// ── 四来源（ADR-201 D-201-3 / 与 EXTERNAL_REF_PROVIDERS 成员集合相等）──────────

/** 元数据来源（四源，与 `EXTERNAL_REF_PROVIDERS` 成员集合相等，但顺序语义不同——见 `METADATA_PROVIDER_ORDER`）。 */
export const METADATA_PROVIDERS = ['douban', 'bangumi', 'tmdb', 'imdb'] as const
export type MetadataProvider = typeof METADATA_PROVIDERS[number]

/**
 * 视频库「已匹配源」过滤哨兵（META-36-C）：未匹配任何源（四 provider state 皆非 `applied`）。
 * 「已匹配」严格指 provider state=`applied`（区别于 `metadataProvider` facet 的「有数据」含 candidate/problem）。
 */
export const METADATA_MATCHED_NONE = 'none' as const

/**
 * 「已匹配源」过滤值域 = 四 provider（选中即「该源 state=applied」命中，OR 合流）∪ `none`（四源皆非 applied）。
 * 后端 route `csvEnum` 校验 + 前端 filterOptions 单一真源（避免 route/UI 值域漂移，META-36-C）。
 */
export const METADATA_MATCHED_FILTER_VALUES = [...METADATA_PROVIDERS, METADATA_MATCHED_NONE] as const
export type MetadataMatchedFilterValue = typeof METADATA_MATCHED_FILTER_VALUES[number]

/**
 * 四来源**显示顺序**常量（ADR-201 D-201-3，对齐 ADR-172 AMD2 logo 行：Douban / Bangumi / TMDB / IMDb）。
 *
 * ⚠ 这是**显示顺序**，**勿**与 `EXTERNAL_REF_PROVIDERS`（`['douban','tmdb','bangumi','imdb']`，
 * DB CHECK / 写侧真源枚举顺序）混用。UI 与服务端遍历 `MetadataStatusSummary.providers`（Record）
 * 时**必须**按本常量顺序，不得依赖 Record key 迭代序。
 */
export const METADATA_PROVIDER_ORDER = ['douban', 'bangumi', 'tmdb', 'imdb'] as const

// ── 整体状态（ADR-201 §Overall 状态 / 按运营处理优先级）──────────────────────

/** 整体元数据状态（管理员看到的总状态；排序优先级见 `statusRank`，1=needs_review 最高）。 */
export const METADATA_STATUS_OVERALLS = [
  'needs_review', 'candidate', 'missing', 'partial', 'complete',
] as const
export type MetadataStatusOverall = typeof METADATA_STATUS_OVERALLS[number]

// ── 单源状态（ADR-201 §Provider 状态）────────────────────────────────────────

/**
 * 单源状态（图标语义）：
 * - `applied`        正常显示 —— 来源数据已应用到 video/catalog 且外部 ID 关系可信。
 * - `candidate`      正常图标 + 黄点 —— 已获取候选/外部 ref 但未应用，需确认或等自动策略。
 * - `problem`        正常图标 + 红点 —— 冲突/被拒重现/低置信阻断/拉取失败/覆盖人工字段等需复核。
 * - `missing`        灰色图标 —— 未获取或未配置凭证/未运行；计入缺失但不一定计入问题。
 * - `not_applicable` 灰色图标 + 不适用 —— 来源对当前类型不适用（如非动画的 Bangumi）；不计缺失惩罚。
 */
export const METADATA_PROVIDER_STATES = [
  'applied', 'candidate', 'problem', 'missing', 'not_applicable',
] as const
export type MetadataProviderState = typeof METADATA_PROVIDER_STATES[number]

// ── 问题等级（ADR-201 §Issue 等级）───────────────────────────────────────────

/** 问题等级：`none` 无 / `info` 说明 / `warn` 候选待确认·低置信·字段缺失 / `danger` 冲突·覆盖人工字段。 */
export const METADATA_ISSUE_LEVELS = ['none', 'info', 'warn', 'danger'] as const
export type MetadataIssueLevel = typeof METADATA_ISSUE_LEVELS[number]

// ── 下一步动作（ADR-201 §DTO 契约）───────────────────────────────────────────

/** 运营下一步建议动作（UI 据此渲染主操作；具体执行由上层传入，DTO 不负责执行）。 */
export const METADATA_NEXT_ACTIONS = [
  'run_enrichment', 'confirm_candidate', 'review_conflict',
  'improve_fields', 'configure_provider', 'none',
] as const
export type MetadataNextAction = typeof METADATA_NEXT_ACTIONS[number]

// ── DTO ──────────────────────────────────────────────────────────────────────

/**
 * 单来源状态明细。
 *
 * 取数真源优先级（ADR-201 D-201-E）：`catalog_external_refs`（canonical）> `video_external_refs`
 * > `media_catalog` 四 ID 列（仅 cache 兜底）。`applied` 不得仅据 `media_catalog.*_id IS NOT NULL`。
 */
export interface MetadataProviderStatus {
  provider: MetadataProvider
  state: MetadataProviderState
  issueLevel: MetadataIssueLevel
  /** 外部 ID（来源 refs 真源 / cache 兜底）；无则 null。 */
  externalId: string | null
  /** 展示用短标签（如外部 ID 或条目名）；i18n 文案由 UI 拼装，本字段仅结构化值。 */
  label: string | null
  /** 命中置信度 0..1。⚠ Phase 1：tmdb / imdb 无 refs 写入路径 → 恒 `null`（META-38 接入后补）。 */
  confidence: number | null
  /** 匹配方式。⚠ Phase 1：tmdb / imdb 无来源 → 恒 `null`。 */
  matchMethod: string | null
  /** 应用时刻（ISO8601）。⚠ Phase 1：无 per-provider 应用列 → 用 refs.linkedAt / enrichedAt 近似，tmdb·imdb 恒 null。 */
  appliedAt: string | null
  /** 拉取时刻。⚠ Phase 1：无 per-provider fetch log → 恒 `null`（TMDB 接入后补 external_fetch_log）。 */
  fetchedAt: string | null
  /** 结构化原因码（如 'cache_without_ref' / 'ref_rejected'）。⚠ Phase 1：仅派生逻辑内部产出，非 DB 取。 */
  reasonCodes: string[]
  /**
   * tooltip 显示行。⚠ ADR-201 与 META-33 协调点（评审 T1 风险 3）：i18n 文案**不**下沉后端 DTO，
   * Phase 1 派生留空数组 `[]`，由 admin-ui `MetadataSourceIconCluster`（META-33）据结构化字段拼装。
   */
  tooltipLines: string[]
}

/** 元数据问题项（驱动整体 issueLevel 与 nextAction）。 */
export interface MetadataStatusIssue {
  /** 结构化问题码（如 'candidate_unconfirmed' / 'id_conflict' / 'cache_without_ref'）。 */
  code: string
  level: MetadataIssueLevel
  /** 关联来源；跨源问题为 null。 */
  provider: MetadataProvider | null
  /** 结构化消息（英文 code 友好名；最终 i18n 展示由 UI 处理）。 */
  message: string
  action: MetadataNextAction
}

/**
 * 统一元数据状态摘要（管理端唯一消费契约，ADR-201 D-201-2）。
 *
 * `providers` 为 `Record<MetadataProvider, MetadataProviderStatus>`，派生服务**必须**对全部四来源
 * （含未接入的 IMDb）产出 entry（未获取归 `missing`、类型不适用归 `not_applicable`），不得缺 key
 * （ADR-201 §派生规则 / D-201-A·B）。遍历显示按 `METADATA_PROVIDER_ORDER`。
 */
export interface MetadataStatusSummary {
  overall: MetadataStatusOverall
  issueLevel: MetadataIssueLevel
  /** 完整度分数 0..100（即 `meta_score`，UI 改称「完整度」）；不表达候选/冲突/待复核。 */
  score: number | null
  /** 最近增强时间（ISO8601 / `meta_quality.enriched_at`）。 */
  enrichedAt: string | null
  /** 主来源（已应用且 isPrimary 的最高优先级来源）；无则 null。 */
  primaryProvider: MetadataProvider | null
  providers: Record<MetadataProvider, MetadataProviderStatus>
  issues: MetadataStatusIssue[]
  nextAction: MetadataNextAction
  /**
   * TMDB 外链命名空间（CHG-TMDB-HREF-KIND / 闭合 D-172-AMD2-C）：TMDB 的 movie 与 tv id 命名空间
   * **独立**，同一数字 id 两边是不同作品。UI 据此选 `/movie/` 或 `/tv/` 路径段（`buildTmdbHref`）。
   * 服务端据 video type 派生（movie→'movie'，其余→'tv'，`tmdbHrefKindOf`）。**必填**——杜绝"忘传即默认 movie"跳错。
   */
  tmdbHrefKind: 'movie' | 'tv'
  /** 服务端派生的排序键（视频库服务端排序消费；META-32-B 走动态 SQL 同口径）。 */
  sort: {
    /** 整体状态排序键（1=needs_review … 5=complete，运营处理优先级）。 */
    statusRank: number
    /** 问题等级排序键（danger 最高）。 */
    issueRank: number
    /** 完整度排序键（= score，null 末位）。 */
    scoreRank: number | null
    /** 更新时间（= enrichedAt，二级排序）。 */
    updatedAt: string | null
  }
}

/**
 * video type → TMDB 外链命名空间（CHG-TMDB-HREF-KIND）：`movie`→`'movie'`，其余全部→`'tv'`
 * （series/anime/variety/documentary/short/… 在 TMDB 皆属 tv）。派生侧填 `MetadataStatusSummary.tmdbHrefKind`。
 */
export function tmdbHrefKindOf(type: VideoType): 'movie' | 'tv' {
  return type === 'movie' ? 'movie' : 'tv'
}
