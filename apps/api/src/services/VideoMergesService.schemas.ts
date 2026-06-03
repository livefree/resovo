/**
 * VideoMergesService.schemas.ts — zod 验证 schema + 评分算法辅助函数
 * 从 VideoMergesService.ts 拆出，覆盖 Schema 定义和内部 helpers
 */

import { z } from 'zod'
import type {
  VideoSummaryForMerge,
  CandidateGroup,
  EvidenceType,
  EvidenceItem,
  GroupIdentityScore,
} from '@resovo/types'
import type { RawVideoDetailRow } from '@/api/db/queries/video-merge-candidates'
import type { PendingCandidatePairRow } from '@/api/db/queries/identity-candidate'
import { SCORER_VERSION } from './identity'

// ── zod schema（ADR-105 §端点契约）────────────────────────────────

export const VideoTypeEnum = z.enum([
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
])

export const ListCandidatesSchema = z.object({
  type: VideoTypeEnum.optional(),
  minScore: z.coerce.number().min(0).max(1).default(0.6),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单 4 字段（Service 层 sort）
  sortField: z.enum(['score', 'videoCount', 'year', 'titleNormalized']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  // CHG-VIR-9-A：候选来源（legacy 默认 / identity 读 candidate 表，空表降级）
  source: z.enum(['identity', 'legacy']).default('legacy'),
})

export const MergeSchema = z.object({
  sourceVideoIds: z.array(z.string().uuid()).min(1).max(10),
  targetVideoId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  // CHG-VIR-9-B / ADR-178 D-178-3：关联 identity_candidate（confirmed→merge 单事务 / R8）。
  // 纯增量 optional，缺省时 merge 行为逐值不变。
  candidateId: z.string().uuid().optional(),
}).refine(
  v => !v.sourceVideoIds.includes(v.targetVideoId),
  { message: 'targetVideoId 不得在 sourceVideoIds 中', path: ['targetVideoId'] },
).refine(
  v => new Set(v.sourceVideoIds).size === v.sourceVideoIds.length,
  { message: 'sourceVideoIds 不得含重复值', path: ['sourceVideoIds'] },
)

export const UnmergeSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const SplitSchema = z.object({
  groups: z.array(z.object({
    sourceIds: z.array(z.string().uuid()).min(1),
    newVideoMeta: z.object({
      title: z.string().min(1).max(500),
      year: z.number().int().min(1800).max(2100).optional(),
      type: VideoTypeEnum,
    }),
  })).min(2).max(20),
})

// CHG-SN-6-AUDIT-TIMELINE (RETRO 4/7) — ADR-105 AMENDMENT 2026-05-14
export const ListAuditSchema = z.object({
  action: z.enum(['merge', 'split']).optional(),
  videoId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
}).strict()

// ── 评分算法 v1（ADR-105 §4）──────────────────────────────────────

/**
 * 计算 source_overlap_ratio：
 * 组内 ≥2 个 video 共享的 source_site_key 数 / 组内所有 unique site_key 数
 * ∈ [0, 1]；空 site_keys 时 score = 0。
 */
export function computeOverlapScore(videos: readonly VideoSummaryForMerge[]): number {
  const allKeys = new Set<string>()
  const keyCount = new Map<string, number>()

  for (const v of videos) {
    for (const key of v.sourceSiteKeys) {
      allKeys.add(key)
      keyCount.set(key, (keyCount.get(key) ?? 0) + 1)
    }
  }

  if (allKeys.size === 0) return 0

  let sharedCount = 0
  for (const count of keyCount.values()) {
    if (count >= 2) sharedCount++
  }

  return sharedCount / allKeys.size
}

/**
 * 推荐合并 target：source 最多的 video；同等时取最早 createdAt。
 */
export function pickRecommendedTarget(videos: readonly VideoSummaryForMerge[]): string {
  return [...videos].sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
    return a.createdAt.localeCompare(b.createdAt)
  })[0]?.id ?? videos[0]!.id
}

/** 将 DB 原始行映射为 VideoSummaryForMerge */
export function mapVideoRow(row: RawVideoDetailRow): VideoSummaryForMerge {
  return {
    id: row.id,
    title: row.title,
    titleNormalized: row.title_normalized,
    year: row.year,
    type: row.type,
    createdAt: row.created_at,
    sourceCount: parseInt(row.source_count, 10),
    sourceSiteKeys: row.site_keys,
  }
}

/**
 * CHG-VIR-9-A：identity_candidate pending pair → 2-video CandidateGroup（merge source=identity）。
 * blockingReasons 从 evidence 重算（hit 正向，排除强负 + 弱信号 / 与 scorePair 口径一致）。
 */
export function buildGroupFromPair(
  p: PendingCandidatePairRow,
  videoMap: Map<string, VideoSummaryForMerge>,
): CandidateGroup | null {
  const left = videoMap.get(p.left_video_id)
  const right = videoMap.get(p.right_video_id)
  if (!left || !right) return null
  const identityScore = Number(p.identity_score)
  const strongNegativeReasons = p.strong_negative_reasons as EvidenceType[]
  const evidence = Array.isArray(p.evidence_jsonb) ? (p.evidence_jsonb as EvidenceItem[]) : []
  const blockingReasons = evidence
    .filter((e) => e.hit && e.polarity !== 'strong-negative' && e.type !== 'release_marker_weak_signal')
    .map((e) => e.type)
  const autoMergeBlocked = strongNegativeReasons.length > 0
  const identity: GroupIdentityScore = {
    identityScore,
    strongNegativeReasons,
    blockingReasons,
    autoMergeBlocked,
    pairs: [{
      leftVideoId: p.left_video_id,
      rightVideoId: p.right_video_id,
      identityScore,
      strongNegativeReasons,
      blockingReasons,
      evidence,
      autoMergeBlocked,
    }],
    scorerVersion: SCORER_VERSION,
  }
  return {
    groupKey: `${p.left_video_id}|${p.right_video_id}`,
    titleNormalized: left.titleNormalized,
    year: left.year,
    type: left.type,
    videos: [left, right],
    score: p.legacy_score != null ? Number(p.legacy_score) : 0,
    recommendedTargetVideoId: pickRecommendedTarget([left, right]),
    identity,
  }
}
