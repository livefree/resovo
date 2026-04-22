/**
 * sources.ts — 播放源表 DB 查询
 * ADR-001: source_url 是直链，不做代理
 */

import type { Pool } from 'pg'
import type { VideoSource, VideoQuality, SourceType } from '@/types'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbSourceRow {
  id: string
  video_id: string
  season_number: number
  episode_number: number
  source_url: string
  source_name: string
  /** CHG-413: JOIN videos v→crawler_sites cs via v.site_key（正确关联路径）*/
  site_display_name: string | null
  quality: string | null
  type: string
  is_active: boolean
  submitted_by: string | null
  last_checked: string | null
  deleted_at: string | null
  created_at: string
}

function mapSource(row: DbSourceRow): VideoSource {
  return {
    id: row.id,
    videoId: row.video_id,
    episodeNumber: row.episode_number,
    sourceUrl: row.source_url, // ADR-001: 直链，不做代理
    sourceName: row.source_name,
    siteDisplayName: row.site_display_name ?? null,
    quality: (row.quality as VideoQuality) ?? null,
    type: row.type as SourceType,
    isActive: row.is_active,
    lastChecked: row.last_checked,
  }
}

// ── 查询：按 videoId + episode 获取活跃播放源 ─────────────────────

export async function findActiveSourcesByVideoId(
  db: Pool,
  videoId: string,
  episode?: number
): Promise<VideoSource[]> {
  const conditions = [
    'video_id = $1',
    'is_active = true',
    'deleted_at IS NULL',
  ]
  const params: unknown[] = [videoId]
  let idx = 2

  if (episode !== undefined) {
    conditions.push(`episode_number = $${idx++}`)
    params.push(episode)
  }

  // CHG-413/414: JOIN 路径优先用行级 vs.source_site_key，NULL 时 fallback 到 v.site_key
  const result = await db.query<DbSourceRow>(
    `SELECT vs.id, vs.video_id, vs.season_number, vs.episode_number,
            vs.source_url, vs.source_name, vs.quality, vs.type,
            vs.is_active, vs.submitted_by, vs.last_checked,
            vs.deleted_at, vs.created_at,
            cs.display_name AS site_display_name
     FROM video_sources vs
     JOIN videos v ON v.id = vs.video_id
     LEFT JOIN crawler_sites cs ON cs.key = COALESCE(vs.source_site_key, v.site_key)
     WHERE ${conditions.map((c) => `vs.${c}`).join(' AND ')}
     ORDER BY vs.created_at ASC`,
    params
  )
  return result.rows.map(mapSource)
}

// ── 查询：按 videoId 获取所有源 ID（用于举报验证）─────────────────

export async function findSourceById(
  db: Pool,
  sourceId: string
): Promise<VideoSource | null> {
  const result = await db.query<DbSourceRow>(
    `SELECT * FROM video_sources
     WHERE id = $1 AND deleted_at IS NULL`,
    [sourceId]
  )
  return result.rows[0] ? mapSource(result.rows[0]) : null
}

export type AdminSourceVerifyScope = 'video' | 'site' | 'video_site'

export interface AdminSourceBatchVerifyFilters {
  scope: AdminSourceVerifyScope
  videoId?: string
  siteKey?: string
  activeOnly?: boolean
  limit?: number
}

export interface AdminSourceVerifyCandidate {
  id: string
  source_url: string
}

export async function listSourcesForBatchVerify(
  db: Pool,
  filters: AdminSourceBatchVerifyFilters,
): Promise<AdminSourceVerifyCandidate[]> {
  const conditions = [
    's.deleted_at IS NULL',
    's.submitted_by IS NULL',
    'v.deleted_at IS NULL',
  ]
  const params: unknown[] = []
  let idx = 1

  if (filters.activeOnly ?? true) {
    conditions.push('s.is_active = true')
  }

  if (filters.scope === 'video') {
    if (!filters.videoId) return []
    conditions.push(`s.video_id = $${idx++}`)
    params.push(filters.videoId)
  } else if (filters.scope === 'site') {
    if (!filters.siteKey) return []
    conditions.push(`v.site_key = $${idx++}`)
    params.push(filters.siteKey)
  } else {
    if (!filters.videoId || !filters.siteKey) return []
    conditions.push(`s.video_id = $${idx++}`)
    params.push(filters.videoId)
    conditions.push(`v.site_key = $${idx++}`)
    params.push(filters.siteKey)
  }

  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500))
  params.push(limit)

  const where = conditions.join(' AND ')
  const result = await db.query<AdminSourceVerifyCandidate>(
    `SELECT s.id, s.source_url
     FROM video_sources s
     JOIN videos v ON s.video_id = v.id
     WHERE ${where}
     ORDER BY s.last_checked ASC NULLS FIRST, s.created_at ASC
     LIMIT $${idx}`,
    params,
  )

  return result.rows
}

