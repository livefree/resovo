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

  const result = await db.query<DbSourceRow>(
    `SELECT * FROM video_sources
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at ASC`,
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

// ── 更新：替换源 URL（CHG-202）───────────────────────────────────

/**
 * 替换失效源的 URL，同时重置为活跃状态。
 */
export async function updateSourceUrl(
  db: Pool,
  sourceId: string,
  newUrl: string
): Promise<{ id: string; source_url: string; is_active: boolean } | null> {
  const result = await db.query<{
    id: string; source_url: string; is_active: boolean
  }>(
    `UPDATE video_sources
     SET source_url = $1,
         is_active = true,
         last_checked = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, source_url, is_active`,
    [newUrl, sourceId]
  )
  return result.rows[0] ?? null
}

// ── 写入：Upsert 播放源（爬虫采集用）──────────────────────────────

export interface UpsertSourceInput {
  videoId: string
  episodeNumber: number  // ADR-016: 统一坐标系，单集/电影为 1
  seasonNumber?: number  // 默认 1
  sourceUrl: string      // ADR-001: 第三方直链，不做代理
  sourceName: string
  type: SourceType
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
       (video_id, season_number, episode_number, source_url, source_name, type, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT ON CONSTRAINT uq_sources_video_episode_url
     DO NOTHING
     RETURNING *`,
    [input.videoId, input.seasonNumber ?? 1, input.episodeNumber, input.sourceUrl, input.sourceName, input.type]
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

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit

  const [rows, countResult] = await Promise.all([
    db.query(
      `SELECT s.*, v.title AS video_title
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       WHERE ${where}
       ORDER BY s.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM video_sources s WHERE ${where}`,
      params
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
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

export async function listSubmissions(
  db: Pool,
  page: number,
  limit: number
): Promise<{ rows: unknown[]; total: number }> {
  const offset = (page - 1) * limit

  const [rows, countResult] = await Promise.all([
    db.query(
      `SELECT s.*, v.title AS video_title, u.username AS submitted_by_username
       FROM video_sources s
       LEFT JOIN videos v ON s.video_id = v.id
       LEFT JOIN users u ON s.submitted_by = u.id::text
       WHERE s.is_active = false AND s.submitted_by IS NOT NULL AND s.deleted_at IS NULL
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM video_sources WHERE is_active = false AND submitted_by IS NOT NULL AND deleted_at IS NULL`
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
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
