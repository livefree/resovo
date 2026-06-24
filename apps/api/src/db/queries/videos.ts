/**
 * videos.ts — 视频表 DB 查询
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 * 只返回 is_published=true 的视频（ADR-010，admin 函数除外）
 * 写入/状态/爬虫/审核函数迁至子模块（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import type {
  Video, VideoCard, VideoType, VisibilityStatus, ReviewStatus, VideoStatus, DoubanStatus, BangumiStatus,
  MetadataStatusOverall, MetadataProvider, MetadataProviderState, MetadataIssueLevel, MetadataMatchedFilterValue,
} from '@/types'
import { METADATA_PROVIDERS, METADATA_MATCHED_NONE } from '@/types'
import type { DbVideoRow } from './videos.internal'
import {
  mapVideoRow, mapVideoCard,
  VIDEO_FULL_SELECT, VIDEO_JOIN,
  SOURCE_COUNT_SUBQUERY, SUBTITLE_LANGS_SUBQUERY,
} from './videos.internal'
import { METADATA_STATUS_JOIN_SQL, METADATA_OVERALL_RANK, METADATA_ISSUE_RANK } from './metadata-status.derive'

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
  lang?: string
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
  // lang = 音频语音（audio_language，video_sources 行级，Migration 112）。
  // 聚合语义：≥1 active 未软删 source 命中（ADR-199 D-199-7 / HANDOFF-38 裁定）；
  // NULL=未知按 SQL 三值逻辑自然不命中。镜像 SOURCE_COUNT_SUBQUERY 的活跃源过滤。
  if (filters.lang) {
    conditions.push(`EXISTS (
      SELECT 1 FROM video_sources
      WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL
        AND audio_language = $${idx++}
    )`)
    params.push(filters.lang)
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

/**
 * META-36-A：provider → 动态 LATERAL `md` 单源 state 列映射（与 METADATA_STATUS_JOIN_SQL 暴露列对齐）。
 * 列名为代码常量，metadataProvider facet 谓词据 csvEnum 校验后的枚举值取列，无用户输入拼接。
 */
const PROVIDER_STATE_COL: Record<MetadataProvider, string> = {
  douban: 'md.md_douban_state',
  bangumi: 'md.md_bangumi_state',
  tmdb: 'md.md_tmdb_state',
  imdb: 'md.md_imdb_state',
}

// META-36-C：已匹配源数量（state=applied 计数 0–4）排序表达式。md.* 为 LEFT JOIN LATERAL，
// 无 catalog 视频列值 NULL → `CASE WHEN =applied THEN 1 ELSE 0` NULL 安全（计 0）。列名/字面量皆代码常量。
const METADATA_MATCHED_COUNT_EXPR = `(${METADATA_PROVIDERS
  .map((p) => `CASE WHEN ${PROVIDER_STATE_COL[p]} = 'applied' THEN 1 ELSE 0 END`)
  .join(' + ')})`
