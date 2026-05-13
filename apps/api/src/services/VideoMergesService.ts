/**
 * VideoMergesService.ts — video 合并候选预览业务层（ADR-105 / CHG-SN-5-09）
 *
 * 职责（本卡范围）：
 *   - listCandidates(): 查询候选组 + 计算 source_overlap_ratio 评分 + minScore 过滤 + 分页
 *
 * CHG-SN-5-10 范围（不在本卡）：
 *   - merge() / unmerge() / split() mutation 端点业务逻辑
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import type {
  ListCandidatesParams,
  ListCandidatesResult,
  CandidateGroup,
  VideoSummaryForMerge,
} from '@resovo/types'
import {
  fetchRawCandidateGroups,
  countRawCandidateGroups,
  fetchVideoDetailsForCandidates,
  type RawVideoDetailRow,
} from '@/api/db/queries/video-merge-candidates'

// ── zod schema（ADR-105 §端点契约）────────────────────────────────

const VideoTypeEnum = z.enum([
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
])

export const ListCandidatesSchema = z.object({
  type: VideoTypeEnum.optional(),
  minScore: z.coerce.number().min(0).max(1).default(0.6),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
})

// ── 评分算法 v1（ADR-105 §4）──────────────────────────────────────

/**
 * 计算 source_overlap_ratio：
 * 组内 ≥2 个 video 共享的 source_site_key 数 / 组内所有 unique site_key 数
 * ∈ [0, 1]；空 site_keys 时 score = 0。
 */
function computeOverlapScore(videos: readonly VideoSummaryForMerge[]): number {
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
function pickRecommendedTarget(videos: readonly VideoSummaryForMerge[]): string {
  return [...videos].sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
    return a.createdAt.localeCompare(b.createdAt)
  })[0]?.id ?? videos[0]!.id
}

/** 将 DB 原始行映射为 VideoSummaryForMerge */
function mapVideoRow(row: RawVideoDetailRow): VideoSummaryForMerge {
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

// ── Service ──────────────────────────────────────────────────────

export class VideoMergesService {
  constructor(private db: Pool) {}

  async listCandidates(params: ListCandidatesParams): Promise<ListCandidatesResult> {
    const { type = null, minScore, limit, page } = params
    const typeFilter = type ?? null

    // 两步查询：先取候选组，再批量取 video 详情
    const offset = (page - 1) * limit
    const [rawGroups, total] = await Promise.all([
      fetchRawCandidateGroups(this.db, { type: typeFilter, offset, limit }),
      countRawCandidateGroups(this.db, { type: typeFilter }),
    ])

    if (rawGroups.length === 0) {
      return { data: [], total, page, limit }
    }

    // 批量获取所有相关 video 的详情
    const allVideoIds = rawGroups.flatMap(g => g.video_ids)
    const videoDetails = await fetchVideoDetailsForCandidates(this.db, allVideoIds)
    const videoMap = new Map(videoDetails.map(v => [v.id, mapVideoRow(v)]))

    // 组装候选组 + 计算评分 + 过滤
    const groups: CandidateGroup[] = []
    for (const raw of rawGroups) {
      const videos = raw.video_ids
        .map(id => videoMap.get(id))
        .filter((v): v is VideoSummaryForMerge => v !== undefined)

      if (videos.length < 2) continue

      const score = computeOverlapScore(videos)
      if (score < minScore) continue

      groups.push({
        groupKey: `${raw.title_normalized}|${raw.year ?? ''}|${raw.type}`,
        titleNormalized: raw.title_normalized,
        year: raw.year,
        type: raw.type,
        videos,
        score: Math.round(score * 10000) / 10000,  // 4 位小数
        recommendedTargetVideoId: pickRecommendedTarget(videos),
      })
    }

    // 按 score 降序排列（同 DB 已按 COUNT DESC 初排，此处用 score 覆盖）
    groups.sort((a, b) => b.score - a.score)

    return { data: groups, total, page, limit }
  }
}
