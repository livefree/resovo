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
   */
  readonly candidateId?: string
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
   */
  readonly candidateId?: string
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
  readonly newVideoMeta: {
    readonly title: string
    readonly year?: number
    readonly type: VideoType
  }
}

// ADR-105 §端点契约 row 4 Body 仅 { groups }，无 reason；保持类型与协议一致
export interface SplitParams {
  readonly videoId: string
  readonly groups: readonly SplitGroup[]
}

export interface SplitResult {
  readonly auditId: string
  readonly newVideoIds: string[]
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
