/**
 * video-merge.types.ts — video 合并/拆分业务类型（ADR-105 / CHG-SN-5-09/-10）
 */

import type { VideoType } from './video.types'

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
  /** source_overlap_ratio ∈ [0, 1] */
  readonly score: number
  /** 推荐合并目标：source 最多的 video，同等时取最早 createdAt */
  readonly recommendedTargetVideoId: string
}

export interface ListCandidatesParams {
  readonly type?: VideoType
  readonly minScore: number
  readonly limit: number
  readonly page: number
}

export interface ListCandidatesResult {
  readonly data: readonly CandidateGroup[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

// ── CHG-SN-5-10：mutation 端点类型 ───────────────────────────────────

export interface MergeParams {
  readonly sourceVideoIds: string[]
  readonly targetVideoId: string
  readonly reason?: string
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
