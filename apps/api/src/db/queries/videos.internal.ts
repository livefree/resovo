/**
 * videos.internal.ts — videos 共享内部类型与 SQL 常量
 * 从 videos.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 * 供 videos.ts / videos.mutations.ts / videos.crawler.ts / videos.status.ts 引用
 */

import type {
  Video, VideoCard, VideoType, VideoStatus, VideoGenre,
  ContentFormat, EpisodePattern, ReviewStatus, VisibilityStatus,
  DoubanStatus, BangumiStatus, SourceCheckStatus, TrendingTag, VideoMetaQuality,
  EnrichmentSummary,
} from '@/types'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

export interface DbVideoRow {
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
  // Migration 082 — Bangumi 匹配状态（ADR-170）
  bangumi_status: BangumiStatus
  source_check_status: SourceCheckStatus
  meta_score: number
  // Migration 077 — 元数据信号字典 jsonb（CHG-365-A2）
  meta_quality: VideoMetaQuality | null
  // Migration 078 — META-EPISODES 三层集数语义（ADR-163 / CHG-367-B-A）
  total_episodes: number | null
  current_episodes: number | null
  // Migration 051 字段
  trending_tag: TrendingTag | null
  // Migration 055 — 审核台字段（CHG-SN-4-03）
  staff_note: string | null
  review_label_key: string | null
  // Migration 060 — 审核来源（CHG-SN-4-03）
  review_source: string | null
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
  bangumi_subject_id: number | null   // Migration 026 / ADR-170 C-3：富集摘要用
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

export function mapVideoRow(row: DbVideoRow): Video {
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
    metaQuality: row.meta_quality ?? null,
    totalEpisodes: row.total_episodes ?? null,
    currentEpisodes: row.current_episodes ?? null,
    trendingTag: row.trending_tag ?? null,
    posterBlurhash: row.poster_blurhash ?? null,
    posterStatus: row.poster_status ?? null,
    backdropBlurhash: row.backdrop_blurhash ?? null,
    backdropStatus: row.backdrop_status ?? null,
    logoUrl: row.logo_url ?? null,
    logoStatus: row.logo_status ?? null,
  }
}

export function mapVideoCard(row: DbVideoRow): VideoCard {
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

/**
 * EnrichmentSourceRow — buildEnrichmentSummary 的最小输入契约（ADR-170 AMENDMENT / META-12-A）。
 *
 * 仅声明投影所需 6 个 snake_case 字段，使投影逻辑可跨 row 形态复用：
 * DbVideoRow（admin 列表/详情）满足之；moderation listPendingQueue 亦构造此形入参。
 * 单一真源：所有 EnrichmentSummary 派生（默认值 + meta_quality 展开）只在本函数发生。
 */
export interface EnrichmentSourceRow {
  douban_status: DoubanStatus | null
  bangumi_status: BangumiStatus | null
  source_check_status: SourceCheckStatus | null
  meta_score: number | null
  meta_quality: VideoMetaQuality | null
  bangumi_subject_id: number | null
}

/**
 * buildEnrichmentSummary — EnrichmentSourceRow → EnrichmentSummary 派生投影（ADR-170 C-3 / R-5）。
 *
 * 纯函数，由 admin 路径（VideoService.adminList/adminFindById）注入到 VideoAdminRow/Detail；
 * **不挂 public mapVideoRow**（public Video 形状不变）。从同一 row 单次构造，展开 meta_quality JSON。
 * 参数窄化为 EnrichmentSourceRow（ADR-170 AMENDMENT / META-12-A）：DbVideoRow 仍满足，
 * 新增 moderation 消费方亦可复用同一投影，禁止异源重复实现。
 */
export function buildEnrichmentSummary(row: EnrichmentSourceRow): EnrichmentSummary {
  const mq = row.meta_quality
  return {
    doubanStatus: row.douban_status ?? 'pending',
    bangumiStatus: row.bangumi_status ?? 'pending',
    sourceCheckStatus: row.source_check_status ?? 'pending',
    metaScore: row.meta_score ?? 0,
    enrichedAt: mq?.enriched_at ?? null,
    titleEnIsPinyin: mq?.title_en_is_pinyin ?? false,
    doubanConfidence: mq?.douban_confidence ?? null,
    bangumiSubjectId: row.bangumi_subject_id ?? null,
  }
}

// ── 公共子查询片段 ────────────────────────────────────────────────

export const SOURCE_COUNT_SUBQUERY = `(
  SELECT COUNT(*)::int FROM video_sources
  WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL
)`

export const SUBTITLE_LANGS_SUBQUERY = `(
  SELECT ARRAY_AGG(DISTINCT language) FROM subtitles
  WHERE video_id = v.id AND deleted_at IS NULL
)`

/** 标准 JOIN：videos + media_catalog */
export const VIDEO_JOIN = `FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id`

/**
 * 标准 SELECT 列列表（用于返回完整 DbVideoRow）
 * 所有 metadata 字段通过 JOIN mc 取得
 */
export const VIDEO_FULL_SELECT = `
  v.id, v.short_id, v.slug, v.title, v.type, v.catalog_id,
  v.episode_count, v.is_published, v.created_at, v.updated_at,
  v.source_content_type, v.normalized_type, v.content_format, v.episode_pattern,
  v.review_status, v.visibility_status, v.needs_manual_review,
  v.content_rating, v.site_key, v.source_category,
  v.douban_status, v.bangumi_status, v.source_check_status, v.meta_score, v.meta_quality,
  v.total_episodes, v.current_episodes, v.trending_tag,
  v.staff_note, v.review_label_key, v.review_source,
  mc.title_en, mc.title_original, mc.description, mc.cover_url,
  mc.rating, mc.rating_votes, mc.runtime_minutes, mc.year, mc.country,
  mc.status, mc.director, mc."cast", mc.writers, mc.genres,
  mc.aliases, mc.languages, mc.tags,
  mc.douban_id, mc.imdb_id, mc.tmdb_id, mc.bangumi_subject_id, mc.title_normalized, mc.metadata_source,
  mc.poster_blurhash, mc.poster_status,
  mc.backdrop_blurhash, mc.backdrop_status,
  mc.logo_url, mc.logo_status
`
