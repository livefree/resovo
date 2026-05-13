/**
 * video-merge-candidates.ts — video 合并候选 DB 查询（ADR-105 / CHG-SN-5-09）
 *
 * 职责：提供两步查询原语；评分算法在 Service 层（VideoMergesService）实施。
 * 依赖索引：idx_videos_normalized_year_type ON videos(title_normalized, year, type)
 *           WHERE deleted_at IS NULL（migration 007）
 */

import type { Pool } from 'pg'
import type { VideoType } from '@/types'

// ── 原始 DB 行类型 ────────────────────────────────────────────────

export interface RawCandidateGroupRow {
  readonly title_normalized: string
  readonly year: number | null
  readonly type: VideoType
  readonly video_ids: string[]
  readonly video_count: string   // COUNT(*) 返回 bigint → string
}

export interface RawVideoDetailRow {
  readonly id: string
  readonly title: string
  readonly title_normalized: string
  readonly year: number | null
  readonly type: VideoType
  readonly created_at: string
  readonly source_count: string  // COUNT(*) → string
  readonly site_keys: string[]   // ARRAY_AGG DISTINCT，可能含 null → 过滤后
}

// ── 查询：候选组（按三元组 GROUP BY HAVING COUNT > 1）────────────────

/**
 * 按 title_normalized + year + type 聚合找出同作品多 video 行候选组。
 * 不含评分；评分由 Service 层基于 video_sources 数据计算。
 *
 * @param type   可选过滤 VideoType（若 null 则不过滤）
 * @param offset SQL OFFSET
 */
export async function fetchRawCandidateGroups(
  db: Pool,
  params: { type: VideoType | null; offset: number; limit: number },
): Promise<RawCandidateGroupRow[]> {
  const { type, offset, limit } = params
  // 使用 idx_videos_normalized_year_type 部分索引（deleted_at IS NULL 已含）
  const result = await db.query<RawCandidateGroupRow>(
    `SELECT
       title_normalized,
       year,
       type,
       ARRAY_AGG(id ORDER BY created_at ASC) AS video_ids,
       COUNT(*)::text AS video_count
     FROM videos
     WHERE deleted_at IS NULL
       AND title_normalized IS NOT NULL
       AND ($1::text IS NULL OR type = $1)
     GROUP BY title_normalized, year, type
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC, title_normalized ASC
     LIMIT $2 OFFSET $3`,
    [type ?? null, limit, offset],
  )
  return result.rows
}

/**
 * 候选组总数（按相同过滤条件）。
 * 注：这是"符合条件的组数"，不是 video 总数。
 */
export async function countRawCandidateGroups(
  db: Pool,
  params: { type: VideoType | null },
): Promise<number> {
  const { type } = params
  const result = await db.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM (
       SELECT 1
       FROM videos
       WHERE deleted_at IS NULL
         AND title_normalized IS NOT NULL
         AND ($1::text IS NULL OR type = $1)
       GROUP BY title_normalized, year, type
       HAVING COUNT(*) > 1
     ) sub`,
    [type ?? null],
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

/**
 * 批量拉取 video 详情 + source 摘要（用于评分计算）。
 * site_keys 过滤掉 NULL 值（source_site_key 可空，migration 046）。
 */
export async function fetchVideoDetailsForCandidates(
  db: Pool,
  videoIds: string[],
): Promise<RawVideoDetailRow[]> {
  if (videoIds.length === 0) return []
  const result = await db.query<RawVideoDetailRow>(
    `SELECT
       v.id,
       v.title,
       v.title_normalized,
       v.year,
       v.type,
       v.created_at::text AS created_at,
       COUNT(vs.id)::text AS source_count,
       COALESCE(
         ARRAY_AGG(DISTINCT vs.source_site_key) FILTER (WHERE vs.source_site_key IS NOT NULL),
         '{}'::text[]
       ) AS site_keys
     FROM videos v
     LEFT JOIN video_sources vs ON vs.video_id = v.id AND vs.deleted_at IS NULL
     WHERE v.id = ANY($1::uuid[])
     GROUP BY v.id`,
    [videoIds],
  )
  return result.rows
}
