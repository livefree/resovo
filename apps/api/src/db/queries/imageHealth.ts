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
export async function listMissingPosterVideos(
  db: Pool,
  limit = 20,
  offset = 0
): Promise<{ videoId: string; title: string; posterStatus: string }[]> {
  const result = await db.query<{
    id: string
    title: string
    poster_status: string
  }>(
    `SELECT v.id, v.title, mc.poster_status
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE v.deleted_at IS NULL
       AND mc.poster_status IN ('missing','broken','pending_review')
     ORDER BY v.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return result.rows.map(r => ({
    videoId: r.id,
    title: r.title,
    posterStatus: r.poster_status,
  }))
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
 * 返回最多 limit 条，按 media_catalog.updated_at 升序（最旧优先）。
 */
export async function listPendingImageUrls(
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
       AND mc.poster_status = 'pending_review'
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
       AND mc.backdrop_status = 'pending_review'
       AND v.deleted_at IS NULL
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

/** 标记事件为已处理 */
export async function resolveImageEvents(
  db: Pool | PoolClient,
  ids: string[],
  note?: string
): Promise<void> {
  if (ids.length === 0) return
  await db.query(
    `UPDATE broken_image_events
     SET resolved_at = NOW(), resolution_note = $1
     WHERE id = ANY($2::uuid[])`,
    [note ?? null, ids]
  )
}
