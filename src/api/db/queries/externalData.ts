/**
 * externalData.ts — external_data schema 查询
 * 供 MetadataEnrichService 做本地毫秒级标题匹配
 * 不用于构建 media_catalog（那是 externalRaw.ts 的职责）
 */

import type { Pool } from 'pg'

// ── 类型 ──────────────────────────────────────────────────────────

export interface DoubanEntryMatch {
  doubanId: string
  title: string
  year: number | null
  rating: number | null
  description: string | null
  coverUrl: string | null
  directors: string[]
  cast: string[]
  writers: string[]
  genres: string[]
  country: string | null
}

export interface BangumiEntryMatch {
  bangumiId: number
  titleCn: string | null
  titleJp: string | null
  year: number | null
  rating: number | null
  summary: string | null
  airDate: string | null
}

// ── 豆瓣条目查询 ──────────────────────────────────────────────────

/**
 * 按 title_normalized 精确匹配豆瓣条目，结果按年份接近度排序
 * 最多返回 5 条（供调用方选择最优）
 */
export async function findDoubanByTitleNorm(
  db: Pool,
  titleNorm: string,
  year: number | null
): Promise<DoubanEntryMatch[]> {
  const result = await db.query<{
    douban_id: string; title: string; year: number | null
    rating: string | null; description: string | null; cover_url: string | null
    directors: string[]; cast: string[]; writers: string[]; genres: string[]; country: string | null
  }>(
    `SELECT douban_id, title, year, rating, description, cover_url,
            directors, cast, writers, genres, country
     FROM external_data.douban_entries
     WHERE title_normalized = $1
     ORDER BY
       CASE WHEN $2::INT IS NULL THEN 0
            WHEN year = $2::INT THEN 0
            WHEN year IS NOT NULL AND ABS(year - $2::INT) <= 1 THEN 1
            ELSE 2 END,
       rating DESC NULLS LAST
     LIMIT 5`,
    [titleNorm, year]
  )
  return result.rows.map((r) => ({
    doubanId: r.douban_id,
    title: r.title,
    year: r.year,
    rating: r.rating ? Number(r.rating) : null,
    description: r.description,
    coverUrl: r.cover_url,
    directors: r.directors ?? [],
    cast: r.cast ?? [],
    writers: r.writers ?? [],
    genres: r.genres ?? [],
    country: r.country,
  }))
}

// ── Bangumi 条目查询 ──────────────────────────────────────────────

/**
 * 按 title_normalized 匹配 Bangumi 动画条目
 * 最多返回 3 条
 */
export async function findBangumiByTitleNorm(
  db: Pool,
  titleNorm: string,
  year: number | null
): Promise<BangumiEntryMatch[]> {
  const result = await db.query<{
    bangumi_id: number; title_cn: string | null; title_jp: string | null
    year: number | null; rating: string | null; summary: string | null; air_date: string | null
  }>(
    `SELECT bangumi_id, title_cn, title_jp, year, rating, summary, air_date
     FROM external_data.bangumi_entries
     WHERE title_normalized = $1
     ORDER BY
       CASE WHEN $2::INT IS NULL THEN 0
            WHEN year = $2::INT THEN 0
            WHEN year IS NOT NULL AND ABS(year - $2::INT) <= 1 THEN 1
            ELSE 2 END,
       rating DESC NULLS LAST
     LIMIT 3`,
    [titleNorm, year]
  )
  return result.rows.map((r) => ({
    bangumiId: r.bangumi_id,
    titleCn: r.title_cn,
    titleJp: r.title_jp,
    year: r.year,
    rating: r.rating ? Number(r.rating) : null,
    summary: r.summary,
    airDate: r.air_date,
  }))
}

// ── video_external_refs ───────────────────────────────────────────

export type ExternalRefProvider = 'douban' | 'tmdb' | 'bangumi' | 'imdb'
export type ExternalRefMatchStatus = 'auto_matched' | 'manual_confirmed' | 'candidate' | 'rejected'

