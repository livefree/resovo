/**
 * video-merge.types.ts — video 合并/拆分业务类型（ADR-105 / CHG-SN-5-09）
 *
 * 仅 candidate 预览相关类型；merge/split/unmerge mutation 类型在 CHG-SN-5-10 补齐。
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
