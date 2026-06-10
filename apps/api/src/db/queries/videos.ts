/**
 * videos.ts — 视频表 DB 查询
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 * 只返回 is_published=true 的视频（ADR-010，admin 函数除外）
 * 写入/状态/爬虫/审核函数迁至子模块（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import type { Video, VideoCard, VideoType, VisibilityStatus, ReviewStatus, VideoStatus, DoubanStatus, BangumiStatus } from '@/types'
import type { DbVideoRow } from './videos.internal'
import {
  mapVideoRow, mapVideoCard,
  VIDEO_FULL_SELECT, VIDEO_JOIN,
  SOURCE_COUNT_SUBQUERY, SUBTITLE_LANGS_SUBQUERY,
} from './videos.internal'

export type { DbVideoRow } from './videos.internal'
export { buildEnrichmentSummary } from './videos.internal'

// ── 子模块再导出 ──────────────────────────────────────────────────

export type {
  CreateVideoInput, UpdateVideoMetaInput,
  VideoStateTransitionAction, TransitionVideoStateInput, TransitionVideoStateResult,
  ReviewAction,
} from './videos.mutations'
export {
  createVideo, updateVideoMeta, publishVideo,
  transitionVideoState, batchPublishVideos, batchUnpublishVideos,
  updateVisibility, reviewVideo, findVideoIdByShortId,
} from './videos.mutations'

export type {
  MetadataSource, UpdateDoubanInput, CrawlerInsertInput,
} from './videos.crawler'
export {
  METADATA_SOURCE_PRIORITY,
  findVideoByNormalizedKey, updateDoubanData,
  insertCrawledVideo, bumpEpisodeCountIfHigher, upsertVideoAliases,
} from './videos.crawler'

export type {
  ModerationStats, PendingReviewVideoRow,
} from './videos.status'
export {
  getModerationStats, listPendingReviewVideos,
  updateVideoEnrichStatus, updateVideoSourceCheckStatus, updateVideoBangumiStatus,
  updateVideoEpisodes, updateEpisodeCount,
  syncSourceCheckStatusFromSources, bulkSyncSourceCheckStatus,
  setVideoTrendingTag, clearVideoTrendingTag, listVideosByTrendingTag,
  listVideosByRatingDesc, listVideoCardsByIds, countVideosByType,
} from './videos.status'

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

// ── 查询：详情（admin preview / ADR-160 D-160-4a + Y2）────────────
// 放行 visibility_status ∈ {public, internal, hidden} + review_status 全档
// 永不放行 deleted_at IS NOT NULL（软删保护）
export async function findVideoByShortIdAdminPreview(
  db: Pool,
  shortId: string
): Promise<Video | null> {
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.short_id = $1
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

// AMD2-PATCH-2（2026-05-24）：扩展 SORT_FIELDS 白名单 / 兑现 ADR-150 AMD2 D-150-AMD2-1
// "所有有数据的列默认可排序"原则 / 解决 R-A2-2 sort 422 / 前端禁用反范式
// 字段命名约定：key = column.id（前端列 id）/ value = SQL 表达式（含表前缀或 SELECT alias）
const SORT_FIELD_WHITELIST: Record<string, string> = {
  created_at: 'v.created_at',
  updated_at: 'v.updated_at',
  title: 'v.title',
  year: 'mc.year',                    // year 在 media_catalog
  type: 'v.type',
  // AMD2-PATCH-2 新扩 5 字段：
  source_health: 'active_source_count', // SELECT alias / 子查询计算 / 不带表前缀
  visibility: 'v.visibility_status',    // column.id 'visibility' / SQL 'visibility_status'
  review_status: 'v.review_status',
  douban_status: 'v.douban_status',
  meta_score: 'v.meta_score',
  episode_count: 'v.episode_count',     // CHG-VSR-2（§2.5）：集数列排序
  // SRCHEALTH-P1-1-A（B1）：探测/试播聚合列排序（probe 直通列 / render SELECT alias 同 source_health 先例）
  source_check_status: 'v.source_check_status',
  render_check_status: 'render_check_status',
}

export interface AdminVideoListFilters {
  status?: 'pending' | 'published' | 'unpublished' | 'all'
  type?: VideoType
  /** CHG-VSR-2（§2.6）：type 多选（加性，与单值 type 并存；二者皆传时 types 优先）。`v.type = ANY` */
  types?: readonly VideoType[]
  q?: string
  /** 按来源站点 key 筛选（videos.site_key） */
  siteKey?: string
  /** false 时隐藏来自成人源站（crawler_sites.is_adult=true）的视频 */
  includeAdult?: boolean
  visibilityStatus?: VisibilityStatus
  reviewStatus?: ReviewStatus
  // ── CHG-VSR-2（设计 §2.6 三层过滤 / ADR-150 AMENDMENT D-150-VSR2-*）：原子可筛选列 + 快捷筛选派生 ──
  /** 年份范围（mc.year，含端点） */
  yearMin?: number
  yearMax?: number
  /** 出品地区多选（mc.country） */
  country?: readonly string[]
  /** 连载状态多选（mc.status：ongoing/completed） */
  catalogStatus?: readonly VideoStatus[]
  /** 发布布尔（v.is_published；与 status 三态并存取交集） */
  isPublished?: boolean
  /** 豆瓣匹配状态多选（v.douban_status） */
  doubanStatus?: readonly DoubanStatus[]
  /** Bangumi 匹配状态多选（v.bangumi_status，仅 anime 有意义） */
  bangumiStatus?: readonly BangumiStatus[]
  /** 元数据完整度范围（v.meta_score 0–100） */
  metaScoreMin?: number
  metaScoreMax?: number
  /** 快捷筛选：集数不一致（current_episodes IS DISTINCT FROM episode_count）。仅 true 生效 */
  episodeMismatch?: boolean
  /** 快捷筛选：集数缺失（total_episodes 或 current_episodes 为 NULL）。仅 true 生效 */
  episodeMissing?: boolean
  /** 快捷筛选：元数据缺失（meta_score < 60 或 NULL，对齐 §2.4）。仅 true 生效 */
  metaIncomplete?: boolean
  /** 快捷筛选：待审（review_status='pending_review'）。仅 true 生效 */
  pendingReview?: boolean
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
    // CHG-VSR-2（§2.6）：搜索扩面 title / title_en / title_original / short_id（单参数复用）
    conditions.push(
      `(v.title ILIKE $${idx} OR mc.title_en ILIKE $${idx} OR mc.title_original ILIKE $${idx} OR v.short_id ILIKE $${idx})`
    )
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

  // ── CHG-VSR-2（设计 §2.6 / ADR-150 AMENDMENT D-150-VSR2-*）：升级过滤条件 ──
  // 数组枚举一律 `= ANY($n::text[])` 参数化（防注入 + 空数组短路跳过避免误过滤全表）
  if (filters.types?.length) {
    conditions.push(`v.type = ANY($${idx++}::text[])`)
    params.push(filters.types)
  }
  if (filters.yearMin !== undefined) {
    conditions.push(`mc.year >= $${idx++}`)
    params.push(filters.yearMin)
  }
  if (filters.yearMax !== undefined) {
    conditions.push(`mc.year <= $${idx++}`)
    params.push(filters.yearMax)
  }
  if (filters.country?.length) {
    conditions.push(`mc.country = ANY($${idx++}::text[])`)
    params.push(filters.country)
  }
  if (filters.catalogStatus?.length) {
    conditions.push(`mc.status = ANY($${idx++}::text[])`)
    params.push(filters.catalogStatus)
  }
  if (filters.isPublished !== undefined) {
    conditions.push(`v.is_published = $${idx++}`)
    params.push(filters.isPublished)
  }
  if (filters.doubanStatus?.length) {
    conditions.push(`v.douban_status = ANY($${idx++}::text[])`)
    params.push(filters.doubanStatus)
  }
  if (filters.bangumiStatus?.length) {
    conditions.push(`v.bangumi_status = ANY($${idx++}::text[])`)
    params.push(filters.bangumiStatus)
  }
  if (filters.metaScoreMin !== undefined) {
    conditions.push(`v.meta_score >= $${idx++}`)
    params.push(filters.metaScoreMin)
  }
  if (filters.metaScoreMax !== undefined) {
    conditions.push(`v.meta_score <= $${idx++}`)
    params.push(filters.metaScoreMax)
  }
  // 派生快捷筛选（仅 true 追加，false/undefined 不加反向谓词）
  if (filters.episodeMismatch === true) {
    conditions.push(`v.current_episodes IS DISTINCT FROM v.episode_count`)
  }
  if (filters.episodeMissing === true) {
    conditions.push(`(v.total_episodes IS NULL OR v.current_episodes IS NULL)`)
  }
  if (filters.metaIncomplete === true) {
    conditions.push(`(v.meta_score IS NULL OR v.meta_score < 60)`)
  }
  if (filters.pendingReview === true) {
    conditions.push(`v.review_status = 'pending_review'`)
  }

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit
  const orderByCol = SORT_FIELD_WHITELIST[filters.sortField ?? ''] ?? 'v.created_at'
  const orderByDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC'

  const [rows, countResult] = await Promise.all([
    db.query<DbVideoRow & { active_source_count: string; total_source_count: string; render_check_status: string }>(
      `SELECT ${VIDEO_FULL_SELECT},
              NULL::text[] AS subtitle_langs,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS source_count,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL)::text AS active_source_count,
              (SELECT COUNT(*) FROM video_sources
               WHERE video_id = v.id AND deleted_at IS NULL)::text AS total_source_count,
              (SELECT CASE
                 WHEN COUNT(*) FILTER (WHERE render_status <> 'pending') = 0 THEN 'pending'
                 WHEN COUNT(*) FILTER (WHERE render_status <> 'dead') = 0 THEN 'all_dead'
                 WHEN COUNT(*) FILTER (WHERE render_status = 'ok') = COUNT(*) THEN 'ok'
                 ELSE 'partial'
               END FROM video_sources
               WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL) AS render_check_status
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

// ── 批量重富集 backfill（META-15-C）──────────────────────────────────

/**
 * never=从未富集（meta_quality NULL）
 * unmatched=douban|bangumi 未命中（跑过但未命中，可重试）
 * missing-characters=anime 且无 catalog_characters（含已 matched anime → META-19 角色回填关键）
 * all=以上三者并集（默认；覆盖既有 matched anime 的角色缺口）
 */
export type BackfillEnrichMode = 'never' | 'unmatched' | 'missing-characters' | 'all'

/** backfill 入队所需最小字段（对齐 EnrichJobData：videoId/catalogId/title/year/type）。 */
export interface BackfillEnrichRow {
  id: string
  catalog_id: string
  title: string
  type: VideoType
  year: number | null
}

/**
 * 列出需要批量重富集的视频（META-15-C）。
 *   - never：meta_quality IS NULL（富集从未跑过）
 *   - unmatched：douban_status='unmatched' OR bangumi_status='unmatched'（跑过但未命中，可重试）
 *   - missing-characters：anime 且 catalog_characters 无该 catalog 行（含已 matched anime，
 *     META-19 角色管线上线后存量 matched anime 无角色 → 必须重富集补，否则永远填不上）
 *   - all：以上三者并集（默认）
 * 排除软删；可选 type 过滤 + limit（小批验证）。按 created_at 升序（先老后新，稳定）。
 */
export async function listVideosForBackfillEnrich(
  db: Pool,
  opts: { mode?: BackfillEnrichMode; type?: VideoType; limit?: number } = {}
): Promise<BackfillEnrichRow[]> {
  const mode = opts.mode ?? 'all'
  const conditions: string[] = ['v.deleted_at IS NULL']
  const params: unknown[] = []
  let idx = 1

  // anime 缺角色（含已 matched）：META-19 角色回填关键条件
  const ANIME_MISSING_CHARS =
    "(v.type = 'anime' AND NOT EXISTS (" +
    "SELECT 1 FROM catalog_characters cc WHERE cc.catalog_id = v.catalog_id AND cc.source = 'bangumi'))"

  if (mode === 'never') {
    conditions.push('v.meta_quality IS NULL')
  } else if (mode === 'unmatched') {
    conditions.push("(v.douban_status = 'unmatched' OR v.bangumi_status = 'unmatched')")
  } else if (mode === 'missing-characters') {
    conditions.push(ANIME_MISSING_CHARS)
  } else {
    conditions.push(
      "(v.meta_quality IS NULL OR v.douban_status = 'unmatched' OR v.bangumi_status = 'unmatched' OR " +
      ANIME_MISSING_CHARS + ')'
    )
  }

  if (opts.type) {
    conditions.push(`v.type = $${idx++}`)
    params.push(opts.type)
  }

  let sql = `SELECT v.id, v.catalog_id, v.title, v.type, mc.year
     ${VIDEO_JOIN}
     WHERE ${conditions.join(' AND ')}
     ORDER BY v.created_at ASC`
  if (opts.limit != null) {
    sql += ` LIMIT $${idx++}`
    params.push(opts.limit)
  }

  const result = await db.query<BackfillEnrichRow>(sql, params)
  return result.rows
}