export interface VideoExternalRef {
  id: string
  videoId: string
  provider: ExternalRefProvider
  externalId: string
  matchStatus: ExternalRefMatchStatus
  matchMethod: string | null
  confidence: number | null
  isPrimary: boolean
  linkedBy: string | null
  linkedAt: string
  notes: string | null
}

export interface UpsertVideoExternalRefInput {
  videoId: string
  provider: ExternalRefProvider
  externalId: string
  matchStatus: ExternalRefMatchStatus
  matchMethod?: string
  confidence?: number
  isPrimary?: boolean
  linkedBy?: string
  notes?: string
}

/**
 * 写入或更新一条 video_external_refs 记录。
 * 匹配键：(video_id, provider, external_id)
 * 若 isPrimary=true，需要调用方确保该 video+provider 没有其他 primary（由 DB 唯一索引保证）。
 */
export async function upsertVideoExternalRef(
  db: Pool,
  input: UpsertVideoExternalRefInput,
): Promise<VideoExternalRef> {
  const result = await db.query<{
    id: string; video_id: string; provider: string; external_id: string
    match_status: string; match_method: string | null; confidence: string | null
    is_primary: boolean; linked_by: string | null; linked_at: string; notes: string | null
  }>(
    `INSERT INTO video_external_refs
       (video_id, provider, external_id, match_status, match_method,
        confidence, is_primary, linked_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (video_id, provider, external_id)
       DO UPDATE SET
         match_status  = EXCLUDED.match_status,
         match_method  = EXCLUDED.match_method,
         confidence    = EXCLUDED.confidence,
         is_primary    = EXCLUDED.is_primary,
         linked_by     = EXCLUDED.linked_by,
         notes         = EXCLUDED.notes,
         updated_at    = NOW()
     RETURNING *`,
    [
      input.videoId,
      input.provider,
      input.externalId,
      input.matchStatus,
      input.matchMethod ?? null,
      input.confidence ?? null,
      input.isPrimary ?? false,
      input.linkedBy ?? null,
      input.notes ?? null,
    ]
  )
  const r = result.rows[0]
  return {
    id: r.id,
    videoId: r.video_id,
    provider: r.provider as ExternalRefProvider,
    externalId: r.external_id,
    matchStatus: r.match_status as ExternalRefMatchStatus,
    matchMethod: r.match_method,
    confidence: r.confidence ? Number(r.confidence) : null,
    isPrimary: r.is_primary,
    linkedBy: r.linked_by,
    linkedAt: r.linked_at,
    notes: r.notes,
  }
}

/**
 * 查询一个视频在指定 provider 的 primary 外部关联（最常用路径）。
 * 返回 null 表示尚无 primary 绑定。
 */
export async function findPrimaryVideoExternalRef(
  db: Pool,
  videoId: string,
  provider: ExternalRefProvider,
): Promise<VideoExternalRef | null> {
  const result = await db.query<{
    id: string; video_id: string; provider: string; external_id: string
    match_status: string; match_method: string | null; confidence: string | null
    is_primary: boolean; linked_by: string | null; linked_at: string; notes: string | null
  }>(
    `SELECT * FROM video_external_refs
     WHERE video_id = $1 AND provider = $2 AND is_primary = true
     LIMIT 1`,
    [videoId, provider]
  )
  if (!result.rows[0]) return null
  const r = result.rows[0]
  return {
    id: r.id,
    videoId: r.video_id,
    provider: r.provider as ExternalRefProvider,
    externalId: r.external_id,
    matchStatus: r.match_status as ExternalRefMatchStatus,
    matchMethod: r.match_method,
    confidence: r.confidence ? Number(r.confidence) : null,
    isPrimary: r.is_primary,
    linkedBy: r.linked_by,
    linkedAt: r.linked_at,
    notes: r.notes,
  }
}
