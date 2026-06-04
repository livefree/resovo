/**
 * video-merge.types.ts — video 合并/拆分业务类型（ADR-105 / CHG-SN-5-09/-10）
 */

import type { VideoType } from './video.types'
import type { GroupIdentityScore } from './identity-evidence.types'

/** 候选组中单个 video 摘要 */
export interface VideoSummaryForMerge {
  readonly id: string
  readonly title: string
  readonly titleNormalized: string
  readonly year: number | null
  readonly type: VideoType
  readonly createdAt: string
  /** 该 video 的 source 数量 */
  readonly sourceCount: number
  /** 该 video 的去重 source_site_key 集合 */
  readonly sourceSiteKeys: readonly string[]
}

/**
 * 合并候选组（按 title_normalized + year + type 三元组聚合，HAVING COUNT > 1）
 *
 * score = source_overlap_ratio ∈ [0, 1]：
 *   共享 source_site_key（出现在 ≥2 个 video 中的 key）数 / 组内总 unique key 数
 *   ADR-105 §4 评分函数 v1（基线）
 */
export interface CandidateGroup {
  readonly groupKey: string           // `${titleNormalized}|${year ?? ''}|${type}` 唯一标识
  readonly titleNormalized: string
  readonly year: number | null
  readonly type: VideoType
  readonly videos: readonly VideoSummaryForMerge[]
  /** source_overlap_ratio ∈ [0, 1]（legacyScore / ADR-105 v1 排序口径） */
  readonly score: number
  /** 推荐合并目标：source 最多的 video，同等时取最早 createdAt */
  readonly recommendedTargetVideoId: string
  /**
   * ADR-105a D-105a-6/9/15：多证据身份评分（与 legacyScore=`score` 字段分离 / 红线 R3）。
   * Phase 2a（CHG-VIR-7）新增展示字段，**不参与排序/计数/分页**（D-105a-15 黄线 b1）；
   * optional 兼容旧消费方 + 评分异常时可省略而不破坏候选行返回。
   */
  readonly identity?: GroupIdentityScore
  /**
   * CHG-VIR-9-C：identity_candidate.id（source=identity 时填充 / legacy 来源不填）。
   * UI confirm（merge 透传 candidateId / ADR-178 D-178-3）与 reject 操作锚点；
   * 纯增量 optional，沿 9-A SimilarVideoItem.candidateId 同款模式向后兼容。
   * CHG-VIR-9-D：折叠后 N>2 group 含多 pair 时不填（改用 candidateIds），N=2 单 pair 时保留填充。
   */
  readonly candidateId?: string
  /**
   * CHG-VIR-9-D / D-105a-18：折叠后该连通分量内全部 pending pair 的 identity_candidate.id
   * （source=identity 时填充）。merge 整组 confirm 时透传给 MergeParams.candidateIds。
   */
  readonly candidateIds?: readonly string[]
}

export interface ListCandidatesParams {
  readonly type?: VideoType
  readonly minScore: number
  readonly limit: number
  readonly page: number
  /**
   * ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：Merge 候选表 sort 全栈打通
   * Service 层 sort 范式（score 是 Service 派生 / DB 无该字段）/ 跨页不严格稳定（pre-existing 设计局限）
   * 白名单 4 字段（D-150 列固有自动过滤 sort 版）
   */
  readonly sortField?: 'score' | 'videoCount' | 'year' | 'titleNormalized'
  readonly sortDir?: 'asc' | 'desc'
  /**
   * CHG-VIR-9-A：候选来源。`legacy`（默认）=实时 group-by（ADR-105 v1）；
   * `identity`=读 identity_candidate（多证据候选，空表自动降级 legacy）。
   */
  readonly source?: 'identity' | 'legacy'
}

export interface ListCandidatesResult {
  readonly data: readonly CandidateGroup[]
  readonly total: number
  readonly page: number
  readonly limit: number
  /** 回显实际使用来源（identity 空表降级时为 legacy / CHG-VIR-9-A）。 */
  readonly source?: 'identity' | 'legacy'
}

// ── CHG-SN-5-10：mutation 端点类型 ───────────────────────────────────

export interface MergeParams {
  readonly sourceVideoIds: string[]
  readonly targetVideoId: string
  readonly reason?: string
  /**
   * CHG-VIR-9-B / ADR-178 D-178-3：关联 identity_candidate（confirmed→merge 单事务 / R8）。
   * 提供时事务前校验 candidate pending + pair⊆合并集合，事务内挂 decision(confirmed)+candidate confirmed；
   * 缺省时 merge 行为逐值不变（主路径零变更）。
   * @deprecated CHG-VIR-9-D：新消费方用 candidateIds（数组）；单数保留向后兼容，二者互斥。
   */
  readonly candidateId?: string
  /**
   * CHG-VIR-9-D / D-105a-18：折叠组 confirm——该连通分量全部 pending pair 的 candidate id。
   * 事务内循环挂 K 个 decision(confirmed) 同一 audit_id；与 candidateId（单数）互斥。
   * cap = C(11,2) = 55（merge 集合上限 11 视频的完全图 pair 数 / Codex review FIX）。
   */
  readonly candidateIds?: readonly string[]
}

export interface MergeResult {
  readonly auditId: string
  // ADR-105 §端点契约 row 2：返回合并后 target 完整摘要（含 sourceCount/sourceSiteKeys 反映新状态）
  readonly targetVideo: VideoSummaryForMerge
}

export interface UnmergeParams {
  readonly auditId: string
  readonly actorId: string
  readonly reason?: string
}

export interface UnmergeResult {
  readonly restoredVideoIds: string[]
}