// ── 写入：更新活跃状态（用于验证服务）───────────────────────────

export async function updateSourceActiveStatus(
  db: Pool,
  sourceId: string,
  isActive: boolean
): Promise<void> {
  await db.query(
    `UPDATE video_sources
     SET is_active = $1, last_checked = NOW()
     WHERE id = $2`,
    [isActive, sourceId]
  )
}

export async function setSourceStatus(
  db: Pool,
  sourceId: string,
  isActive: boolean,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources
     SET is_active = $1, last_checked = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [isActive, sourceId],
  )
  return (result.rowCount ?? 0) > 0
}

export async function batchSetSourceStatus(
  db: Pool,
  ids: string[],
  isActive: boolean,
): Promise<number> {
  if (ids.length === 0) return 0
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources
     SET is_active = $1, last_checked = NOW()
     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    [isActive, ...ids],
  )
  return result.rowCount ?? 0
}

// ── 写入：Upsert 播放源（爬虫采集用）──────────────────────────────

export interface UpsertSourceInput {
  videoId: string
  episodeNumber: number  // ADR-016: 统一坐标系，单集/电影为 1
  seasonNumber?: number  // 默认 1
  sourceUrl: string      // ADR-001: 第三方直链，不做代理
  sourceName: string
  type: SourceType
  sourceSiteKey?: string | null  // CHG-414: 行级源站 key，优先于 videos.site_key
}

/**
 * 播放源去重 upsert：
 * 同一 (video_id, episode_number, source_url) 已存在时跳过（DO NOTHING）。
 * 规则 E(CHG-38): 不覆盖已有播放源，避免误清除 is_active=false 状态。
 * ADR-016: episode_number 统一坐标系，单集/电影为 1（NOT NULL）。
 */
export async function upsertSource(
  db: Pool,
  input: UpsertSourceInput
): Promise<VideoSource | null> {
  const result = await db.query<DbSourceRow>(
    `INSERT INTO video_sources
       (video_id, season_number, episode_number, source_url, source_name, type, is_active, source_site_key)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7)
     ON CONFLICT ON CONSTRAINT uq_sources_video_episode_url
     DO NOTHING
     RETURNING *`,
    [input.videoId, input.seasonNumber ?? 1, input.episodeNumber, input.sourceUrl, input.sourceName, input.type, input.sourceSiteKey ?? null]
  )
  return result.rows[0] ? mapSource(result.rows[0]) : null
}

/** 批量 upsert 播放源（爬虫采集后批量写入）。返回实际插入数量（跳过的不计入）。 */
export async function upsertSources(
  db: Pool,
  inputs: UpsertSourceInput[]
): Promise<number> {
  if (inputs.length === 0) return 0
  let count = 0
  for (const input of inputs) {
    const inserted = await upsertSource(db, input)
    if (inserted !== null) count++
  }
  return count
}

// ── Admin 查询 ────────────────────────────────────────────────────

export interface AdminSourceListFilters {
  active?: 'true' | 'false' | 'all'
  videoId?: string
  keyword?: string
  title?: string
  siteKey?: string
  sortField?: 'created_at' | 'last_checked' | 'is_active' | 'video_title' | 'source_url' | 'site_key'
  sortDir?: 'asc' | 'desc'
  page: number
  limit: number
}

