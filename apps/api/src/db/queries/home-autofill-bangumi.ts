// home-autofill-bangumi.ts — Bangumi 候选源 DB 查询（ADR-183 D-183-4.2 / D-183-7.1）
// 所有 SQL 参数化，不拼接字符串（db-rules.md）
//
// nsfw=true **硬过滤在 SQL**（候选与缺口双路径；当前 0 行仍必须实装——增量数据防线，
// ADR-161 Y5 同口径）：硬过滤 = 不入候选池，区别于过滤链 filtered 解释保留。
// 源查询不预过滤可见性（filtered 候选保留入快照解释，与 douban 同范式，D-183-4.5）。

import type { Pool } from 'pg'

// ── 候选源行（已映射到站内 anime 视频）──────────────────────────────────────

export interface BangumiCandidateSourceRow {
  videoId: string
  slug: string
  title: string
  type: string
  isPublished: boolean
  visibilityStatus: string
  contentRating: string
  siteIsAdult: boolean
  updatedAt: string
  coverUrl: string | null
  year: number | null
  catalogRating: number | null
  bangumiId: number
  /** bangumi rank（主序信号 D-183-4.2；缺失排后） */
  bangumiRank: number | null
  bangumiRating: number | null
  sourceCheckStatus: string
  activeSourceCount: number
}

interface DbCandidateRow {
  video_id: string
  slug: string
  title: string
  type: string
  is_published: boolean
  visibility_status: string
  content_rating: string
  site_is_adult: boolean
  updated_at: string
  cover_url: string | null
  year: number | null
  catalog_rating: string | number | null
  bangumi_id: number
  bangumi_rank: number | null
  bangumi_rating: string | number | null
  source_check_status: string
  active_source_count: number
}

function numOrNull(v: string | number | null): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 已映射 Bangumi 条目 → 站内 anime 候选源行（分池 videos.type='anime'，D-183-1）。
 * 映射桥三源 UNION（douban 同范式；bangumi_subject_id INT 直连 / ver·cer ::TEXT cast）：
 *   ① media_catalog.bangumi_subject_id
 *   ② video_external_refs（provider='bangumi'，is_primary + manual_confirmed 保守口径）
 *   ③ catalog_external_refs（provider='bangumi'，relation='exact'）
 * 同 video 多映射时取 rank 最优条目（DISTINCT ON + rank ASC NULLS LAST）。
 */
export async function listBangumiCandidateSourceRows(
  db: Pool,
  limit: number,
): Promise<BangumiCandidateSourceRow[]> {
  const result = await db.query<DbCandidateRow>(
    `WITH bridge AS (
       SELECT v.id AS video_id, mc.bangumi_subject_id AS bangumi_id
         FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id
        WHERE mc.bangumi_subject_id IS NOT NULL
       UNION
       SELECT ver.video_id, ver.external_id::int AS bangumi_id
         FROM video_external_refs ver
        WHERE ver.provider = 'bangumi' AND ver.is_primary = true
          AND ver.match_status = 'manual_confirmed'
          AND ver.external_id ~ '^[0-9]+$'
       UNION
       SELECT v2.id AS video_id, cer.external_id::int AS bangumi_id
         FROM catalog_external_refs cer
         JOIN videos v2 ON v2.catalog_id = cer.catalog_id
        WHERE cer.provider = 'bangumi' AND cer.relation = 'exact'
          AND cer.external_id ~ '^[0-9]+$'
     )
     SELECT DISTINCT ON (v.id)
            v.id AS video_id, v.slug, v.title, v.type,
            v.is_published, v.visibility_status, v.content_rating,
            COALESCE(cs.is_adult, false) AS site_is_adult,
            v.updated_at::TEXT AS updated_at,
            mc.cover_url, mc.year, mc.rating AS catalog_rating,
            be.bangumi_id, be.rank AS bangumi_rank, be.rating AS bangumi_rating,
            v.source_check_status,
            (SELECT COUNT(*)::int FROM video_sources vs
              WHERE vs.video_id = v.id AND vs.is_active = true AND vs.deleted_at IS NULL
            ) AS active_source_count
       FROM bridge b
       JOIN videos v ON v.id = b.video_id AND v.deleted_at IS NULL AND v.type = 'anime'
       JOIN external_data.bangumi_entries be
         ON be.bangumi_id = b.bangumi_id AND be.nsfw = false
       JOIN media_catalog mc ON mc.id = v.catalog_id
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
      ORDER BY v.id, be.rank ASC NULLS LAST
      LIMIT $1`,
    [Math.min(limit, 500)],
  )
  return result.rows.map((row) => ({
    videoId: row.video_id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    isPublished: row.is_published,
    visibilityStatus: row.visibility_status,
    contentRating: row.content_rating,
    siteIsAdult: row.site_is_adult,
    updatedAt: row.updated_at,
    coverUrl: row.cover_url,
    year: row.year,
    catalogRating: numOrNull(row.catalog_rating),
    bangumiId: row.bangumi_id,
    bangumiRank: row.bangumi_rank,
    bangumiRating: numOrNull(row.bangumi_rating),
    sourceCheckStatus: row.source_check_status,
    activeSourceCount: row.active_source_count,
  }))
}

// ── 缺口源行（未映射条目，D-183-7.1：建库复用 ADR-161 BangumiSeedService）────

export interface BangumiGapSourceRow {
  bangumiId: number
  title: string
  coverUrl: string | null
  bangumiRank: number | null
  bangumiRating: string | number | null
}

interface DbGapRow {
  bangumi_id: number
  title: string
  cover_url: string | null
  rank: number | null
  rating: string | number | null
}

/**
 * 未映射 Bangumi 条目（rank ASC 主序预截；nsfw 硬过滤同候选路径）。
 * 治理层只读透出——建库动作走 ADR-161 决策 7 既有路径，不在本查询语义内。
 */
export async function listBangumiGapSourceRows(
  db: Pool,
  scanWindow: number,
): Promise<BangumiGapSourceRow[]> {
  const result = await db.query<DbGapRow>(
    `SELECT be.bangumi_id, COALESCE(be.title_cn, be.title_jp) AS title,
            be.cover_url, be.rank, be.rating
       FROM external_data.bangumi_entries be
      WHERE be.nsfw = false
        AND NOT EXISTS (
              SELECT 1 FROM media_catalog mc WHERE mc.bangumi_subject_id = be.bangumi_id
            )
        AND NOT EXISTS (
              SELECT 1 FROM video_external_refs ver
               WHERE ver.provider = 'bangumi' AND ver.external_id = be.bangumi_id::TEXT
                 AND ver.is_primary = true AND ver.match_status = 'manual_confirmed'
            )
        AND NOT EXISTS (
              SELECT 1 FROM catalog_external_refs cer
               WHERE cer.provider = 'bangumi' AND cer.external_id = be.bangumi_id::TEXT
                 AND cer.relation = 'exact'
            )
      ORDER BY be.rank ASC NULLS LAST, be.rating DESC NULLS LAST
      LIMIT $1`,
    [Math.min(scanWindow, 2000)],
  )
  return result.rows.map((row) => ({
    bangumiId: row.bangumi_id,
    title: row.title,
    coverUrl: row.cover_url,
    bangumiRank: row.rank,
    bangumiRating: row.rating,
  }))
}