export interface SplitGroup {
  readonly sourceIds: string[]
  /**
   * 拆到新建 video 的元数据。ADR-105 AMENDMENT 2026-06-03（D-105-2）起与
   * `targetVideoId` **恰一互斥**（旧请求体全组 newVideoMeta 完全兼容）。
   */
  readonly newVideoMeta?: {
    readonly title: string
    readonly year?: number
    readonly type: VideoType
  }
  /**
   * 拆到已有 video（D-105-2）：仅转入 sources，不改已有 video 任何元数据（D-105-5 / R-105-S3）。
   * 约束：≠ 被拆 videoId / 组间互不重复 / 存在且未软删 / 冲突预检（D-105-3）。
   */
  readonly targetVideoId?: string
}

// ADR-105 §端点契约 row 4 Body 仅 { groups }，无 reason；保持类型与协议一致
export interface SplitParams {
  readonly videoId: string
  readonly groups: readonly SplitGroup[]
}

export interface SplitResult {
  readonly auditId: string
  /** 本次 split **新建**的 video ids（拆到已有 video 的组不在内 / D-105-4 created_target_video_ids 同源） */
  readonly newVideoIds: string[]
}

// ── ADR-105 AMENDMENT 2026-06-03（CHG-VIR-11 / Phase 4 拆分证据化）─────────
// GET /admin/videos/:id/split-suggestions 响应契约（D-105-1）。
// sourceSiteKey/sourceName 为非空 string（R-105-S9：与 LineMatrixRow 真源同口径，
// 线路键 = (COALESCE(source_site_key, videos.site_key), source_name) 与 getVideoMatrix 逐字一致）。

/** 拆分建议分组维度（确定性单维，优先级 core_title_key > season > release_marker > edition） */
export type SplitSuggestionDimension = 'core_title_key' | 'season' | 'release_marker' | 'edition'

/** 单条线路（= getVideoMatrix 的 (siteKey, sourceName) 行，line 粒度不丢） */
export interface SplitSuggestionLine {
  /** COALESCE(source_site_key, videos.site_key) 后非空（'' 兜底与 LineMatrixRow 同口径） */
  readonly sourceSiteKey: string
  /** video_sources.source_name NOT NULL */
  readonly sourceName: string
  /** 该线路全部 video_sources.id */
  readonly sourceIds: readonly string[]
  readonly episodeRange: { readonly min: number | null; readonly max: number | null }
  /** 所属 site 观测 top-K 展示（observed_count 降序） */
  readonly observedTitles: readonly { readonly rawTitle: string; readonly observedCount: number }[]
}

export interface SplitSuggestionGroup {
  /** 确定性：`${dimension}:${facetValue}` */
  readonly groupKey: string
  /** 维度值（season → '2'；core_title_key → key 本身） */
  readonly facetValue: string
  readonly lines: readonly SplitSuggestionLine[]
  /** 预填 newVideoMeta（year 不预填 / D-105-1；title = dominant raw_title，可含源站噪声 Y-105-S4） */
  readonly suggestedMeta: { readonly title: string; readonly type: VideoType }
}

/** video 级拆分信号（不参与线路归组） */
export type SplitSignal =
  | { readonly kind: 'external_id_conflict'; readonly providers: readonly string[] }
  | { readonly kind: 'episode_overlap'; readonly lineKeys: readonly string[] }
  /** site 内多标题盲区提示（同 site 线路必然同组，site 内多作品须人工核查 / 第 2 轮 advisory-strong） */
  | { readonly kind: 'intra_site_multi_title'; readonly siteKey: string }
  | {
      readonly kind: 'multi_core_title' | 'multi_season' | 'multi_release_marker' | 'multi_edition'
      readonly values: readonly string[]
    }

export interface SplitSuggestionsResult {
  readonly videoId: string
  /** groups.length >= 2 */
  readonly suggestible: boolean
  readonly dimension: SplitSuggestionDimension | null
  readonly signals: readonly SplitSignal[]
  readonly groups: readonly SplitSuggestionGroup[]
  /** 无观测 / 维度 facet 缺失的线路（留运营手动，禁止猜测归组 / R-105-S2） */
  readonly unassignedLines: readonly SplitSuggestionLine[]
}

/** video_merge_audit 行（Service 层内部用） */
export interface VideoMergeAuditRow {
  readonly id: string
  readonly action: 'merge' | 'split'
  readonly sourceVideoIds: string[]
  readonly targetVideoIds: string[]
  readonly snapshotJsonb: Record<string, unknown>
  readonly performedBy: string
  readonly reason: string | null
  readonly performedAt: string
  readonly revertedAt: string | null
  readonly revertedBy: string | null
  readonly revertedReason: string | null
}

// ── CHG-SN-6-AUDIT-TIMELINE (RETRO 4/7) — GET /admin/video-merges/audit ─────────

/** audit timeline row（GET 端点返回；ADR-105 AMENDMENT 2026-05-14）*/
export interface MergeAuditRow {
  readonly id: string
  readonly action: 'merge' | 'split'
  readonly sourceVideoIds: readonly string[]
  readonly targetVideoIds: readonly string[]
  readonly performedBy: string
  readonly performedByUsername: string | null  // LEFT JOIN users.username
  readonly reason: string | null
  readonly performedAt: string
  readonly revertedAt: string | null
  readonly revertedBy: string | null
  readonly revertedReason: string | null
}

export interface ListAuditParams {
  readonly action?: 'merge' | 'split'
  readonly videoId?: string
  readonly limit: number
  readonly page: number
}

export interface ListAuditResult {
  readonly data: readonly MergeAuditRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}