// META-52：provider「有数据」判定——state ∈ applied/candidate/problem（含外部已获取但未应用的 candidate）。
// 与前端 METADATA_PRESENT_STATES + ADR-201 metadataProvider facet 同口径；状态字面量为代码常量，无用户输入拼接。
const PROVIDER_DATA_STATES_SQL = "('applied','candidate','problem')"
const providerHasDataSql = (col: string) => `${col} IN ${PROVIDER_DATA_STATES_SQL}`
// 「无任何来源数据」谓词：四源皆无数据（state ∉ applied/candidate/problem，含 NULL/missing/not_applicable）。
// NULL 安全：`NULL NOT IN (...)` 求值 unknown → 显式 `IS NULL` 兜底。
const NO_PROVIDER_DATA_SQL = `(${METADATA_PROVIDERS
  .map((p) => `(${PROVIDER_STATE_COL[p]} IS NULL OR ${PROVIDER_STATE_COL[p]} NOT IN ${PROVIDER_DATA_STATES_SQL})`)
  .join(' AND ')})`

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
  // META-32-B（ADR-201 §视频库 排序）：元数据运营优先级（动态 LATERAL md.metadata_status_rank，
  // ASC=needs_review→complete）+ 完整度独立字段（v.meta_score，不复用 meta composite）
  metadata_status: 'md.metadata_status_rank',
  metadata_score: 'v.meta_score',
  // META-36-C（ADR-201 §视频库 排序偏离）：`meta` 复合列改按「已匹配源数量」（applied 计数）；
  // metadata_status 运营优先级排序保留可用（API 后向兼容，UI 不再指向）。
  metadata_matched_count: METADATA_MATCHED_COUNT_EXPR,
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
  // ── META-32-B（ADR-201 §视频库 过滤 / D-201-6）：元数据状态服务端过滤（动态 LATERAL `md`）──
  // 注：元数据完整度范围复用上方 metaScoreMin/metaScoreMax（同列 v.meta_score），不另设入口。
  /** 整体状态多选（overall；映射 md.metadata_status_rank = ANY） */
  metadataOverall?: readonly MetadataStatusOverall[]
  /**
   * 单列 provider facet 多选（META-36-A / ADR-201 §视频库）：选中 provider 中任一「有数据」
   * （`md_<p>_state ∈ applied/candidate/problem`）即命中，OR 合流；与 providerState 正交 AND。
   */
  metadataProvider?: readonly MetadataProvider[]
  /** 单源状态多选（任一 provider state ∈ 集合） */
  metadataProviderState?: readonly MetadataProviderState[]
  /**
   * META-36-C：「已匹配源」多选过滤（OR 合流）。值 ∈ 四 provider（该源 `state=applied` 命中）∪ `none`
   * （四源皆非 applied）。区别于 `metadataProvider`「有数据」facet，本过滤严格 `applied`（已匹配）。
   */
  metadataMatched?: readonly MetadataMatchedFilterValue[]
  /** 问题等级多选（映射 md.metadata_issue_rank = ANY） */
  metadataIssueLevel?: readonly MetadataIssueLevel[]
  /** 最近增强时间范围（meta_quality.enriched_at；含端点，ISO8601） */
  metadataUpdatedFrom?: string
  metadataUpdatedTo?: string
  /** 快捷筛选：需复核（overall=needs_review）。仅 true 生效 */
  metadataNeedsReview?: boolean
  /** 快捷筛选：有候选（任一 provider state=candidate）。仅 true 生效 */
  metadataHasCandidate?: boolean
  /** 快捷筛选：未增强（overall=missing）。仅 true 生效 */
  metadataMissing?: boolean
  /** 快捷筛选：TMDB 待处理（tmdb state ∈ candidate/problem/missing）。仅 true 生效 */
  metadataTmdbPending?: boolean
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

  // ── META-32-B（ADR-201 §视频库 过滤）：元数据状态谓词（引用动态 LATERAL `md`，下方按需拼 JOIN）──
  if (filters.metadataOverall?.length) {
    conditions.push(`md.metadata_status_rank = ANY($${idx++}::int[])`)
    params.push(filters.metadataOverall.map((o) => METADATA_OVERALL_RANK[o]))
  }
  if (filters.metadataIssueLevel?.length) {
    conditions.push(`md.metadata_issue_rank = ANY($${idx++}::int[])`)
    params.push(filters.metadataIssueLevel.map((l) => METADATA_ISSUE_RANK[l]))
  }
  if (filters.metadataProvider?.length) {
    // META-36-A facet：选中 provider 中任一「有数据」(state ∈ applied/candidate/problem) 即命中，OR 合流。
    // 列名经 PROVIDER_STATE_COL 由校验后枚举映射、状态字面量为代码常量 → 无用户输入拼接（对齐 metadataTmdbPending 内联范式）。
    const cols = filters.metadataProvider.map((p) => PROVIDER_STATE_COL[p])
    conditions.push(`(${cols.map((c) => providerHasDataSql(c)).join(' OR ')})`)
  }
  if (filters.metadataMatched?.length) {
    // META-52（原 META-36-C）：视频库「元数据」列来源过滤改「有数据」口径——选中 provider 谓词 = 该源
    // state ∈ applied/candidate/problem（含外部已获取但未应用的 candidate），哨兵 none = 四源皆无数据；
    // OR 合流。与 metadataProvider facet 复用 providerHasDataSql（消除重复实现）。列名/字面量皆代码常量。
    const preds = filters.metadataMatched.map((v) =>
      v === METADATA_MATCHED_NONE ? NO_PROVIDER_DATA_SQL : providerHasDataSql(PROVIDER_STATE_COL[v]),
    )
    conditions.push(`(${preds.join(' OR ')})`)
  }
  if (filters.metadataProviderState?.length) {
    // 任一 provider state ∈ 选中集（四源 OR，复用单参数）
    conditions.push(
      `(md.md_douban_state = ANY($${idx}::text[]) OR md.md_bangumi_state = ANY($${idx}::text[])`
      + ` OR md.md_tmdb_state = ANY($${idx}::text[]) OR md.md_imdb_state = ANY($${idx}::text[]))`,
    )
    idx++
    params.push(filters.metadataProviderState)
  }
  if (filters.metadataUpdatedFrom !== undefined) {
    conditions.push(`NULLIF(v.meta_quality->>'enriched_at','')::timestamptz >= $${idx++}::timestamptz`)
    params.push(filters.metadataUpdatedFrom)
  }
  if (filters.metadataUpdatedTo !== undefined) {
    conditions.push(`NULLIF(v.meta_quality->>'enriched_at','')::timestamptz <= $${idx++}::timestamptz`)
    params.push(filters.metadataUpdatedTo)
  }
  // 元数据快捷筛选（仅 true 追加；rank 字面量来自代码常量非用户输入）
  if (filters.metadataNeedsReview === true) {
    conditions.push(`md.metadata_status_rank = ${METADATA_OVERALL_RANK.needs_review}`)
  }
  if (filters.metadataMissing === true) {
    conditions.push(`md.metadata_status_rank = ${METADATA_OVERALL_RANK.missing}`)
  }
  if (filters.metadataHasCandidate === true) {
    conditions.push(`'candidate' IN (md.md_douban_state, md.md_bangumi_state, md.md_tmdb_state, md.md_imdb_state)`)
  }
  if (filters.metadataTmdbPending === true) {
    conditions.push(`md.md_tmdb_state IN ('candidate','problem','missing')`)
  }

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit
  const orderByCol = SORT_FIELD_WHITELIST[filters.sortField ?? ''] ?? 'v.created_at'
  const orderByDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC'

  // 动态 LATERAL：仅当按 metadata_status 排序或带 metadata 过滤时才挂（默认列表路径零额外成本）
  const hasMetadataFilter =
    !!filters.metadataOverall?.length || !!filters.metadataIssueLevel?.length
    || !!filters.metadataProvider?.length || !!filters.metadataProviderState?.length
    || !!filters.metadataMatched?.length
    || filters.metadataUpdatedFrom !== undefined || filters.metadataUpdatedTo !== undefined
    || filters.metadataNeedsReview === true || filters.metadataMissing === true
    || filters.metadataHasCandidate === true || filters.metadataTmdbPending === true
  // META-36-C：metadata_matched_count 排序同 metadata_status 依赖动态 `md` LATERAL（其余排序路径零额外成本）。
  const sortNeedsMetadataJoin =
    filters.sortField === 'metadata_status' || filters.sortField === 'metadata_matched_count'
  const mainMetadataJoin = hasMetadataFilter || sortNeedsMetadataJoin ? `\n       ${METADATA_STATUS_JOIN_SQL}` : ''
  const countMetadataJoin = hasMetadataFilter ? `\n       ${METADATA_STATUS_JOIN_SQL}` : ''

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
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key${mainMetadataJoin}
       WHERE ${where}
       ORDER BY ${orderByCol} ${orderByDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) ${VIDEO_JOIN}
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key${countMetadataJoin}
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
 * tmdb-missing=catalog 无 tmdb_id 且类型可匹配 TMDB（META-51-B）——TMDB 实装后存量首次回填用，
 *   独立档因 never/unmatched/all 基于 douban/bangumi 状态，会漏掉「douban 已匹配且 meta_quality 非空但无 TMDB」的视频
 * all=never∪unmatched∪missing-characters（默认；不含 tmdb-missing，避免重跑全量误带短剧/other）
 */
