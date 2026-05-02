/**
 * videos.ts — 视频表 DB 查询
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 * 只返回 is_published=true 的视频（ADR-010，admin 函数除外）
 */

import type { Pool, PoolClient } from 'pg'
import type { Video, VideoCard, VideoType, VideoStatus, VideoGenre, ContentFormat, EpisodePattern, ReviewStatus, VisibilityStatus, DoubanStatus, SourceCheckStatus, TrendingTag } from '@/types'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbVideoRow {
  // ── videos 表字段 ───────────────────────────────────────────────
  id: string
  short_id: string
  slug: string | null
  title: string            // 冗余副本，canonical 在 media_catalog.title
  type: VideoType          // 冗余副本，canonical 在 media_catalog.type
  catalog_id: string
  episode_count: number
  is_published: boolean
  created_at: string
  updated_at: string
  source_count: string     // COUNT() 子查询
  subtitle_langs: string[] | null
  source_category: string | null  // 爬虫原始分类字符串（Migration 019）
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
  content_rating: 'general' | 'adult'
  // Migration 022
  site_key: string | null
  // Migration 032 — 流水线辅助字段
  douban_status: DoubanStatus
  source_check_status: SourceCheckStatus
  meta_score: number
  // Migration 051 字段
  trending_tag: TrendingTag | null
  // ── media_catalog JOIN 字段（mc.*）───────────────────────────────
  title_en: string | null
  title_original: string | null
  description: string | null
  cover_url: string | null
  rating: number | null
  rating_votes: number | null
  runtime_minutes: number | null
  year: number | null
  country: string | null
  status: VideoStatus      // 系列完结状态（ongoing/completed），来自 mc.status
  director: string[]
  cast: string[]
  writers: string[]
  genres: string[]
  aliases: string[]
  languages: string[]
  tags: string[]
  douban_id: string | null
  imdb_id: string | null
  tmdb_id: number | null
  title_normalized: string
  metadata_source: string
  // 图片治理字段（IMG-01，ADR-046）
  poster_blurhash: string | null
  poster_status: string | null
  backdrop_blurhash: string | null
  backdrop_status: string | null
  logo_url: string | null
  logo_status: string | null
}

