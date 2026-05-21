/**
 * sources.ts — 播放源表 DB 查询
 * ADR-001: source_url 是直链，不做代理
 * 维护函数迁至 sources.maintenance.ts（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import type { VideoSource, VideoQuality, SourceType } from '@/types'
import type { UpsertSourceInput } from './sources.types'

export type { UpsertSourceInput } from './sources.types'
export type {
  ListSubmissionsFilter,
  ExportedSource,
  ReplaceSourcesStats,
  IslandVideo,
  SourceHealthEventInput,
  OrphanVideoRow,
} from './sources.maintenance'
export {
  listSubmissions, batchApproveSubmissions, batchRejectSubmissions,
  approveSubmission, rejectSubmission,
  exportAllSources,
  replaceSourcesForSite,
  listIslandVideos, insertSourceHealthEvent,
  listOrphanVideos, resolveOrphanVideo,
  replaceSourceUrl,
} from './sources.maintenance'

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
  const orderBy = `${orderByColumn} ${orderByDir}${nullsClause}, s.created_at DESC, s.id ASC`

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

