/**
 * VideoMergesService.schemas.ts — zod 验证 schema + 评分算法辅助函数
 * 从 VideoMergesService.ts 拆出，覆盖 Schema 定义和内部 helpers
 */

import { z } from 'zod'
import type {
  VideoSummaryForMerge,
} from '@resovo/types'
import type { RawVideoDetailRow } from '@/api/db/queries/video-merge-candidates'

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
})

export const MergeSchema = z.object({
  sourceVideoIds: z.array(z.string().uuid()).min(1).max(10),
  targetVideoId: z.string().uuid(),
  reason: z.string().max(500).optional(),
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
