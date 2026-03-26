/**
 * videos.ts — 视频表 DB 查询
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 * 只返回 is_published=true 的视频（ADR-010，admin 函数除外）
 */

import type { Pool, PoolClient } from 'pg'
import type { Video, VideoCard, VideoType, VideoStatus, VideoGenre, ContentFormat, EpisodePattern, ReviewStatus, VisibilityStatus } from '@/types'

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
  source_category: string | null  // 爬虫原始分类字符串（Migration 019）
  genre: string | null            // 平台策展题材（VideoGenre 枚举，初始 NULL）
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
  title_normalized: string | null
  metadata_source: string | null
  // Migration 013 字段
  source_content_type: string | null
  normalized_type: string | null
  content_format: string | null
  episode_pattern: string | null
  // Migration 016 字段
  review_status: string
  visibility_status: string
  needs_manual_review: boolean
  // Migration 020 字段
  genre_source: 'auto' | 'manual' | null
  content_rating: 'general' | 'adult'
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
    genre: (row.genre as VideoGenre) ?? null,
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
    sourceContentType: row.source_content_type ?? null,
    normalizedType: row.normalized_type ?? null,
    contentFormat: (row.content_format as ContentFormat) ?? null,
    episodePattern: (row.episode_pattern as EpisodePattern) ?? null,
    reviewStatus: (row.review_status as ReviewStatus) ?? 'pending_review',
    visibilityStatus: (row.visibility_status as VisibilityStatus) ?? 'internal',
    needsManualReview: row.needs_manual_review ?? false,
    genreSource: row.genre_source ?? null,
    contentRating: row.content_rating ?? 'general',
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
  genre?: string
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
  const conditions: string[] = ['v.is_published = true', 'v.deleted_at IS NULL', "v.visibility_status = 'public'"]
  const params: unknown[] = []
  let idx = 1

  if (filters.type) {
    conditions.push(`v.type = $${idx++}`)
    params.push(filters.type)
  }
  if (filters.genre) {
    conditions.push(`v.genre = $${idx++}`)
    params.push(filters.genre)
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
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'`,
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
    "v.visibility_status = 'public'",
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

const SORT_FIELD_WHITELIST: Record<string, string> = {
  created_at: 'v.created_at',
  updated_at: 'v.updated_at',
  title: 'v.title',
  year: 'v.year',
  type: 'v.type',
}

export interface AdminVideoListFilters {
  status?: 'pending' | 'published' | 'unpublished' | 'all'
  type?: VideoType
  q?: string
  /** 按来源站点 key 筛选（crawler_sites.key → v.site_id） */
  siteKey?: string
  visibilityStatus?: VisibilityStatus
  reviewStatus?: ReviewStatus
  sortField?: string
  sortDir?: 'asc' | 'desc'
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

  if (filters.siteKey) {
    conditions.push(
      `EXISTS (SELECT 1 FROM crawler_sites cs2 WHERE cs2.id = v.site_id AND cs2.key = $${idx++})`
    )
    params.push(filters.siteKey)
  }

  if (filters.visibilityStatus) {
    conditions.push(`v.visibility_status = $${idx++}`)
    params.push(filters.visibilityStatus)
  }

  if (filters.reviewStatus) {
    conditions.push(`v.review_status = $${idx++}`)
    params.push(filters.reviewStatus)
  }

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit
  const orderByCol = SORT_FIELD_WHITELIST[filters.sortField ?? ''] ?? 'v.created_at'
  const orderByDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC'

  const [rows, countResult] = await Promise.all([
    db.query<DbVideoRow & { source_count: string }>(
      `SELECT v.id, v.short_id, v.title, v.title_en, v.cover_url, v.type,
              v.year, v.is_published, v.created_at, v.updated_at,
              v.visibility_status, v.review_status,
              '' AS slug, '' AS description, NULL AS source_category, NULL AS genre, '' AS country,
              0 AS episode_count, 'completed' AS status, NULL AS rating,
              '[]'::json AS director, '[]'::json AS "cast", '[]'::json AS writers,
              NULL AS subtitle_langs,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS source_count
              ,(SELECT COUNT(*) FROM video_sources
                WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS active_source_count
              ,(SELECT COUNT(*) FROM video_sources
                WHERE video_id = v.id AND deleted_at IS NULL)::text AS total_source_count
       FROM videos v
       WHERE ${where}
       ORDER BY ${orderByCol} ${orderByDir}
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
  genre?: string | null
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
       (title, title_en, description, cover_url, type, genre, year, country,
        episode_count, status, rating, director, "cast", writers, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      input.title,
      input.titleEn ?? null,
      input.description ?? null,
      input.coverUrl ?? null,
      input.type,
      input.genre ?? null,
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
  genre?: string | null
  genreSource?: 'auto' | 'manual' | null  // 管理员编辑时传 'manual'，清除时传 null
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
    genre: 'genre',
    genreSource: 'genre_source',
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

// ── 更新：可见性切换（CHG-200）────────────────────────────────────

/**
 * 切换视频可见性状态（public ↔ hidden），同步更新 is_published 向后兼容。
 * 仅允许 approved 状态的视频切换到 public。
 */
export async function updateVisibility(
  db: Pool,
  id: string,
  visibility: VisibilityStatus
): Promise<{ id: string; visibility_status: string; is_published: boolean } | null> {
  const isPublished = visibility === 'public'
  const result = await db.query<{
    id: string; visibility_status: string; is_published: boolean
  }>(
    `UPDATE videos
     SET visibility_status = $1,
         is_published = $2,
         updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id, visibility_status, is_published`,
    [visibility, isPublished, id]
  )
  return result.rows[0] ?? null
}

// ── 更新：视频审核（CHG-201）──────────────────────────────────────

export type ReviewAction = 'approve' | 'reject'

interface ReviewVideoInput {
  action: ReviewAction
  reason?: string
  reviewedBy: string
}

/** 状态转换映射：action → { review_status, visibility_status } */
const REVIEW_ACTION_MAP: Record<ReviewAction, {
  reviewStatus: ReviewStatus
  visibilityStatus: VisibilityStatus
}> = {
  approve: { reviewStatus: 'approved', visibilityStatus: 'public' },
  reject: { reviewStatus: 'rejected', visibilityStatus: 'hidden' },
}

export async function reviewVideo(
  db: Pool,
  id: string,
  input: ReviewVideoInput
): Promise<{
  id: string
  review_status: string
  visibility_status: string
  is_published: boolean
} | null> {
  const mapping = REVIEW_ACTION_MAP[input.action]
  const isPublished = mapping.visibilityStatus === 'public'
  const result = await db.query<{
    id: string; review_status: string; visibility_status: string; is_published: boolean
  }>(
    `UPDATE videos
     SET review_status = $1,
         visibility_status = $2,
         is_published = $3,
         reviewed_by = $4,
         reviewed_at = NOW(),
         review_reason = $5,
         needs_manual_review = false,
         updated_at = NOW()
     WHERE id = $6 AND deleted_at IS NULL
     RETURNING id, review_status, visibility_status, is_published`,
    [mapping.reviewStatus, mapping.visibilityStatus, isPublished, input.reviewedBy, input.reason ?? null, id]
  )
  return result.rows[0] ?? null
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

// ── CHG-38: 视频归并策略 ──────────────────────────────────────────

/** metadata_source 优先级（越大越高）*/
export const METADATA_SOURCE_PRIORITY: Record<string, number> = {
  tmdb:    4,
  douban:  3,
  manual:  2,
  crawler: 1,
}

export type MetadataSource = 'tmdb' | 'douban' | 'manual' | 'crawler'

/**
 * 按归并 match_key 查找已有视频。
 * 规则 A: (title_normalized, year, type) 三元组完全相同才认为是同一视频。
 */
export async function findVideoByNormalizedKey(
  db: Pool,
  titleNormalized: string,
  year: number | null,
  type: VideoType
): Promise<{ id: string; metadataSource: string } | null> {
  const result = await db.query<{ id: string; metadata_source: string }>(
    `SELECT id, metadata_source FROM videos
     WHERE title_normalized = $1
       AND year IS NOT DISTINCT FROM $2
       AND type = $3
       AND deleted_at IS NULL
     LIMIT 1`,
    [titleNormalized, year, type]
  )
  if (!result.rows[0]) return null
  return { id: result.rows[0].id, metadataSource: result.rows[0].metadata_source }
}

export interface CrawlerInsertInput {
  shortId: string
  title: string
  titleNormalized: string
  titleEn: string | null
  coverUrl: string | null
  type: VideoType
  sourceCategory: string | null  // 爬虫原始分类字符串（写入 source_category 列）
  genre: VideoGenre | null       // 系统自动推断的题材
  genreSource: 'auto' | null     // 爬虫写入时来源固定为 'auto'
  contentRating: 'general' | 'adult'
  year: number | null
  country: string | null
  cast: string[]
  director: string[]
  writers: string[]
  description: string | null
  status: VideoStatus
  episodeCount: number
  isPublished: boolean
  /** CHG-203: 站点级采集策略决定入库状态 */
  reviewStatus?: string
  visibilityStatus?: string
  metadataSource: MetadataSource
}

/**
 * 新建视频记录（爬虫采集专用）。
 * 含 title_normalized 和 metadata_source。
 */
export async function insertCrawledVideo(
  db: Pool,
  input: CrawlerInsertInput
): Promise<{ id: string }> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO videos
       (short_id, title, title_normalized, title_en, cover_url, type, source_category,
        genre, genre_source, content_rating,
        year, country, "cast", director, writers, description, status, episode_count,
        is_published, review_status, visibility_status, metadata_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING id`,
    [
      input.shortId,
      input.title,
      input.titleNormalized,
      input.titleEn,
      input.coverUrl,
      input.type,
      input.sourceCategory,
      input.genre,
      input.genreSource,
      input.contentRating,
      input.year,
      input.country,
      input.cast,
      input.director,
      input.writers,
      input.description,
      input.status,
      input.episodeCount,
      input.isPublished,
      input.reviewStatus ?? 'pending_review',
      input.visibilityStatus ?? 'internal',
      input.metadataSource,
    ]
  )
  return result.rows[0]
}

/**
 * 向 video_aliases 表写入别名（INSERT IGNORE）。
 * 规则 C: 将 vod_name / vod_en 写入别名表，便于跨站标题匹配。
 */
export async function upsertVideoAliases(
  db: Pool,
  videoId: string,
  aliases: string[]
): Promise<void> {
  const filtered = aliases.filter((a) => a.trim().length > 0)
  if (filtered.length === 0) return
  for (const alias of filtered) {
    await db.query(
      `INSERT INTO video_aliases (video_id, alias)
       VALUES ($1, $2)
       ON CONFLICT (video_id, alias) DO NOTHING`,
      [videoId, alias.trim()]
    )
  }
}

// ── 审核台：统计 + 待审列表（CHG-220）─────────────────────────────

export interface ModerationStats {
  pendingCount: number
  todayReviewedCount: number
  /** 最近 7 天拒绝数 / (通过+拒绝)数；无数据时为 null */
  interceptRate: number | null
}

export async function getModerationStats(db: Pool): Promise<ModerationStats> {
  const [pending, todayReviewed, recent] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos
       WHERE review_status = 'pending_review' AND deleted_at IS NULL`
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos
       WHERE review_status IN ('approved','rejected')
         AND reviewed_at >= CURRENT_DATE
         AND deleted_at IS NULL`
    ),
    db.query<{ approved: string; rejected: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
         COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected
       FROM videos
       WHERE review_status IN ('approved','rejected')
         AND reviewed_at >= NOW() - INTERVAL '7 days'
         AND deleted_at IS NULL`
    ),
  ])

  const approved = parseInt(recent.rows[0]?.approved ?? '0')
  const rejected = parseInt(recent.rows[0]?.rejected ?? '0')
  const total7d = approved + rejected

  return {
    pendingCount: parseInt(pending.rows[0]?.count ?? '0'),
    todayReviewedCount: parseInt(todayReviewed.rows[0]?.count ?? '0'),
    interceptRate: total7d > 0 ? Math.round((rejected / total7d) * 1000) / 10 : null,
  }
}

export interface PendingReviewVideoRow {
  id: string
  shortId: string
  title: string
  type: string
  coverUrl: string | null
  year: number | null
  siteKey: string | null
  siteName: string | null
  firstSourceUrl: string | null
  createdAt: string
}

export async function listPendingReviewVideos(
  db: Pool,
  params: { page: number; limit: number }
): Promise<{ rows: PendingReviewVideoRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit

  const [rows, countResult] = await Promise.all([
    db.query<{
      id: string; short_id: string; title: string; type: string
      cover_url: string | null; year: number | null
      site_key: string | null; site_name: string | null
      first_source_url: string | null; created_at: string
    }>(
      `SELECT v.id, v.short_id, v.title, v.type, v.cover_url, v.year,
              cs.key AS site_key, cs.name AS site_name,
              (SELECT s.source_url FROM video_sources s
               WHERE s.video_id = v.id AND s.is_active = true AND s.deleted_at IS NULL
               LIMIT 1) AS first_source_url,
              v.created_at
       FROM videos v
       LEFT JOIN crawler_sites cs ON v.site_id = cs.id
       WHERE v.review_status = 'pending_review' AND v.deleted_at IS NULL
       ORDER BY v.created_at ASC
       LIMIT $1 OFFSET $2`,
      [params.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos
       WHERE review_status = 'pending_review' AND deleted_at IS NULL`
    ),
  ])

  return {
    rows: rows.rows.map((r) => ({
      id: r.id,
      shortId: r.short_id,
      title: r.title,
      type: r.type,
      coverUrl: r.cover_url,
      year: r.year,
      siteKey: r.site_key,
      siteName: r.site_name,
      firstSourceUrl: r.first_source_url,
      createdAt: r.created_at,
    })),
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}
