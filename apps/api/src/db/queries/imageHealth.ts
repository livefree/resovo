/**
 * imageHealth.ts — 图片健康事件与治理状态 DB 查询
 * 职责：broken_image_events CRUD + upsert 去重 + 聚合统计
 * 业务规则（巡检调度、状态推导）由 ImageHealthService 处理，不在此层实现
 */

import { createHash } from 'crypto'
import type { Pool, PoolClient } from 'pg'
import type { BrokenImageEvent, ImageKind, ImageStatus } from '@/types'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbBrokenImageEventRow {
  id: string
  video_id: string
  season_number: number | null
  episode_number: number | null
  image_kind: string
  url: string
  url_hash_prefix: string
  bucket_start: string
  event_type: string
  first_seen_at: string
  last_seen_at: string
  occurrence_count: number
  resolved_at: string | null
  resolution_note: string | null
}

// ── 辅助函数 ─────────────────────────────────────────────────────

/** sha256(url) 前 16 位十六进制 */
export function urlHashPrefix(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

/** floor(now, 10min) → YYYY-MM-DDTHH:MM:00Z 对齐到 10 分钟桶 */
export function tenMinBucket(now: Date = new Date()): Date {
  const bucket = new Date(now)
  bucket.setSeconds(0, 0)
  bucket.setMinutes(Math.floor(bucket.getMinutes() / 10) * 10)
  return bucket
}

function mapBrokenImageEventRow(row: DbBrokenImageEventRow): BrokenImageEvent {
  return {
    id: row.id,
    videoId: row.video_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    imageKind: row.image_kind as ImageKind,
    url: row.url,
    urlHashPrefix: row.url_hash_prefix,
    bucketStart: row.bucket_start,
    eventType: row.event_type,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: row.occurrence_count,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
  }
}

// ── 写入：upsert 去重 ─────────────────────────────────────────────

export interface UpsertBrokenImageEventInput {
  videoId: string
  seasonNumber?: number | null
  episodeNumber?: number | null
  imageKind: ImageKind
  url: string
  eventType: string
  now?: Date
}

/**
 * 按 (video_id, image_kind, url_hash_prefix, bucket_start) 去重 upsert。
 * 已存在：occurrence_count += 1，last_seen_at = now。
 * 不存在：新插入一行。
 */
export async function upsertBrokenImageEvent(
  db: Pool | PoolClient,
  input: UpsertBrokenImageEventInput
): Promise<BrokenImageEvent> {
  const now = input.now ?? new Date()
  const hashPrefix = urlHashPrefix(input.url)
  const bucket = tenMinBucket(now)

  const result = await db.query<DbBrokenImageEventRow>(
    `INSERT INTO broken_image_events
       (video_id, season_number, episode_number, image_kind,
        url, url_hash_prefix, bucket_start, event_type,
        first_seen_at, last_seen_at, occurrence_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, 1)
     ON CONFLICT (video_id, image_kind, url_hash_prefix, bucket_start)
     DO UPDATE SET
       occurrence_count = broken_image_events.occurrence_count + 1,
       last_seen_at     = EXCLUDED.last_seen_at
     RETURNING *`,
    [
      input.videoId,
      input.seasonNumber ?? null,
      input.episodeNumber ?? null,
      input.imageKind,
      input.url,
      hashPrefix,
      bucket.toISOString(),
      input.eventType,
      now.toISOString(),
    ]
  )
  return mapBrokenImageEventRow(result.rows[0])
}

// ── 写入：批量更新 media_catalog 图片状态 ─────────────────────────

export interface UpdateImageStatusInput {
  catalogId: string
  kind: 'poster' | 'backdrop' | 'logo' | 'banner_backdrop'
  status: ImageStatus
}

/**
 * 批量更新 media_catalog 的 <kind>_status 字段。
 * 每次只更新单个字段（写操作明确，防止意外覆盖其他 status）。
 */
export async function updateCatalogImageStatus(
  db: Pool | PoolClient,
  updates: UpdateImageStatusInput[]
): Promise<void> {
  if (updates.length === 0) return

  const allowedKinds = ['poster', 'backdrop', 'logo', 'banner_backdrop'] as const
  for (const { catalogId, kind, status } of updates) {
    if (!allowedKinds.includes(kind as (typeof allowedKinds)[number])) {
      throw new Error(`Invalid image kind for status update: ${kind}`)
    }
    const col = `${kind}_status`
    await db.query(
      `UPDATE media_catalog SET ${col} = $1, updated_at = NOW() WHERE id = $2`,
      [status, catalogId]
    )
  }
}

// ── 写入：更新 blurhash 与 primary color ─────────────────────────

export interface UpdateImageBlurhashInput {
  catalogId: string
  kind: 'poster' | 'backdrop' | 'banner_backdrop'
  blurhash: string | null
  primaryColor: string | null
}

export async function updateCatalogImageBlurhash(
  db: Pool | PoolClient,
  input: UpdateImageBlurhashInput
): Promise<void> {
  const { catalogId, kind, blurhash, primaryColor } = input
  const blurhashCol = `${kind}_blurhash`
  const colorCol = kind === 'banner_backdrop' ? null : `${kind}_primary_color`

  if (colorCol) {
    await db.query(
      `UPDATE media_catalog
       SET ${blurhashCol} = $1, ${colorCol} = $2, updated_at = NOW()
       WHERE id = $3`,
      [blurhash, primaryColor, catalogId]
    )
  } else {
    await db.query(
      `UPDATE media_catalog SET ${blurhashCol} = $1, updated_at = NOW() WHERE id = $2`,
      [blurhash, catalogId]
    )
  }
}

// ── 查询：后台监控统计 ────────────────────────────────────────────

export interface ImageHealthStats {
  totalVideos: number
  posterOkCount: number
  posterCoverage: number       // 0–1 浮点，posterOkCount / totalVideos
  backdropOkCount: number
  backdropCoverage: number
  brokenLast7Days: number
}

export async function getImageHealthStats(db: Pool): Promise<ImageHealthStats> {
  const [statsResult, brokenResult] = await Promise.all([
    db.query<{
      total_videos: string
      poster_ok: string
      backdrop_ok: string
    }>(
      `SELECT
         COUNT(v.id)::int                                              AS total_videos,
         COUNT(CASE WHEN mc.poster_status = 'ok' THEN 1 END)::int     AS poster_ok,
         COUNT(CASE WHEN mc.backdrop_status = 'ok' THEN 1 END)::int   AS backdrop_ok
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
       WHERE v.deleted_at IS NULL AND v.is_published = true`
    ),
    db.query<{ broken_last_7d: string }>(
      `SELECT COUNT(DISTINCT video_id)::int AS broken_last_7d
       FROM broken_image_events
       WHERE first_seen_at >= NOW() - INTERVAL '7 days'
         AND resolved_at IS NULL`
    ),
  ])

  const total = parseInt(statsResult.rows[0]?.total_videos ?? '0')
  const posterOk = parseInt(statsResult.rows[0]?.poster_ok ?? '0')
  const backdropOk = parseInt(statsResult.rows[0]?.backdrop_ok ?? '0')

  return {
    totalVideos: total,
    posterOkCount: posterOk,
    posterCoverage: total > 0 ? posterOk / total : 0,
    backdropOkCount: backdropOk,
    backdropCoverage: total > 0 ? backdropOk / total : 0,
    brokenLast7Days: parseInt(brokenResult.rows[0]?.broken_last_7d ?? '0'),
  }
}

export interface BrokenDomainRow {
  domain: string
  eventCount: number
  affectedVideos: number
}

/** TOP 破损域名（用于 CDN 故障定位） */
export async function getTopBrokenDomains(
  db: Pool,
  limit = 10
): Promise<BrokenDomainRow[]> {
  const result = await db.query<{
    domain: string
    event_count: string
    affected_videos: string
  }>(
    `SELECT
       regexp_replace(url, '^https?://([^/]+).*', '\\1') AS domain,
       SUM(occurrence_count)::int                         AS event_count,
       COUNT(DISTINCT video_id)::int                      AS affected_videos
     FROM broken_image_events
     WHERE resolved_at IS NULL
     GROUP BY domain
     ORDER BY event_count DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows.map(r => ({
    domain: r.domain,
    eventCount: parseInt(r.event_count),
    affectedVideos: parseInt(r.affected_videos),
  }))
}

/** 未补图视频列表（后台治理优先排队） */
// ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单扩展 4 子查询派生字段
// ADR-209 D-209-1/D-209-4（IMGH-P2-1D）：服务端筛选 + total 一致 + 行级数据契约
export type MissingVideoSortField =
  | 'created_at' | 'title' | 'poster_status'
  | 'poster_source' | 'broken_domain' | 'occurrence_count' | 'last_seen_broken_at'
export type SortDir = 'asc' | 'desc'

// ADR-209 D-209-1：服务端筛选条件（poster-only scope，与现状一致；backdrop/治理状态推导属 P3）
export interface MissingVideosFilters {
  search?: string         // (v.title ILIKE %x% OR v.short_id = x)，含 short_id 对齐 videos.ts 搜索口径
  posterStatus?: string   // mc.poster_status =（∈ missing/broken/pending_review，route 校验）
  posterSource?: string   // mc.poster_source =（∈ CatalogMetadataSource，route 校验）
  eventType?: string      // evt.event_type =（∈ 8 CHECK 值，route 校验；置外层 WHERE 使 LATERAL 等价 INNER）
  brokenDomain?: string   // SQL 派生域名 =（对齐 getTopBrokenDomains regexp_replace 口径）
}

// 内层 CTE 排序列（v./mc./evt. 原始别名）
const MISSING_VIDEO_SORT_SQL: Record<MissingVideoSortField, string> = {
  created_at:           'v.created_at',
  title:                'v.title',
  poster_status:        'mc.poster_status',
  poster_source:        'mc.poster_source',
  broken_domain:        'evt.url',            // domain 提取在 SQL / URL 排序近似域名（同主机邻近）
  occurrence_count:     'evt.occurrence_count',
  last_seen_broken_at:  'evt.last_seen_at',
}

// 外层（page CTE 之上）排序列：候选聚合在分页后做，须在外层重排（CTE 不保证行序）
const MISSING_VIDEO_SORT_OUTER: Record<MissingVideoSortField, string> = {
  created_at:           'page.created_at',
  title:                'page.title',
  poster_status:        'page.poster_status',
  poster_source:        'page.poster_source',
  broken_domain:        'page.broken_url',
  occurrence_count:     'page.occurrence_count',
  last_seen_broken_at:  'page.last_seen_at',
}

// page 与 count 共用的 FROM + LATERAL（**逐字相同**，防 total 漂移，D-209-1 §17.3.2）
// 注：media_catalog 历史字段名为 cover_url（poster_status / poster_source 等 048 新增字段独立）
const MISSING_VIDEOS_FROM = `
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     LEFT JOIN LATERAL (
       SELECT last_seen_at, url, occurrence_count, event_type
       FROM broken_image_events
       WHERE video_id = v.id
         AND image_kind = 'poster'
         AND resolved_at IS NULL
       ORDER BY last_seen_at DESC
       LIMIT 1
     ) evt ON TRUE`

/**
 * ADR-209 D-209-1：拼 WHERE + 参数，page 与 count 共用（禁两处各写，防 total 漂移）。
 * evt 谓词（eventType/brokenDomain）置外层 WHERE → LEFT JOIN LATERAL 等价 INNER（MEDIUM-1），
 * 自动滤除无未解决 poster 事件的 video；LATERAL LIMIT 1 保证每 video ≤1 行 evt，count 不膨胀。
 */
function buildMissingVideosFilter(
  filters: MissingVideosFilters | undefined,
  startIndex: number,
): { whereSql: string; params: unknown[] } {
  const clauses: string[] = [
    `v.deleted_at IS NULL`,
    `mc.poster_status IN ('missing','broken','pending_review')`,
  ]
  const params: unknown[] = []
  let i = startIndex
  if (filters?.search) {
    clauses.push(`(v.title ILIKE $${i} OR v.short_id = $${i + 1})`)
    params.push(`%${filters.search}%`, filters.search)
    i += 2
  }
  if (filters?.posterStatus) {
    clauses.push(`mc.poster_status = $${i}`)
    params.push(filters.posterStatus)
    i += 1
  }
  if (filters?.posterSource) {
    clauses.push(`mc.poster_source = $${i}`)
    params.push(filters.posterSource)
    i += 1
  }
  if (filters?.eventType) {
    clauses.push(`evt.event_type = $${i}`)
    params.push(filters.eventType)
    i += 1
  }
  if (filters?.brokenDomain) {
    clauses.push(`regexp_replace(evt.url, '^https?://([^/]+).*', '\\1') = $${i}`)
    params.push(filters.brokenDomain)
    i += 1
  }
  return { whereSql: clauses.join('\n       AND '), params }
}

export interface MissingVideoRow {
  videoId: string
  // ADR-209 D-209-4 BLOCK-3：行内携带 catalogId，供治理抽屉调 candidates/apply-candidate
  catalogId: string
  title: string
  posterStatus: string
  posterUrl: string | null
  posterSource: string | null
  lastSeenBrokenAt: string | null
  brokenDomain: string | null
  occurrenceCount: number
  // ADR-209 D-209-4：最近未解决 poster 事件类型（P1-3 推迟项，供 Lightbox 精确破损原因）
  eventType: string | null
  // ADR-209 D-209-4 BLOCK-4：跨源图片候选聚合（page CTE 上 LATERAL，避全量 N+1/死列）
  candidateCount: number
  hasHighConfidenceCandidate: boolean
}

export async function listMissingPosterVideos(
  db: Pool,
  limit = 20,
  offset = 0,
  sortField: MissingVideoSortField = 'created_at',
  sortDir: SortDir = 'desc',
  filters?: MissingVideosFilters,
): Promise<MissingVideoRow[]> {
  const orderInner = MISSING_VIDEO_SORT_SQL[sortField] ?? 'v.created_at'
  const orderOuter = MISSING_VIDEO_SORT_OUTER[sortField] ?? 'page.created_at'
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC'
  // page 查询 filter 从 $3 起（$1=limit / $2=offset）
  const { whereSql, params: filterParams } = buildMissingVideosFilter(filters, 3)

  // page CTE 先分页（≤limit 行），候选聚合仅在分页后的 ≤20 行上 LATERAL（Codex CONCERN：禁全量相关子查询）
  const result = await db.query<{
    id: string
    catalog_id: string
    title: string
    poster_status: string
    cover_url: string | null
    poster_source: string | null
    last_seen_broken_at: string | null
    broken_domain: string | null
    occurrence_count: string | null
    event_type: string | null
    candidate_count: number
    has_high_confidence: boolean
  }>(
    `WITH page AS (
       SELECT
         v.id, v.title, v.catalog_id, v.created_at,
         mc.poster_status, mc.cover_url, mc.poster_source,
         evt.last_seen_at, evt.url AS broken_url, evt.occurrence_count, evt.event_type
       ${MISSING_VIDEOS_FROM}
       WHERE ${whereSql}
       ORDER BY ${orderInner} ${dir} NULLS LAST
       LIMIT $1 OFFSET $2
     )
     SELECT
       page.id,
       page.catalog_id,
       page.title,
       page.poster_status,
       page.cover_url,
       page.poster_source,
       page.last_seen_at::text AS last_seen_broken_at,
       regexp_replace(page.broken_url, '^https?://([^/]+).*', '\\1') AS broken_domain,
       page.occurrence_count,
       page.event_type,
       COALESCE(c.candidate_count, 0) AS candidate_count,
       COALESCE(c.has_winner, false)  AS has_high_confidence
     FROM page
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS candidate_count, bool_or(is_winner) AS has_winner
       FROM metadata_field_proposals
       WHERE catalog_id = page.catalog_id
         AND field_name IN ('coverUrl','backdropUrl','logoUrl')
     ) c ON TRUE
     ORDER BY ${orderOuter} ${dir} NULLS LAST`,
    [limit, offset, ...filterParams],
  )
  return result.rows.map(r => ({
    videoId: r.id,
    catalogId: r.catalog_id,
    title: r.title,
    posterStatus: r.poster_status,
    posterUrl: r.cover_url,
    posterSource: r.poster_source,
    lastSeenBrokenAt: r.last_seen_broken_at,
    brokenDomain: r.broken_domain,
    occurrenceCount: r.occurrence_count ? parseInt(r.occurrence_count, 10) : 0,
    eventType: r.event_type,
    candidateCount: r.candidate_count,
    hasHighConfidenceCandidate: r.has_high_confidence,
  }))
}

/**
 * ADR-209 D-209-1：missing-videos 筛选后总数。与 listMissingPosterVideos **共用** FROM+LATERAL+WHERE
 * （buildMissingVideosFilter），保证分页 total 与筛选结果一致（§17.3.2 硬约束）。
 */
export async function countMissingPosterVideos(
  db: Pool,
  filters?: MissingVideosFilters,
): Promise<number> {
  // count 查询无 limit/offset，filter 从 $1 起
  const { whereSql, params } = buildMissingVideosFilter(filters, 1)
  const result = await db.query<{ total: string }>(
    `SELECT COUNT(v.id)::int AS total
     ${MISSING_VIDEOS_FROM}
     WHERE ${whereSql}`,
    params,
  )
  return parseInt(result.rows[0]?.total ?? '0', 10)
}

// ── 查询：待检图 URL 批量读取（供 imageHealthWorker / imageBlurhashWorker 使用）────

export interface PendingImageRow {
  catalogId: string
  videoId: string
  kind: 'poster' | 'backdrop' | 'logo' | 'banner_backdrop'
  url: string
}

/**
 * 读取 media_catalog 中状态为 pending_review 的图片 URL，批量供 worker 消费。
 * 返回最多 limit 条，按 url 升序。
 * ADR-209 D-209-3：可选 `catalogIds` 过滤——非空时仅返回选中 catalog 的 pending 行
 * （scoped 入队，禁全局副作用）；为空/省略时维持全库扫描（backfill worker 既有语义）。
 */
export async function listPendingImageUrls(
  db: Pool,
  limit = 100,
  offset = 0,
  catalogIds?: string[],
): Promise<PendingImageRow[]> {
  const scoped = catalogIds != null && catalogIds.length > 0
  // 4 个 UNION 分支共用同一 $3 过滤谓词（Postgres 允许复用位置参数）
  const catalogFilter = scoped ? 'AND mc.id = ANY($3::uuid[])' : ''
  const params: unknown[] = scoped ? [limit, offset, catalogIds] : [limit, offset]
  const result = await db.query<{
    catalog_id: string
    video_id: string
    kind: string
    url: string
  }>(
    `SELECT
       mc.id        AS catalog_id,
       v.id         AS video_id,
       'poster'     AS kind,
       mc.cover_url AS url
     FROM media_catalog mc
     JOIN videos v ON v.catalog_id = mc.id
     WHERE mc.cover_url IS NOT NULL
       AND mc.poster_status = 'pending_review'
       AND v.deleted_at IS NULL
       ${catalogFilter}
     UNION ALL
     SELECT
       mc.id           AS catalog_id,
       v.id            AS video_id,
       'backdrop'      AS kind,
       mc.backdrop_url AS url
     FROM media_catalog mc
     JOIN videos v ON v.catalog_id = mc.id
     WHERE mc.backdrop_url IS NOT NULL
       AND mc.backdrop_status = 'pending_review'
       AND v.deleted_at IS NULL
       ${catalogFilter}
     UNION ALL
     SELECT
       mc.id      AS catalog_id,
       v.id       AS video_id,
       'logo'     AS kind,
       mc.logo_url AS url
     FROM media_catalog mc
     JOIN videos v ON v.catalog_id = mc.id
     WHERE mc.logo_url IS NOT NULL
       AND mc.logo_status = 'pending_review'
       AND v.deleted_at IS NULL
       ${catalogFilter}
     UNION ALL
     SELECT
       mc.id                   AS catalog_id,
       v.id                    AS video_id,
       'banner_backdrop'       AS kind,
       mc.banner_backdrop_url  AS url
     FROM media_catalog mc
     JOIN videos v ON v.catalog_id = mc.id
     WHERE mc.banner_backdrop_url IS NOT NULL
       AND mc.banner_backdrop_status = 'pending_review'
       AND v.deleted_at IS NULL
       ${catalogFilter}
     ORDER BY url
     LIMIT $1 OFFSET $2`,
    params,
  )
  return result.rows.map(r => ({
    catalogId: r.catalog_id,
    videoId: r.video_id,
    kind: r.kind as PendingImageRow['kind'],
    url: r.url,
  }))
}

/**
 * 读取 media_catalog 中 blurhash 为空但 URL 有效的图片，供 imageBlurhashWorker 消费。
 */
export async function listMissingBlurhashUrls(
  db: Pool,
  limit = 100,
  offset = 0
): Promise<PendingImageRow[]> {
  const result = await db.query<{
    catalog_id: string
    video_id: string
    kind: string
    url: string
  }>(
    `SELECT
       mc.id        AS catalog_id,
       v.id         AS video_id,
       'poster'     AS kind,
       mc.cover_url AS url
     FROM media_catalog mc
     JOIN videos v ON v.catalog_id = mc.id
     WHERE mc.cover_url IS NOT NULL
       AND mc.poster_blurhash IS NULL
       AND mc.poster_status = 'ok'
       AND v.deleted_at IS NULL
     UNION ALL
     SELECT
       mc.id           AS catalog_id,
       v.id            AS video_id,
       'backdrop'      AS kind,
       mc.backdrop_url AS url
     FROM media_catalog mc
     JOIN videos v ON v.catalog_id = mc.id
     WHERE mc.backdrop_url IS NOT NULL
       AND mc.backdrop_blurhash IS NULL
       AND mc.backdrop_status = 'ok'
       AND v.deleted_at IS NULL
     UNION ALL
     SELECT
       mc.id                   AS catalog_id,
       v.id                    AS video_id,
       'banner_backdrop'       AS kind,
       mc.banner_backdrop_url  AS url
     FROM media_catalog mc
     JOIN videos v ON v.catalog_id = mc.id
     WHERE mc.banner_backdrop_url IS NOT NULL
       AND mc.banner_backdrop_blurhash IS NULL
       AND mc.banner_backdrop_status = 'ok'
       AND v.deleted_at IS NULL
     ORDER BY url
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return result.rows.map(r => ({
    catalogId: r.catalog_id,
    videoId: r.video_id,
    kind: r.kind as PendingImageRow['kind'],
    url: r.url,
  }))
}

// ── 重扫 / 趋势 / 切换域 / 事件解决（已迁至 imageHealth.scan.ts）────
export type { BrokenTrendPoint, RescanScope, RescanPostersResult, SwitchFallbackDomainResult } from './imageHealth.scan'
export {
  getBrokenEventsTrend,
  rescanPosters,
  switchFallbackDomain,
  resolveImageEvents,
  // ADR-209 D-209-3：ids 精确重扫 scoped 闭环
  getCatalogIdsByVideoIds,
  rescanPostersByCatalogIds,
} from './imageHealth.scan'
