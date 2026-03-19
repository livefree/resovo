/**
 * videos.ts — 视频表 DB 查询
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 * 只返回 is_published=true 的视频（ADR-010，admin 函数除外）
 */

import type { Pool, PoolClient } from 'pg'
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
  douban_id: string | null
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

// ── Admin 查询（含未发布视频）────────────────────────────────────

export interface AdminVideoListFilters {
  status?: 'pending' | 'published' | 'unpublished' | 'all'
  type?: VideoType
  q?: string
  page: number
  limit: number
}

export async function listAdminVideos(
  db: Pool,
  filters: AdminVideoListFilters
): Promise<{ rows: DbVideoRow[]; total: number }> {
  const conditions: string[] = ['v.deleted_at IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (filters.status === 'pending' || filters.status === 'unpublished') {
    conditions.push('v.is_published = false')
  } else if (filters.status === 'published') {
    conditions.push('v.is_published = true')
  }
  // 'all' → no filter

  if (filters.type) {
    conditions.push(`v.type = $${idx++}`)
    params.push(filters.type)
  }

  if (filters.q) {
    conditions.push(`(v.title ILIKE $${idx} OR v.title_en ILIKE $${idx})`)
    params.push(`%${filters.q}%`)
    idx++
  }

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit

  const [rows, countResult] = await Promise.all([
    db.query<DbVideoRow & { source_count: string }>(
      `SELECT v.id, v.short_id, v.title, v.title_en, v.cover_url, v.type,
              v.year, v.is_published, v.created_at, v.updated_at,
              '' AS slug, '' AS description, '' AS category, '' AS country,
              0 AS episode_count, 'completed' AS status, NULL AS rating,
              '[]'::json AS director, '[]'::json AS "cast", '[]'::json AS writers,
              NULL AS subtitle_langs,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS source_count
       FROM videos v
       WHERE ${where}
       ORDER BY v.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos v WHERE ${where}`,
      params
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function findAdminVideoById(
  db: Pool,
  id: string
): Promise<DbVideoRow | null> {
  const result = await db.query<DbVideoRow & { source_count: string }>(
    `SELECT v.*,
      (SELECT COUNT(*) FROM video_sources
       WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS source_count,
      NULL AS subtitle_langs
     FROM videos v
     WHERE v.id = $1 AND v.deleted_at IS NULL`,
    [id]
  )
  return result.rows[0] ?? null
}

export interface CreateVideoInput {
  title: string
  titleEn?: string | null
  description?: string | null
  coverUrl?: string | null
  type: VideoType
  category?: string | null
  year?: number | null
  country?: string | null
  episodeCount?: number
  status?: VideoStatus
  rating?: number | null
  director?: string[]
  cast?: string[]
  writers?: string[]
}

export async function createVideo(
  db: Pool,
  input: CreateVideoInput
): Promise<DbVideoRow> {
  const result = await db.query<DbVideoRow>(
    `INSERT INTO videos
       (title, title_en, description, cover_url, type, category, year, country,
        episode_count, status, rating, director, "cast", writers, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      input.title,
      input.titleEn ?? null,
      input.description ?? null,
      input.coverUrl ?? null,
      input.type,
      input.category ?? null,
      input.year ?? null,
      input.country ?? null,
      input.episodeCount ?? 1,
      input.status ?? 'completed',
      input.rating ?? null,
      JSON.stringify(input.director ?? []),
      JSON.stringify(input.cast ?? []),
      JSON.stringify(input.writers ?? []),
      false,
    ]
  )
  return result.rows[0]
}

export interface UpdateVideoMetaInput {
  title?: string
  titleEn?: string | null
  description?: string | null
  coverUrl?: string | null
  type?: VideoType
  category?: string | null
  year?: number | null
  country?: string | null
  episodeCount?: number
  status?: VideoStatus
  rating?: number | null
  director?: string[]
  cast?: string[]
  writers?: string[]
}

export async function updateVideoMeta(
  db: Pool,
  id: string,
  input: UpdateVideoMetaInput
): Promise<DbVideoRow | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = {
    title: 'title',
    titleEn: 'title_en',
    description: 'description',
    coverUrl: 'cover_url',
    type: 'type',
    category: 'category',
    year: 'year',
    country: 'country',
    episodeCount: 'episode_count',
    status: 'status',
    rating: 'rating',
    director: 'director',
    cast: '"cast"',
    writers: 'writers',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in input && input[key as keyof UpdateVideoMetaInput] !== undefined) {
      sets.push(`${col} = $${idx++}`)
      const val = input[key as keyof UpdateVideoMetaInput]
      params.push(Array.isArray(val) ? JSON.stringify(val) : val)
    }
  }

  params.push(id)
  const result = await db.query<DbVideoRow>(
    `UPDATE videos SET ${sets.join(', ')}
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING *`,
    params
  )
  return result.rows[0] ?? null
}

export async function publishVideo(
  db: Pool,
  id: string,
  isPublished: boolean
): Promise<{ id: string; is_published: boolean } | null> {
  const result = await db.query<{ id: string; is_published: boolean }>(
    `UPDATE videos SET is_published = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, is_published`,
    [isPublished, id]
  )
  return result.rows[0] ?? null
}

export async function batchPublishVideos(
  db: Pool,
  ids: string[],
  isPublished: boolean
): Promise<number> {
  const client: PoolClient = await db.connect()
  try {
    await client.query('BEGIN')
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
    const result = await client.query(
      `UPDATE videos SET is_published = $1, updated_at = NOW()
       WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [isPublished, ...ids]
    )
    await client.query('COMMIT')
    return result.rowCount ?? 0
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function batchUnpublishVideos(db: Pool, ids: string[]): Promise<number> {
  return batchPublishVideos(db, ids, false)
}

// ── 更新：豆瓣元数据（CHG-23）────────────────────────────────────

export interface UpdateDoubanInput {
  doubanId: string
  rating?: number | null
  description?: string | null
  coverUrl?: string | null
  director?: string[]
  cast?: string[]
}

export async function updateDoubanData(
  db: Pool,
  videoId: string,
  input: UpdateDoubanInput
): Promise<boolean> {
  const sets: string[] = ['douban_id = $1', 'updated_at = NOW()']
  const params: unknown[] = [input.doubanId]

  if (input.rating !== undefined) {
    params.push(input.rating)
    sets.push(`rating = $${params.length}`)
  }
  if (input.description !== undefined) {
    params.push(input.description)
    sets.push(`description = $${params.length}`)
  }
  if (input.coverUrl !== undefined) {
    params.push(input.coverUrl)
    sets.push(`cover_url = $${params.length}`)
  }
  if (input.director !== undefined) {
    params.push(input.director)
    sets.push(`director = $${params.length}`)
  }
  if (input.cast !== undefined) {
    params.push(input.cast)
    sets.push(`"cast" = $${params.length}`)
  }

  params.push(videoId)
  const result = await db.query(
    `UPDATE videos SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL`,
    params
  )
  return (result.rowCount ?? 0) > 0
}

// ── Admin 工具查询 ────────────────────────────────────────────────

/**
 * 按 short_id 查找视频 ID（含未发布视频，用于 admin 导入场景）
 */
export async function findVideoIdByShortId(
  db: Pool,
  shortId: string
): Promise<string | null> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM videos WHERE short_id = $1 AND deleted_at IS NULL`,
    [shortId]
  )
  return result.rows[0]?.id ?? null
}
