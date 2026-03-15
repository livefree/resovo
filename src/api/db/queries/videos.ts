/**
 * videos.ts — 视频表 DB 查询
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 * 只返回 is_published=true 的视频（ADR-010）
 */

import type { Pool } from 'pg'
import type { Video, VideoCard, VideoType, VideoStatus, VideoCategory } from '@/types'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbVideoRow {
  id: string
  short_id: string
  slug: string | null
  title: string
  title_en: string | null
  description: string | null
  cover_url: string | null
  type: VideoType
  category: string | null
  rating: number | null
  year: number | null
  country: string | null
  episode_count: number
  status: VideoStatus
  director: string[]
  cast: string[]
  writers: string[]
  is_published: boolean
  created_at: string
  updated_at: string
  source_count: string  // COUNT() 返回字符串
  subtitle_langs: string[] | null
}

function mapVideoRow(row: DbVideoRow): Video {
  return {
    id: row.id,
    shortId: row.short_id,
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    description: row.description,
    coverUrl: row.cover_url,
    type: row.type,
    category: (row.category as VideoCategory) ?? null,
    rating: row.rating,
    year: row.year,
    country: row.country,
    episodeCount: row.episode_count,
    status: row.status,
    director: row.director ?? [],
    cast: row.cast ?? [],
    writers: row.writers ?? [],
    sourceCount: parseInt(row.source_count ?? '0'),
    subtitleLangs: row.subtitle_langs ?? [],
    createdAt: row.created_at,
  }
}

function mapVideoCard(row: DbVideoRow): VideoCard {
  return {
    id: row.id,
    shortId: row.short_id,
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    coverUrl: row.cover_url,
    type: row.type,
    rating: row.rating,
    year: row.year,
    status: row.status,
    episodeCount: row.episode_count,
    sourceCount: parseInt(row.source_count ?? '0'),
  }
}

// ── 公共子查询片段 ────────────────────────────────────────────────

const SOURCE_COUNT_SUBQUERY = `(
  SELECT COUNT(*)::int FROM video_sources
  WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL
)`

const SUBTITLE_LANGS_SUBQUERY = `(
  SELECT ARRAY_AGG(DISTINCT language) FROM subtitles
  WHERE video_id = v.id AND deleted_at IS NULL
)`

// ── 查询：列表 ───────────────────────────────────────────────────

export interface VideoListFilters {
  type?: VideoType
  category?: string
  year?: number
  country?: string
  ratingMin?: number
  sort?: 'hot' | 'rating' | 'latest' | 'updated'
  page: number
  limit: number
}

export async function listVideos(
  db: Pool,
  filters: VideoListFilters
): Promise<{ rows: VideoCard[]; total: number }> {
  const conditions: string[] = ['v.is_published = true', 'v.deleted_at IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (filters.type) {
    conditions.push(`v.type = $${idx++}`)
    params.push(filters.type)
  }
  if (filters.category) {
    conditions.push(`v.category = $${idx++}`)
    params.push(filters.category)
  }
  if (filters.year) {
    conditions.push(`v.year = $${idx++}`)
    params.push(filters.year)
  }
  if (filters.country) {
    conditions.push(`v.country = $${idx++}`)
    params.push(filters.country)
  }
  if (filters.ratingMin !== undefined) {
    conditions.push(`v.rating >= $${idx++}`)
    params.push(filters.ratingMin)
  }

  const orderBy: Record<string, string> = {
    hot: `${SOURCE_COUNT_SUBQUERY} DESC`,
    rating: 'v.rating DESC NULLS LAST',
    latest: 'v.created_at DESC',
    updated: 'v.updated_at DESC',
  }
  const order = orderBy[filters.sort ?? 'latest']
  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit

  const [rows, countResult] = await Promise.all([
    db.query<DbVideoRow>(
      `SELECT v.*,
        ${SOURCE_COUNT_SUBQUERY} AS source_count,
        ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
       FROM videos v
       WHERE ${where}
       ORDER BY ${order}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos v WHERE ${where}`,
      params
    ),
  ])

  return {
    rows: rows.rows.map(mapVideoCard),
    total: parseInt(countResult.rows[0].count),
  }
}

// ── 查询：详情（by short_id）─────────────────────────────────────

export async function findVideoByShortId(
  db: Pool,
  shortId: string
): Promise<Video | null> {
  const result = await db.query<DbVideoRow>(
    `SELECT v.*,
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     FROM videos v
     WHERE v.short_id = $1
       AND v.is_published = true
       AND v.deleted_at IS NULL`,
    [shortId]
  )
  return result.rows[0] ? mapVideoRow(result.rows[0]) : null
}

// ── 查询：Trending ───────────────────────────────────────────────

export interface TrendingFilters {
  period: 'today' | 'week' | 'month'
  type?: VideoType
  limit: number
}

export async function listTrendingVideos(
  db: Pool,
  filters: TrendingFilters
): Promise<VideoCard[]> {
  const periodMap = {
    today: '1 day',
    week: '7 days',
    month: '30 days',
  }
  const interval = periodMap[filters.period]
  const conditions: string[] = [
    'v.is_published = true',
    'v.deleted_at IS NULL',
    `v.updated_at >= NOW() - INTERVAL '${interval}'`,
  ]
  const params: unknown[] = []
  let idx = 1

  if (filters.type) {
    conditions.push(`v.type = $${idx++}`)
    params.push(filters.type)
  }

  const where = conditions.join(' AND ')
  const result = await db.query<DbVideoRow>(
    `SELECT v.*,
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     FROM videos v
     WHERE ${where}
     ORDER BY v.updated_at DESC
     LIMIT $${idx}`,
    [...params, filters.limit]
  )
  return result.rows.map(mapVideoCard)
}
