/**
 * video-merge-candidates.ts — video 合并候选 DB 查询（ADR-105 / CHG-SN-5-09）
 *
 * 职责：提供两步查询原语；评分算法在 Service 层（VideoMergesService）实施。
 * 依赖索引：idx_videos_normalized_year_type ON videos(title_normalized, year, type)
 *           WHERE deleted_at IS NULL（migration 007）
 */

import type { Pool } from 'pg'
import type { VideoType, ReviewStatus, VisibilityStatus } from '@/types'

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
  // ── ADR-105 AMENDMENT 2026-06-04 D-105-7（CHG-VIR-13-B1）：对比矩阵数据列 ──
  readonly review_status: ReviewStatus
  readonly visibility_status: VisibilityStatus
  readonly catalog_id: string
  readonly catalog_title: string | null
  readonly cover_url: string | null      // 真源 = media_catalog.cover_url（Y-105-T2）
  readonly episode_min: number | null    // MIN(vs.episode_number)，无源 NULL
  readonly episode_max: number | null
  /** jsonb_agg 产物；仅 is_primary + manual_confirmed/auto_matched（每 provider 至多 1 条） */
  readonly external_ids: { readonly provider: string; readonly externalId: string }[]
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
  // CHG-SN-5-13-PATCH-2: title_normalized + year 已 migration 029 迁移到 media_catalog
  // 需 JOIN media_catalog（参 videos.ts:169 VIDEO_JOIN 标准范式）
  const result = await db.query<RawCandidateGroupRow>(
    `SELECT
       mc.title_normalized,
       mc.year,
       v.type,
       ARRAY_AGG(v.id ORDER BY v.created_at ASC) AS video_ids,
       COUNT(*)::text AS video_count
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE v.deleted_at IS NULL
       AND mc.title_normalized IS NOT NULL
       AND ($1::text IS NULL OR v.type = $1)
     GROUP BY mc.title_normalized, mc.year, v.type
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC, mc.title_normalized ASC
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
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
       WHERE v.deleted_at IS NULL
         AND mc.title_normalized IS NOT NULL
         AND ($1::text IS NULL OR v.type = $1)
       GROUP BY mc.title_normalized, mc.year, v.type
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
  // ADR-105 AMENDMENT 2026-06-04 D-105-7（CHG-VIR-13-B1）：对比矩阵数据列扩展。
  // v.review_status / v.visibility_status / v.catalog_id 经主键 v.id 函数依赖免入 GROUP BY；
  // mc.title / mc.cover_url 显式入 GROUP BY；external_ids 走相关子查询（避免与 vs 聚合笛卡尔）。
  const result = await db.query<RawVideoDetailRow>(
    `SELECT
       v.id,
       v.title,
       mc.title_normalized,
       mc.year,
       v.type,
       v.created_at::text AS created_at,
       v.review_status,
       v.visibility_status,
       v.catalog_id,
       mc.title AS catalog_title,
       mc.cover_url,
       MIN(vs.episode_number) AS episode_min,
       MAX(vs.episode_number) AS episode_max,
       COUNT(vs.id)::text AS source_count,
       COALESCE(
         ARRAY_AGG(DISTINCT vs.source_site_key) FILTER (WHERE vs.source_site_key IS NOT NULL),
         '{}'::text[]
       ) AS site_keys,
       (SELECT COALESCE(
                 jsonb_agg(jsonb_build_object('provider', r.provider, 'externalId', r.external_id)
                           ORDER BY r.provider),
                 '[]'::jsonb)
          FROM video_external_refs r
         WHERE r.video_id = v.id
           AND r.is_primary
           AND r.match_status IN ('manual_confirmed', 'auto_matched')
       ) AS external_ids
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     LEFT JOIN video_sources vs ON vs.video_id = v.id AND vs.deleted_at IS NULL
     WHERE v.id = ANY($1::uuid[])
     GROUP BY v.id, mc.title_normalized, mc.year, mc.title, mc.cover_url`,
    [videoIds],
  )
  return result.rows
}

// ── ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL-BE）：轻元数据 ──

/** 组级 q 搜索 / title·year 排序用轻行（评审 Y-1：title_normalized/year 在 media_catalog）。 */
export interface VideoMetaLightRow {
  readonly id: string
  readonly title: string
  readonly title_normalized: string
  readonly year: number | null
}

/**
 * 批量拉取 video 轻元数据（id/title + catalog 级 title_normalized/year）。
 * D-105a-19 stage 3：仅 q 或 title/year 排序激活时调用，规模 ≤ 2×cap 单次有界 join（无 N+1）。
 */
export async function fetchVideoMetaLight(
  db: Pool,
  videoIds: readonly string[],
): Promise<VideoMetaLightRow[]> {
  if (videoIds.length === 0) return []
  const result = await db.query<VideoMetaLightRow>(
    `SELECT v.id, v.title, mc.title_normalized, mc.year
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE v.id = ANY($1::uuid[])`,
    [videoIds],
  )
  return result.rows
}