export async function listAdminSources(
  db: Pool,
  filters: AdminSourceListFilters
): Promise<{ rows: unknown[]; total: number }> {
  const conditions = ['s.deleted_at IS NULL', 's.submitted_by IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (filters.active === 'true') {
    conditions.push('s.is_active = true')
  } else if (filters.active === 'false') {
    conditions.push('s.is_active = false')
  }
  if (filters.videoId) {
    conditions.push(`s.video_id = $${idx++}`)
    params.push(filters.videoId)
  }
  if (filters.keyword) {
    conditions.push(`(s.source_url ILIKE $${idx} OR s.source_name ILIKE $${idx} OR v.title ILIKE $${idx})`)
    params.push(`%${filters.keyword}%`)
    idx += 1
  }
  if (filters.title) {
    conditions.push(`v.title ILIKE $${idx++}`)
    params.push(`%${filters.title}%`)
  }
  if (filters.siteKey) {
    // ADMIN-13: 切到行级 source_site_key，回落 v.site_key 保留历史兼容
    conditions.push(`COALESCE(s.source_site_key, v.site_key) = $${idx++}`)
    params.push(filters.siteKey)
  }

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit
  const ORDER_BY_MAP: Record<NonNullable<AdminSourceListFilters['sortField']>, string> = {
    created_at: 's.created_at',
    last_checked: 's.last_checked',
    is_active: 's.is_active',
    video_title: 'v.title',
    source_url: 's.source_url',
    site_key: 'COALESCE(s.source_site_key, v.site_key)',  // ADMIN-13: 行级优先
  }
  const orderByColumn = filters.sortField ? ORDER_BY_MAP[filters.sortField] : 's.created_at'
  const orderByDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC'
  const nullsClause = filters.sortField === 'last_checked' ? ' NULLS LAST' : ''
  const orderBy = `${orderByColumn} ${orderByDir}${nullsClause}, s.created_at DESC`

  const [rows, countResult] = await Promise.all([
    db.query(
      // ADMIN-13: 返回字段 site_key 改为行级 COALESCE（跨站聚合视频显示各行实际站点）
      `SELECT s.*, v.title AS video_title,
              COALESCE(s.source_site_key, v.site_key) AS site_key
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       WHERE ${where}`,
      params
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function countShellVideos(
  db: Pool,
): Promise<{ count: number; videoIds: string[] }> {
  const result = await db.query<{ id: string }>(
    `SELECT v.id
     FROM videos v
     WHERE v.deleted_at IS NULL
       AND v.is_published = true
       AND EXISTS (
         SELECT 1
         FROM video_sources s
         WHERE s.video_id = v.id
           AND s.deleted_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1
         FROM video_sources s
         WHERE s.video_id = v.id
           AND s.deleted_at IS NULL
           AND s.is_active = true
       )
     ORDER BY v.updated_at DESC`
  )

  return {
    count: result.rows.length,
    videoIds: result.rows.map((row) => row.id),
  }
}

export async function deleteSource(
  db: Pool,
  id: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

export async function batchDeleteSources(
  db: Pool,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW() WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    ids
  )
  return result.rowCount ?? 0
}

const SUBMISSION_SORT_COLUMNS: Record<string, string> = {
  video: 'v.title',
  source_url: 's.source_url',
  submitted_by: 'u.username',
  created_at: 's.created_at',
}

export interface ListSubmissionsFilter {
  videoType?: string
  siteKey?: string
}

export async function listSubmissions(
  db: Pool,
  page: number,
  limit: number,
  sortField?: string,
  sortDir?: 'asc' | 'desc',
  filter?: ListSubmissionsFilter
): Promise<{ rows: unknown[]; total: number }> {
  const offset = (page - 1) * limit
  const validCol = sortField ? SUBMISSION_SORT_COLUMNS[sortField] : undefined
  const orderCol = validCol ?? 's.created_at'
  const orderDir = (validCol && sortDir === 'asc') ? 'ASC' : 'DESC'

  const whereClauses: string[] = [
    's.is_active = false',
    's.submitted_by IS NOT NULL',
    's.deleted_at IS NULL',
  ]
  const filterParams: unknown[] = []

  if (filter?.videoType) {
    filterParams.push(filter.videoType)
    whereClauses.push(`v.type = $${filterParams.length}`)
  }
  if (filter?.siteKey) {
    filterParams.push(filter.siteKey)
    whereClauses.push(`v.site_key = $${filterParams.length}`)
  }

  const whereSQL = whereClauses.join(' AND ')
  const listParams = [...filterParams, limit, offset]
  const countParams = [...filterParams]

  const [rows, countResult] = await Promise.all([
    db.query(
      `SELECT s.*, v.title AS video_title, v.type AS video_type, v.site_key AS video_site_key,
              u.username AS submitted_by_username
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       LEFT JOIN users u ON s.submitted_by = u.id::text
       WHERE ${whereSQL}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      listParams
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       WHERE ${whereSQL}`,
      countParams
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function batchApproveSubmissions(
  db: Pool,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources SET is_active = true, last_checked = NOW()
     WHERE id IN (${placeholders}) AND is_active = false AND deleted_at IS NULL`,
    ids
  )
  return result.rowCount ?? 0
}

export async function batchRejectSubmissions(
  db: Pool,
  ids: string[],
  reason?: string
): Promise<number> {
  if (ids.length === 0) return 0
  const reasonVal = reason ?? null
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW(), rejection_reason = $1
     WHERE id IN (${placeholders}) AND is_active = false AND deleted_at IS NULL`,
    [reasonVal, ...ids]
  )
  return result.rowCount ?? 0
}

export async function approveSubmission(
  db: Pool,
  id: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources SET is_active = true, last_checked = NOW()
     WHERE id = $1 AND is_active = false AND deleted_at IS NULL
     RETURNING id`,
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

export async function rejectSubmission(
  db: Pool,
  id: string,
  reason?: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources SET deleted_at = NOW(), rejection_reason = $2
     WHERE id = $1 AND is_active = false AND deleted_at IS NULL
     RETURNING id`,
    [id, reason ?? null]
  )
  return (result.rowCount ?? 0) > 0
}

// ── Admin 导出 ────────────────────────────────────────────────────

export interface ExportedSource {
  shortId: string
  sourceName: string
  sourceUrl: string
  isActive: boolean
  type: string
  episodeNumber: number | null
}

/**
 * 导出所有非删除的播放源（不含用户投稿，只含爬虫抓取/手动添加的源）
 */
export async function exportAllSources(db: Pool): Promise<ExportedSource[]> {
  const result = await db.query<{
    short_id: string
    source_name: string
    source_url: string
    is_active: boolean
    type: string
    episode_number: number | null
  }>(
    `SELECT v.short_id, s.source_name, s.source_url, s.is_active, s.type, s.episode_number
     FROM video_sources s
     JOIN videos v ON s.video_id = v.id
     WHERE s.deleted_at IS NULL
       AND s.submitted_by IS NULL
       AND v.deleted_at IS NULL
     ORDER BY s.created_at DESC`
  )

  return result.rows.map((row) => ({
    shortId: row.short_id,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    isActive: row.is_active,
    type: row.type,
    episodeNumber: row.episode_number,
  }))
}

// ── 全量替换策略（CRAWLER-02）─────────────────────────────────────

export interface ReplaceSourcesStats {
  sourcesAdded: number
  sourcesKept: number
  sourcesRemoved: number
}

/**
 * CRAWLER-02 / CRAWLER-05: 同站点全量替换策略
 *
 * 1. 查询指定 videoId + siteKey 的现有活跃源 URL
 *    - 行级 source_site_key 优先；历史数据（migration 046 之前）回落到 videos.site_key（COALESCE）
 *    - 注意：不再使用 source_name 匹配（source_name 是线路名如"线路1"，不是站点 key）
 * 2. 软删除不在新列表中的旧源
 * 3. 插入不在旧列表中的新源
 *
 * 返回 sourcesAdded / sourcesKept / sourcesRemoved 统计
 */
export async function replaceSourcesForSite(
  db: Pool,
  videoId: string,
  siteKey: string,
  newSources: UpsertSourceInput[]
): Promise<ReplaceSourcesStats> {
  const client = await (db as import('pg').Pool).connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query<{ id: string; source_url: string }>(
      `SELECT s.id, s.source_url
         FROM video_sources s
         LEFT JOIN videos v ON s.video_id = v.id
         WHERE s.video_id = $1
           AND COALESCE(s.source_site_key, v.site_key) = $2
           AND s.deleted_at IS NULL`,
      [videoId, siteKey],
    )

    const existingUrls = new Set(existing.rows.map((r) => r.source_url))
    const newUrls = new Set(newSources.map((s) => s.sourceUrl))

    // 软删除不再出现的旧源
    const toRemoveIds = existing.rows
      .filter((r) => !newUrls.has(r.source_url))
      .map((r) => r.id)

    let sourcesRemoved = 0
    if (toRemoveIds.length > 0) {
      const placeholders = toRemoveIds.map((_, i) => `$${i + 1}`).join(', ')
      const result = await client.query(
        `UPDATE video_sources SET deleted_at = NOW() WHERE id IN (${placeholders})`,
        toRemoveIds,
      )
      sourcesRemoved = result.rowCount ?? 0
    }

    // 插入新增的源（包含恢复曾被软删除的同 URL 行）
    let sourcesAdded = 0
    let sourcesKept = 0
    for (const src of newSources) {
      if (existingUrls.has(src.sourceUrl)) {
        sourcesKept++
        continue
      }
      // ON CONFLICT DO UPDATE 同时覆盖软删除行（恢复 deleted_at=NULL, is_active=true）
      const insertResult = await client.query(
        `INSERT INTO video_sources
           (video_id, season_number, episode_number, source_url, source_name, type, is_active, source_site_key)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         ON CONFLICT ON CONSTRAINT uq_sources_video_episode_url
         DO UPDATE SET deleted_at = NULL, is_active = true,
                       source_name = EXCLUDED.source_name,
                       type = EXCLUDED.type,
                       source_site_key = EXCLUDED.source_site_key`,
        [videoId, src.seasonNumber ?? 1, src.episodeNumber, src.sourceUrl, src.sourceName, src.type, src.sourceSiteKey ?? null],
      )
      sourcesAdded += insertResult.rowCount ?? 0
    }

    await client.query('COMMIT')
    return { sourcesAdded, sourcesKept, sourcesRemoved }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── CHG-388: 孤岛视频查询 + source_health_events ─────────────────

export interface IslandVideo {
  id: string
  title: string
  siteKey: string | null
  reviewStatus: string
  visibilityStatus: string
  isPublished: boolean
  sourceCheckStatus: string
}

/**
 * 查询"孤岛视频"：is_published=true 且所有活跃源均已失效（source_check_status='all_dead'）
 * 用于 verify-published-sources Job 自动下架 + 触发补源
 */
export async function listIslandVideos(
  db: Pool,
  limit = 50,
): Promise<IslandVideo[]> {
  const result = await db.query<{
    id: string
    title: string
    site_key: string | null
    review_status: string
    visibility_status: string
    is_published: boolean
    source_check_status: string
  }>(
    `SELECT v.id, v.title, v.site_key,
            v.review_status, v.visibility_status, v.is_published, v.source_check_status
     FROM videos v
     WHERE v.is_published = true
       AND v.source_check_status = 'all_dead'
       AND v.deleted_at IS NULL
     ORDER BY v.updated_at ASC
     LIMIT $1`,
    [limit],
  )
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    siteKey: r.site_key,
    reviewStatus: r.review_status,
    visibilityStatus: r.visibility_status,
    isPublished: r.is_published,
    sourceCheckStatus: r.source_check_status,
  }))
}

export interface SourceHealthEventInput {
  videoId: string
  origin: 'island_detected' | 'auto_refetch_success' | 'auto_refetch_failed'
  oldStatus?: string | null
  newStatus?: string | null
  triggeredBy?: string
}

export async function insertSourceHealthEvent(
  db: Pool,
  input: SourceHealthEventInput,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO source_health_events
       (video_id, origin, old_status, new_status, triggered_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.videoId,
      input.origin,
      input.oldStatus ?? null,
      input.newStatus ?? null,
      input.triggeredBy ?? 'maintenance_worker',
    ],
  )
  return result.rows[0].id
}

// ── ADMIN-12: 孤岛视频查询（最新事件为 auto_refetch_failed）────────

export interface OrphanVideoRow {
  id: string
  title: string
  siteKey: string | null
  sourceCheckStatus: string
  lastEventOrigin: string
  lastEventAt: string
}

/**
 * 查询孤岛视频：source_health_events 中最新事件为 auto_refetch_failed 且
 * 尚无 manually_resolved 事件的视频（需要人工处理）
 */
export async function listOrphanVideos(
  db: Pool,
  limit = 50,
): Promise<OrphanVideoRow[]> {
  const result = await db.query<{
    id: string
    title: string
    site_key: string | null
    source_check_status: string
    last_event_origin: string
    last_event_at: string
  }>(
    `WITH latest_events AS (
       SELECT DISTINCT ON (video_id)
         video_id, origin, created_at
       FROM source_health_events
       ORDER BY video_id, created_at DESC
     )
     SELECT v.id, v.title, v.site_key, v.source_check_status,
            le.origin AS last_event_origin,
            le.created_at AS last_event_at
     FROM videos v
     JOIN latest_events le ON le.video_id = v.id
     WHERE le.origin = 'auto_refetch_failed'
       AND v.deleted_at IS NULL
     ORDER BY le.created_at DESC
     LIMIT $1`,
    [limit],
  )
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    siteKey: r.site_key,
    sourceCheckStatus: r.source_check_status,
    lastEventOrigin: r.last_event_origin,
    lastEventAt: r.last_event_at,
  }))
}

/**
 * 标记孤岛视频已处理：写入 manually_resolved 事件
 */
export async function resolveOrphanVideo(
  db: Pool,
  videoId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO source_health_events (video_id, origin, triggered_by)
     VALUES ($1, 'manually_resolved', 'admin')`,
    [videoId],
  )
}

/**
 * 替换播放源 URL（用于 SourceReplaceDialog 确认替换）
 */
export async function replaceSourceUrl(
  db: Pool,
  sourceId: string,
  newUrl: string,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE video_sources
     SET source_url = $1, is_active = true, last_checked = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [newUrl, sourceId],
  )
  return (result.rowCount ?? 0) > 0
}
