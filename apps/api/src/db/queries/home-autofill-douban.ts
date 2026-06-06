// home-autofill-douban.ts — 豆瓣候选源 DB 查询（ADR-183 D-183-1 / D-183-4.1 / D-183-7.2）
// 所有 SQL 参数化，不拼接字符串（db-rules.md）
//
// 分池信号 = 映射后站内 videos.type（D-183-1：douban media_type 100% 'movie' 导入硬编码
// 不可信，仅作缺口提示性字段）。源查询**不预过滤可见性**——被过滤候选须保留入快照
// （filtered + filterReason 解释展示，D-183-4.5），过滤判定归 services/home-autofill/filters。

import type { Pool } from 'pg'

// ── 候选源行（已映射到站内视频）──────────────────────────────────────────────

export interface DoubanCandidateSourceRow {
  videoId: string
  slug: string
  title: string
  type: string
  isPublished: boolean
  visibilityStatus: string
  contentRating: string
  /** 成人源站标记（videos.ts COALESCE(cs.is_adult,false) 同口径） */
  siteIsAdult: boolean
  updatedAt: string
  coverUrl: string | null
  year: number | null
  /** 站内 catalog 评分（videoSummary 展示口径） */
  catalogRating: number | null
  doubanId: string
  doubanVotes: number | null
  doubanRating: number | null
  /** 源活性批量检验态（'partial'/'all_dead' → 源不稳定惩罚信号） */
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
  douban_id: string
  douban_votes: number | null
  douban_rating: string | number | null
  source_check_status: string
  active_source_count: number
}

function numOrNull(v: string | number | null): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 已映射豆瓣条目 → 站内视频候选源行（分池 WHERE videos.type，D-183-1）。
 * 映射桥三源 UNION（externalIdLoader Y-105a-4 同口径 + catalog_external_refs exact）：
 *   ① media_catalog.douban_id（catalog 级直连列）
 *   ② video_external_refs（provider='douban'，is_primary + manual_confirmed 保守口径）
 *   ③ catalog_external_refs（provider='douban'，relation='exact'；candidate 级映射不纳入）
 * 同 video 多映射时取 votes 最高的豆瓣条目（DISTINCT ON）。
 */
export async function listDoubanCandidateSourceRows(
  db: Pool,
  videoType: 'movie' | 'series',
  limit: number,
): Promise<DoubanCandidateSourceRow[]> {
  const result = await db.query<DbCandidateRow>(
    `WITH bridge AS (
       SELECT v.id AS video_id, mc.douban_id AS external_id
         FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id
        WHERE mc.douban_id IS NOT NULL
       UNION
       SELECT ver.video_id, ver.external_id
         FROM video_external_refs ver
        WHERE ver.provider = 'douban' AND ver.is_primary = true
          AND ver.match_status = 'manual_confirmed'
       UNION
       SELECT v2.id AS video_id, cer.external_id
         FROM catalog_external_refs cer
         JOIN videos v2 ON v2.catalog_id = cer.catalog_id
        WHERE cer.provider = 'douban' AND cer.relation = 'exact'
     )
     SELECT DISTINCT ON (v.id)
            v.id AS video_id, v.slug, v.title, v.type,
            v.is_published, v.visibility_status, v.content_rating,
            COALESCE(cs.is_adult, false) AS site_is_adult,
            v.updated_at::TEXT AS updated_at,
            mc.cover_url, mc.year, mc.rating AS catalog_rating,
            de.douban_id, de.douban_votes, de.rating AS douban_rating,
            v.source_check_status,
            (SELECT COUNT(*)::int FROM video_sources vs
              WHERE vs.video_id = v.id AND vs.is_active = true AND vs.deleted_at IS NULL
            ) AS active_source_count
       FROM bridge b
       JOIN videos v ON v.id = b.video_id AND v.deleted_at IS NULL AND v.type = $1
       JOIN external_data.douban_entries de ON de.douban_id = b.external_id
       JOIN media_catalog mc ON mc.id = v.catalog_id
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
      ORDER BY v.id, de.douban_votes DESC NULLS LAST
      LIMIT $2`,
    [videoType, Math.min(limit, 500)],
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
    doubanId: row.douban_id,
    doubanVotes: row.douban_votes,
    doubanRating: numOrNull(row.douban_rating),
    sourceCheckStatus: row.source_check_status,
    activeSourceCount: row.active_source_count,
  }))
}

// ── 缺口源行（未映射条目，D-183-7.2）────────────────────────────────────────

export interface DoubanGapSourceRow {
  doubanId: string
  title: string
  coverUrl: string | null
  doubanVotes: number | null
  doubanRating: string | number | null
  /** 提示性字段（不参与分池判定，D-183-1.2；导入硬编码 100% 'movie' 不可信） */
  mediaTypeHint: string | null
}

interface DbGapRow {
  douban_id: string
  title: string
  cover_url: string | null
  douban_votes: number | null
  rating: string | number | null
  media_type: string | null
}

/**
 * 未映射豆瓣条目扫描窗（votes DESC 预截；精确评分与 top-N 截断归
 * services/home-autofill/douban.buildDoubanGaps——未映射池约 14 万不可全量评分）。
 * 「未映射」= douban_id 不在映射桥三源任一中。
 */
export async function listDoubanGapSourceRows(
  db: Pool,
  scanWindow: number,
): Promise<DoubanGapSourceRow[]> {
  const result = await db.query<DbGapRow>(
    `SELECT de.douban_id, de.title, de.cover_url, de.douban_votes, de.rating, de.media_type
       FROM external_data.douban_entries de
      WHERE NOT EXISTS (
              SELECT 1 FROM media_catalog mc WHERE mc.douban_id = de.douban_id
            )
        AND NOT EXISTS (
              SELECT 1 FROM video_external_refs ver
               WHERE ver.provider = 'douban' AND ver.external_id = de.douban_id
                 AND ver.is_primary = true AND ver.match_status = 'manual_confirmed'
            )
        AND NOT EXISTS (
              SELECT 1 FROM catalog_external_refs cer
               WHERE cer.provider = 'douban' AND cer.external_id = de.douban_id
                 AND cer.relation = 'exact'
            )
      ORDER BY de.douban_votes DESC NULLS LAST, de.rating DESC NULLS LAST
      LIMIT $1`,
    [Math.min(scanWindow, 2000)],
  )
  return result.rows.map((row) => ({
    doubanId: row.douban_id,
    title: row.title,
    coverUrl: row.cover_url,
    doubanVotes: row.douban_votes,
    doubanRating: row.rating,
    mediaTypeHint: row.media_type,
  }))
}