export type BackfillEnrichMode = 'never' | 'unmatched' | 'missing-characters' | 'tmdb-missing' | 'tmdb-season' | 'all'

/** TMDB 可匹配类型（META-51-B）：short/other 基本不在 TMDB，tmdb-missing 模式内即收敛排除。 */
const TMDB_MATCHABLE_TYPES = ['movie', 'series', 'anime', 'variety', 'documentary'] as const

/** TV 家族类型（ADR-207 D-207-9b/10）：仅分季 catalog（season_number IS NOT NULL）进季级回填，movie 无季。 */
const TV_FAMILY_TYPES = ['series', 'anime', 'variety', 'documentary'] as const

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
  } else if (mode === 'tmdb-missing') {
    // META-51-B：catalog 无 tmdb_id 且类型可匹配 TMDB（短剧/other 排除）。类型字面量为代码常量，参数化 IN。
    conditions.push('mc.tmdb_id IS NULL')
    conditions.push(`v.type = ANY($${idx++}::text[])`)
    params.push(TMDB_MATCHABLE_TYPES)
  } else if (mode === 'tmdb-season') {
    // ADR-207 D-207-9b/-10：季级 TMDB 回填——TV 家族 ∧ season_number IS NOT NULL（仅分季 catalog 进季级路径，
    // 触发 stepTmdb 透传 seasonNumber → autoMatch 写正确 season exact 季 id + 逐集；存量 stale 行由清理脚本另行降级）。
    conditions.push('mc.season_number IS NOT NULL')
    conditions.push(`v.type = ANY($${idx++}::text[])`)
    params.push(TV_FAMILY_TYPES)
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