function mapVideoRow(row: DbVideoRow): Video {
  return {
    id: row.id,
    shortId: row.short_id,
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    titleOriginal: row.title_original ?? null,
    description: row.description,
    coverUrl: row.cover_url,
    type: row.type,
    genres: (row.genres ?? []) as VideoGenre[],
    rating: row.rating,
    ratingVotes: row.rating_votes ?? null,
    runtimeMinutes: row.runtime_minutes ?? null,
    year: row.year,
    country: row.country,
    episodeCount: row.episode_count,
    status: row.status,
    director: row.director ?? [],
    cast: row.cast ?? [],
    writers: row.writers ?? [],
    aliases: row.aliases ?? [],
    languages: row.languages ?? [],
    tags: row.tags ?? [],
    sourceCount: parseInt(row.source_count ?? '0'),
    subtitleLangs: row.subtitle_langs ?? [],
    sourceContentType: row.source_content_type ?? null,
    normalizedType: row.normalized_type ?? null,
    contentFormat: (row.content_format as ContentFormat) ?? null,
    episodePattern: (row.episode_pattern as EpisodePattern) ?? null,
    reviewStatus: (row.review_status as ReviewStatus) ?? 'pending_review',
    visibilityStatus: (row.visibility_status as VisibilityStatus) ?? 'internal',
    needsManualReview: row.needs_manual_review ?? false,
    contentRating: row.content_rating ?? 'general',
    createdAt: row.created_at,
    catalogId: row.catalog_id ?? null,
    imdbId: row.imdb_id ?? null,
    tmdbId: row.tmdb_id ?? null,
    doubanStatus: row.douban_status ?? 'pending',
    sourceCheckStatus: row.source_check_status ?? 'pending',
    metaScore: row.meta_score ?? 0,
    trendingTag: row.trending_tag ?? null,
    posterBlurhash: row.poster_blurhash ?? null,
    posterStatus: row.poster_status ?? null,
    backdropBlurhash: row.backdrop_blurhash ?? null,
    backdropStatus: row.backdrop_status ?? null,
    logoUrl: row.logo_url ?? null,
    logoStatus: row.logo_status ?? null,
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
    posterBlurhash: row.poster_blurhash ?? null,
    posterStatus: row.poster_status ?? null,
    subtitleLangs: row.subtitle_langs ?? [],
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

/** 标准 JOIN：videos + media_catalog */
const VIDEO_JOIN = `FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id`

/**
 * 标准 SELECT 列列表（用于返回完整 DbVideoRow）
 * 所有 metadata 字段通过 JOIN mc 取得
 */
const VIDEO_FULL_SELECT = `
  v.id, v.short_id, v.slug, v.title, v.type, v.catalog_id,
  v.episode_count, v.is_published, v.created_at, v.updated_at,
  v.source_content_type, v.normalized_type, v.content_format, v.episode_pattern,
  v.review_status, v.visibility_status, v.needs_manual_review,
  v.content_rating, v.site_key, v.source_category,
  v.douban_status, v.source_check_status, v.meta_score, v.trending_tag,
  mc.title_en, mc.title_original, mc.description, mc.cover_url,
  mc.rating, mc.rating_votes, mc.runtime_minutes, mc.year, mc.country,
  mc.status, mc.director, mc."cast", mc.writers, mc.genres,
  mc.aliases, mc.languages, mc.tags,
  mc.douban_id, mc.imdb_id, mc.tmdb_id, mc.title_normalized, mc.metadata_source,
  mc.poster_blurhash, mc.poster_status,
  mc.backdrop_blurhash, mc.backdrop_status,
  mc.logo_url, mc.logo_status
`

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
    conditions.push(`mc.genres @> ARRAY[$${idx++}::text]`)
    params.push(filters.genre)
  }
  if (filters.year) {
    conditions.push(`mc.year = $${idx++}`)
    params.push(filters.year)
  }
  if (filters.country) {
    conditions.push(`mc.country = $${idx++}`)
    params.push(filters.country)
  }
  if (filters.ratingMin !== undefined) {
    conditions.push(`mc.rating >= $${idx++}`)
    params.push(filters.ratingMin)
  }

  const orderBy: Record<string, string> = {
    hot: `${SOURCE_COUNT_SUBQUERY} DESC`,
    rating: 'mc.rating DESC NULLS LAST',
    latest: 'v.created_at DESC',
    updated: 'v.updated_at DESC',
  }
  const order = orderBy[filters.sort ?? 'latest']
  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit

  const [rows, countResult] = await Promise.all([
    db.query<DbVideoRow>(
      `SELECT ${VIDEO_FULL_SELECT},
        ${SOURCE_COUNT_SUBQUERY} AS source_count,
        ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
       ${VIDEO_JOIN}
       WHERE ${where}
       ORDER BY ${order}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) ${VIDEO_JOIN} WHERE ${where}`,
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
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
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
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
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
  year: 'mc.year',   // year 在 media_catalog
  type: 'v.type',
}

export interface AdminVideoListFilters {
  status?: 'pending' | 'published' | 'unpublished' | 'all'
  type?: VideoType
  q?: string
  /** 按来源站点 key 筛选（videos.site_key） */
  siteKey?: string
  /** false 时隐藏来自成人源站（crawler_sites.is_adult=true）的视频 */
  includeAdult?: boolean
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
    conditions.push(`(v.title ILIKE $${idx} OR mc.title_en ILIKE $${idx})`)
    params.push(`%${filters.q}%`)
    idx++
  }

  if (filters.siteKey) {
    conditions.push(`v.site_key = $${idx++}`)
    params.push(filters.siteKey)
  }
  if (filters.includeAdult === false) {
    conditions.push(`COALESCE(cs.is_adult, false) = false`)
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
    db.query<DbVideoRow & { active_source_count: string; total_source_count: string }>(
      `SELECT ${VIDEO_FULL_SELECT},
              NULL::text[] AS subtitle_langs,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS source_count,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS active_source_count,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND deleted_at IS NULL)::text AS total_source_count
       ${VIDEO_JOIN}
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
       WHERE ${where}
       ORDER BY ${orderByCol} ${orderByDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) ${VIDEO_JOIN}
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
       WHERE ${where}`,
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
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      (SELECT COUNT(*) FROM video_sources
       WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS source_count,
      NULL::text[] AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.id = $1 AND v.deleted_at IS NULL`,
    [id]
  )
  return result.rows[0] ?? null
}

export interface CreateVideoInput {
  /** 已在 MediaCatalogService.findOrCreate 后获得的 catalog ID */
  catalogId: string
  title: string    // 冗余副本（与 mc.title 保持一致）
  type: VideoType  // 冗余副本（与 mc.type 保持一致）
  episodeCount?: number
  siteKey?: string | null
  sourceCategory?: string | null
  contentRating?: 'general' | 'adult'
}

export async function createVideo(
  db: Pool,
  input: CreateVideoInput
): Promise<DbVideoRow> {
  const shortId = Math.random().toString(36).slice(2, 10)
  const result = await db.query<DbVideoRow>(
    `INSERT INTO videos
       (short_id, catalog_id, title, type, episode_count,
        site_key, source_category, content_rating, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, short_id, slug, title, type, catalog_id, episode_count,
               is_published, created_at, updated_at,
               source_content_type, normalized_type, content_format, episode_pattern,
               review_status, visibility_status, needs_manual_review,
               content_rating, site_key, source_category`,
    [
      shortId,
      input.catalogId,
      input.title,
      input.type,
      input.episodeCount ?? 1,
      input.siteKey ?? null,
      input.sourceCategory ?? null,
      input.contentRating ?? 'general',
      false,
    ]
  )
  return result.rows[0]
}

/**
 * 更新 videos 表自有字段（冗余副本 + 平台实例字段）
 * 注意：title/type 是冗余字段，canonical 值在 media_catalog；
 *       元数据字段（titleEn/description/coverUrl 等）已迁移到 media_catalog，
 *       请通过 MediaCatalogService.safeUpdate 更新。
 */
export interface UpdateVideoMetaInput {
  title?: string      // 冗余副本更新（与 mc.title 同步时使用）
  type?: VideoType    // 冗余副本更新（与 mc.type 同步时使用）
  episodeCount?: number
  slug?: string | null
}

export async function updateVideoMeta(
  db: Pool,
  id: string,
  input: UpdateVideoMetaInput
): Promise<{ id: string; updated_at: string } | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, string> = {
    title: 'title',
    type: 'type',
    episodeCount: 'episode_count',
    slug: 'slug',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in input && input[key as keyof UpdateVideoMetaInput] !== undefined) {
      sets.push(`${col} = $${idx++}`)
      params.push(input[key as keyof UpdateVideoMetaInput])
    }
  }

  params.push(id)
  const result = await db.query<{ id: string; updated_at: string }>(
    `UPDATE videos SET ${sets.join(', ')}
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, updated_at`,
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

export type VideoStateTransitionAction =
  | 'approve'
  | 'approve_and_publish'
  | 'reject'
  | 'reopen_pending'
  | 'publish'
  | 'unpublish'
  | 'set_internal'
  | 'set_hidden'
  | 'staging_revert'  // M-SN-4 D-01：暂存退回待审核（approved+internal/hidden+0 → pending_review）

export interface TransitionVideoStateInput {
  action: VideoStateTransitionAction
  reviewedBy?: string
  reason?: string
  expectedUpdatedAt?: string
}

export interface TransitionVideoStateResult {
  id: string
  review_status: ReviewStatus
  visibility_status: VisibilityStatus
  is_published: boolean
  updated_at: string
}

/**
 * Single write entry for governance state transitions.
 * All transitions are applied atomically with row lock.
 */
export async function transitionVideoState(
  db: Pool,
  id: string,
  input: TransitionVideoStateInput,
): Promise<TransitionVideoStateResult | null> {
  const client: PoolClient = await db.connect()
  try {
    await client.query('BEGIN')
    const currentResult = await client.query<{
      id: string
      review_status: ReviewStatus
      visibility_status: VisibilityStatus
      is_published: boolean
      updated_at: string
      review_reason: string | null
      reviewed_by: string | null
      reviewed_at: string | null
      deleted_at: string | null
    }>(
      `SELECT id, review_status, visibility_status, is_published, updated_at,
              review_reason, reviewed_by, reviewed_at, deleted_at
       FROM videos
       WHERE id = $1
       FOR UPDATE`,
      [id],
    )
    const current = currentResult.rows[0]
    if (!current || current.deleted_at) {
      await client.query('ROLLBACK')
      return null
    }

    if (input.expectedUpdatedAt && new Date(current.updated_at).toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
      throw new Error('STATE_CONFLICT')
    }

    let nextReview = current.review_status
    let nextVisibility = current.visibility_status
    let nextPublished = current.is_published
    let reviewReason: string | null = current.review_reason
    let reviewedBy: string | null = current.reviewed_by
    let reviewedAt: string | null = current.reviewed_at

    switch (input.action) {
      case 'approve': {
        if (current.review_status !== 'pending_review') {
          throw new Error('INVALID_TRANSITION')
        }
        nextReview = 'approved'
        nextVisibility = 'internal'
        nextPublished = false
        reviewReason = input.reason ?? null
        reviewedBy = input.reviewedBy ?? null
        reviewedAt = new Date().toISOString()
        break
      }
      case 'approve_and_publish': {
        if (current.review_status !== 'pending_review') {
          throw new Error('INVALID_TRANSITION')
        }
        nextReview = 'approved'
        nextVisibility = 'public'
        nextPublished = true
        reviewReason = input.reason ?? null
        reviewedBy = input.reviewedBy ?? null
        reviewedAt = new Date().toISOString()
        break
      }
      case 'reject': {
        // M-SN-4 D-01：reject 限制为 pending_review 入参，与 trigger 白名单 + plan §1 D-01
        // 设计意图（暂存撤回须经 staging_revert 两步走）三层守门一致。
        // approved 视频不可直接 reject（即便允许，DB trigger 也会拒绝 approved → rejected_hidden
        // 转换；旧版应用层放行造成跨层不一致）。
        if (current.review_status !== 'pending_review') {
          throw new Error('INVALID_TRANSITION')
        }
        nextReview = 'rejected'
        nextVisibility = 'hidden'
        nextPublished = false
        reviewReason = input.reason ?? null
        reviewedBy = input.reviewedBy ?? null
        reviewedAt = new Date().toISOString()
        break
      }
      case 'reopen_pending': {
        if (current.review_status !== 'rejected') {
          throw new Error('INVALID_TRANSITION')
        }
        nextReview = 'pending_review'
        nextVisibility = 'hidden'
        nextPublished = false
        reviewReason = null
        reviewedBy = null
        reviewedAt = null
        break
      }
      case 'publish': {
        if (current.review_status !== 'approved') {
          throw new Error('INVALID_TRANSITION')
        }
        nextReview = 'approved'
        nextVisibility = 'public'
        nextPublished = true
        break
      }
      case 'unpublish': {
        if (current.review_status !== 'approved') {
          throw new Error('INVALID_TRANSITION')
        }
        nextReview = 'approved'
        nextVisibility = 'internal'
        nextPublished = false
        break
      }
      case 'set_internal': {
        if (current.review_status === 'rejected') {
          throw new Error('INVALID_TRANSITION')
        }
        nextVisibility = 'internal'
        nextPublished = false
        break
      }
      case 'set_hidden': {
        nextVisibility = 'hidden'
        nextPublished = false
        break
      }
      case 'staging_revert': {
        // M-SN-4 D-01：暂存（approved + internal|hidden + unpublished）→ 退回待审核
        // 已发布视频不可直接退回（必须先 unpublish），由 trigger 白名单兜底拒绝
        if (current.review_status !== 'approved' || current.is_published) {
          throw new Error('INVALID_TRANSITION')
        }
        nextReview = 'pending_review'
        nextVisibility = current.visibility_status  // 保持 internal | hidden
        nextPublished = false
        reviewReason = null
        reviewedBy = null
        reviewedAt = null
        break
      }
      default:
        throw new Error('INVALID_TRANSITION')
    }

    const result = await client.query<TransitionVideoStateResult>(
      `UPDATE videos
       SET review_status = $1,
           visibility_status = $2,
           is_published = $3,
           review_reason = $4,
           reviewed_by = $5,
           reviewed_at = $6::timestamptz,
           needs_manual_review = false,
           updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING id, review_status, visibility_status, is_published, updated_at`,
      [nextReview, nextVisibility, nextPublished, reviewReason, reviewedBy, reviewedAt, id],
    )
    await client.query('COMMIT')
    return result.rows[0] ?? null
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
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

export type ReviewAction = 'approve' | 'approve_and_publish' | 'reject'

interface ReviewVideoInput {
  action: ReviewAction
  reason?: string
  reviewedBy: string
}

/** 状态转换映射：action → { review_status, visibility_status, is_published } */
const REVIEW_ACTION_MAP: Record<ReviewAction, {
  reviewStatus: ReviewStatus
  visibilityStatus: VisibilityStatus
  isPublished: boolean
}> = {
  approve: { reviewStatus: 'approved', visibilityStatus: 'internal', isPublished: false },
  approve_and_publish: { reviewStatus: 'approved', visibilityStatus: 'public', isPublished: true },
  reject: { reviewStatus: 'rejected', visibilityStatus: 'hidden', isPublished: false },
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
  const isPublished = mapping.isPublished
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
 * @deprecated 由 MediaCatalogService.findOrCreate 替代（CHG-366 完成后移除）
 * 通过 media_catalog JOIN 实现，兼容旧调用方
 */
export async function findVideoByNormalizedKey(
  db: Pool,
  titleNormalized: string,
  year: number | null,
  type: VideoType
): Promise<{ id: string; metadataSource: string } | null> {
  const result = await db.query<{ id: string; metadata_source: string }>(
    `SELECT v.id, mc.metadata_source
     ${VIDEO_JOIN}
     WHERE mc.title_normalized = $1
       AND mc.year IS NOT DISTINCT FROM $2
       AND v.type = $3
       AND v.deleted_at IS NULL
     LIMIT 1`,
    [titleNormalized, year, type]
  )
  if (!result.rows[0]) return null
  return { id: result.rows[0].id, metadataSource: result.rows[0].metadata_source }
}

export interface UpdateDoubanInput {
  doubanId: string
  rating?: number | null
  description?: string | null
  coverUrl?: string | null
  director?: string[]
  cast?: string[]
}

/**
 * @deprecated 由 MediaCatalogService.safeUpdate(source='douban') 替代（CHG-367 完成后移除）
 * 现在写入 media_catalog 而非 videos（相关列已迁移）
 */
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
    `UPDATE media_catalog mc
     SET ${sets.join(', ')}
     FROM videos v
     WHERE v.id = $${params.length}
       AND mc.id = v.catalog_id
       AND v.deleted_at IS NULL`,
    params
  )
  return (result.rowCount ?? 0) > 0
}

export interface CrawlerInsertInput {
  /**
   * CHG-366 完成后变为必填；当前临时可选（CrawlerService 尚未接入 MediaCatalogService）
   * 若未提供，insertCrawledVideo 会先创建一个最小 catalog 条目
   */
  catalogId?: string
  shortId: string
  title: string      // 冗余副本（与 mc.title 一致）
  type: VideoType    // 冗余副本（与 mc.type 一致）
  sourceCategory: string | null
  contentRating: 'general' | 'adult'
  episodeCount: number
  isPublished: boolean
  reviewStatus?: string
  visibilityStatus?: string
  siteKey?: string
  // ── @deprecated 字段（CHG-366 完成后移除，当前仍被 CrawlerService 传入）──
  /** @deprecated 元数据已迁移到 media_catalog，此字段仅用于临时 catalog 创建 */
  titleNormalized?: string
  /** @deprecated */
  titleEn?: string | null
  /** @deprecated */
  coverUrl?: string | null
  /** @deprecated */
  genre?: string | null
  /** @deprecated */
  genreSource?: 'auto' | null
  /** @deprecated */
  year?: number | null
  /** @deprecated */
  country?: string | null
  /** @deprecated */
  cast?: string[]
  /** @deprecated */
  director?: string[]
  /** @deprecated */
  writers?: string[]
  /** @deprecated */
  description?: string | null
  /** @deprecated */
  status?: VideoStatus
  /** @deprecated */
  metadataSource?: MetadataSource
}

/**
 * 新建视频记录（爬虫采集专用）。
 * 优先使用 input.catalogId；若未提供（CHG-366 过渡期），
 * 用 @deprecated 旧字段在事务中先创建最小 media_catalog 条目。
 */
export async function insertCrawledVideo(
  db: Pool,
  input: CrawlerInsertInput
): Promise<{ id: string }> {
  const client = await (db as import('pg').Pool).connect()
  try {
    await client.query('BEGIN')

    let catalogId = input.catalogId
    if (!catalogId) {
      // CHG-366 过渡兼容：CrawlerService 尚未接入 MediaCatalogService，在此临时创建 catalog
      const titleNorm = input.titleNormalized ?? input.title.toLowerCase()
      const catalogResult = await client.query<{ id: string }>(
        `INSERT INTO media_catalog
           (title, title_en, title_normalized, type, year, country, description, cover_url,
            director, "cast", writers, status, genres, metadata_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          input.title,
          input.titleEn ?? null,
          titleNorm,
          input.type,
          input.year ?? null,
          input.country ?? null,
          input.description ?? null,
          input.coverUrl ?? null,
          input.director ?? [],
          input.cast ?? [],
          input.writers ?? [],
          input.status ?? 'completed',
          input.genre ? [input.genre] : [],
          input.metadataSource ?? 'crawler',
        ]
      )
      if (catalogResult.rows[0]) {
        catalogId = catalogResult.rows[0].id
      } else {
        // ON CONFLICT：通过 title_normalized+year+type 查找已有 catalog
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM media_catalog
           WHERE title_normalized = $1 AND type = $2 AND year IS NOT DISTINCT FROM $3
           LIMIT 1`,
          [titleNorm, input.type, input.year ?? null]
        )
        catalogId = existing.rows[0]?.id
        if (!catalogId) throw new Error('insertCrawledVideo: unable to resolve catalog_id')
      }
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO videos
         (short_id, catalog_id, title, type, source_category,
          content_rating, episode_count, is_published,
          review_status, visibility_status, site_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        input.shortId,
        catalogId,
        input.title,
        input.type,
        input.sourceCategory,
        input.contentRating,
        input.episodeCount,
        input.isPublished,
        input.reviewStatus ?? 'pending_review',
        input.visibilityStatus ?? 'internal',
        input.siteKey ?? null,
      ]
    )
    await client.query('COMMIT')
    return result.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * 当采集到更大集数时，推进 videos.episode_count（只增不减）。
 */
export async function bumpEpisodeCountIfHigher(
  db: Pool,
  videoId: string,
  incomingEpisodeCount: number
): Promise<boolean> {
  if (!Number.isFinite(incomingEpisodeCount) || incomingEpisodeCount <= 0) return false
  const result = await db.query<{ id: string }>(
    `UPDATE videos
     SET episode_count = GREATEST(episode_count, $2),
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
       AND episode_count < $2
     RETURNING id`,
    [videoId, incomingEpisodeCount]
  )
  return (result.rowCount ?? 0) > 0
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
  /**
   * 最近 7 天拦截率（**百分数 0-100**，保留 1 位小数；无审核数据时为 null）
   *
   * 公式：`Math.round((rejected / (approved + rejected)) * 1000) / 10`
   * 即 ratio × 100 后保留 1 位小数。例如 rejected=12 / total7d=100 → 12.0（表示 12.0%）。
   *
   * **消费方使用约定**：直接拼 "%"，**不要再乘以 100**（典型坑：CHG-DESIGN-07 7C
   * 曾误乘 100 致 server-next Dashboard 显示 1230.0% 假数据，Codex stop-time fix#1 闭环；
   * fix#2 同步生产方 jsdoc 防再误读）。
   *
   * 任何持有此字段类型的生产方 / 消费方 / 镜像类型必须保持本契约同步。
   */
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
  // 流水线辅助字段（Migration 032）
  doubanStatus: DoubanStatus
  sourceCheckStatus: SourceCheckStatus
  metaScore: number
  activeSourceCount: number
}

export async function listPendingReviewVideos(
  db: Pool,
  params: {
    page: number
    limit: number
    type?: string
    sortDir?: 'asc' | 'desc'
    q?: string
    siteKey?: string
    sourceState?: 'all' | 'active' | 'missing'
    includeAdult?: boolean
    doubanStatus?: DoubanStatus
    sourceCheckStatus?: SourceCheckStatus
  }
): Promise<{ rows: PendingReviewVideoRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit
  const conditions: string[] = [`v.review_status = 'pending_review'`, `v.deleted_at IS NULL`]
  const filterParams: unknown[] = []
  let idx = 1

  if (params.type) {
    conditions.push(`v.type = $${idx++}`)
    filterParams.push(params.type)
  }
  if (params.q) {
    conditions.push(`(
      v.title ILIKE $${idx}
      OR v.short_id ILIKE $${idx}
      OR EXISTS (
        SELECT 1
        FROM video_sources s2
        WHERE s2.video_id = v.id
          AND s2.deleted_at IS NULL
          AND (
            s2.source_name ILIKE $${idx}
            OR s2.source_url ILIKE $${idx}
          )
      )
    )`)
    filterParams.push(`%${params.q}%`)
    idx += 1
  }
  if (params.siteKey) {
    conditions.push(`v.site_key = $${idx++}`)
    filterParams.push(params.siteKey)
  }
  if (params.includeAdult === false) {
    conditions.push(`COALESCE(cs.is_adult, false) = false`)
  }
  if (params.sourceState === 'active') {
    conditions.push(`EXISTS (
      SELECT 1
      FROM video_sources s3
      WHERE s3.video_id = v.id
        AND s3.deleted_at IS NULL
        AND s3.is_active = true
    )`)
  } else if (params.sourceState === 'missing') {
    conditions.push(`NOT EXISTS (
      SELECT 1
      FROM video_sources s3
      WHERE s3.video_id = v.id
        AND s3.deleted_at IS NULL
        AND s3.is_active = true
    )`)
  }
  if (params.doubanStatus) {
    conditions.push(`v.douban_status = $${idx++}`)
    filterParams.push(params.doubanStatus)
  }
  if (params.sourceCheckStatus) {
    conditions.push(`v.source_check_status = $${idx++}`)
    filterParams.push(params.sourceCheckStatus)
  }

  const where = conditions.join(' AND ')
  const orderDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'

  const [rows, countResult] = await Promise.all([
    db.query<{
      id: string; short_id: string; title: string; type: string
      cover_url: string | null; year: number | null
      site_key: string | null; site_name: string | null
      first_source_url: string | null; created_at: string
      douban_status: DoubanStatus; source_check_status: SourceCheckStatus
      meta_score: number; active_source_count: string
    }>(
      `SELECT v.id, v.short_id, v.title, v.type,
              mc.cover_url, mc.year,
              cs.key AS site_key, cs.name AS site_name,
              (SELECT s.source_url FROM video_sources s
               WHERE s.video_id = v.id AND s.is_active = true AND s.deleted_at IS NULL
               LIMIT 1) AS first_source_url,
              v.created_at,
              v.douban_status, v.source_check_status, v.meta_score,
              (SELECT COUNT(*) FROM video_sources s
               WHERE s.video_id = v.id AND s.is_active = true AND s.deleted_at IS NULL
              )::int AS active_source_count
       ${VIDEO_JOIN}
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
       WHERE ${where}
       ORDER BY v.created_at ${orderDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...filterParams, params.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)
       ${VIDEO_JOIN}
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
       WHERE ${where}`,
      filterParams
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
      doubanStatus: r.douban_status ?? 'pending',
      sourceCheckStatus: r.source_check_status ?? 'pending',
      metaScore: r.meta_score ?? 0,
      activeSourceCount: parseInt(r.active_source_count ?? '0'),
    })),
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

// ── 丰富流水线状态更新 ────────────────────────────────────────────

/** 写入豆瓣匹配状态和元数据完整度评分（MetadataEnrichService 调用） */
export async function updateVideoEnrichStatus(
  db: Pool,
  videoId: string,
  { doubanStatus, metaScore }: { doubanStatus: DoubanStatus; metaScore: number }
): Promise<void> {
  await db.query(
    `UPDATE videos SET douban_status = $1, meta_score = $2, updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL`,
    [doubanStatus, metaScore, videoId]
  )
}

/** 写入源活性检验聚合结果（MetadataEnrichService 调用） */
export async function updateVideoSourceCheckStatus(
  db: Pool,
  videoId: string,
  status: SourceCheckStatus
): Promise<void> {
  await db.query(
    `UPDATE videos SET source_check_status = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL`,
    [status, videoId]
  )
}

/**
 * 从 video_sources.is_active 聚合并回写单条视频的 source_check_status。
 * 用于补源完成后即时更新状态（crawlerWorker source-refetch 成功路径）。
 */
export async function syncSourceCheckStatusFromSources(
  db: Pool,
  videoId: string,
): Promise<void> {
  await db.query(
    `UPDATE videos
     SET source_check_status = (
       CASE
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = $1 AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = $1 AND is_active = true AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = $1 AND is_active = false AND deleted_at IS NULL
         ) THEN 'partial'
         ELSE 'ok'
       END
     ),
     updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [videoId],
  )
}

/**
 * 批量从 video_sources.is_active 聚合并回写 source_check_status。
 * filter='published'：已上架视频（verify-published-sources 前置步骤）。
 * filter='staging'：暂存中视频（verify-staging-sources 任务）。
 * 返回实际更新行数。
 */
export async function bulkSyncSourceCheckStatus(
  db: Pool,
  filter: 'published' | 'staging',
  limit = 500,
): Promise<number> {
  const filterClause = filter === 'published'
    ? `is_published = true`
    : `review_status = 'approved' AND visibility_status = 'internal' AND is_published = false`

  const result = await db.query(
    `UPDATE videos
     SET source_check_status = (
       CASE
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = videos.id AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = videos.id AND is_active = true AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = videos.id AND is_active = false AND deleted_at IS NULL
         ) THEN 'partial'
         ELSE 'ok'
       END
     ),
     updated_at = NOW()
     WHERE id IN (
       SELECT id FROM videos
       WHERE ${filterClause}
         AND deleted_at IS NULL
       LIMIT $1
     )`,
    [limit],
  )
  return result.rowCount ?? 0
}

// ── 榜单标签（Migration 051，ADR-052）─────────────────────────────

export async function setVideoTrendingTag(
  db: Pool,
  videoId: string,
  tag: TrendingTag,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE videos SET trending_tag = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [videoId, tag],
  )
  return (result.rowCount ?? 0) > 0
}

export async function clearVideoTrendingTag(
  db: Pool,
  videoId: string,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE videos SET trending_tag = NULL, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [videoId],
  )
  return (result.rowCount ?? 0) > 0
}

export async function listVideosByTrendingTag(
  db: Pool,
  tag: TrendingTag,
  limit = 20,
): Promise<VideoCard[]> {
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.trending_tag = $1
       AND v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'
     ORDER BY v.created_at DESC
     LIMIT $2`,
    [tag, Math.min(limit, 100)],
  )
  return result.rows.map(mapVideoCard)
}

// ── Home 首页专用查询 ─────────────────────────────────────────────

/**
 * 按 rating DESC, year DESC 排序取 VideoCard（首页 top10 fallback 补位）
 * excludeIds: 已人工置顶的 video.id（UUID），补位时跳过
 */
export async function listVideosByRatingDesc(
  db: Pool,
  limit: number,
  excludeIds: string[] = [],
): Promise<VideoCard[]> {
  const safeLimit = Math.min(limit, 100)
  const params: unknown[] = [safeLimit]
  let excludeClause = ''
  if (excludeIds.length > 0) {
    params.push(excludeIds)
    excludeClause = `AND v.id <> ALL($2::uuid[])`
  }
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'
       ${excludeClause}
     ORDER BY mc.rating DESC NULLS LAST, mc.year DESC NULLS LAST
     LIMIT $1`,
    params,
  )
  return result.rows.map(mapVideoCard)
}

/**
 * 批量按 UUID 取 VideoCard（首页 top10 人工置顶解析，避免 N+1）
 * content_ref_id 是 videos.id（UUID），不是 short_id
 * 返回结果可能少于 ids 长度（已下线 / 未发布条目自动丢弃）
 */
export async function listVideoCardsByIds(
  db: Pool,
  ids: string[],
): Promise<VideoCard[]> {
  if (ids.length === 0) return []
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.id = ANY($1::uuid[])
       AND v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'`,
    [ids],
  )
  return result.rows.map(mapVideoCard)
}

/**
 * 按 type 分组统计已发布公开视频数量
 * 返回全部 VideoType 枚举值（无视频的类型 count=0，保证前端消费稳定）
 */
export async function countVideosByType(
  db: Pool,
): Promise<Array<{ type: VideoType; count: number }>> {
  const ALL_TYPES: VideoType[] = [
    'movie', 'series', 'anime', 'variety', 'documentary',
    'short', 'sports', 'music', 'news', 'kids', 'other',
  ]
  const result = await db.query<{ type: VideoType; count: string }>(
    `SELECT v.type, COUNT(*)::int AS count
     FROM videos v
     WHERE v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'
     GROUP BY v.type`,
  )
  const map = new Map(result.rows.map((r) => [r.type, parseInt(r.count, 10)]))
  return ALL_TYPES.map((type) => ({ type, count: map.get(type) ?? 0 }))
}
