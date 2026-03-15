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
  episode_number: number | null
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

// ── 写入：Upsert 播放源（爬虫采集用）──────────────────────────────

export interface UpsertSourceInput {
  videoId: string
  episodeNumber: number | null
  sourceUrl: string              // ADR-001: 第三方直链，不做代理
  sourceName: string
  type: SourceType
}

/**
 * 播放源去重 upsert：
 * 同一 (video_id, source_url) 已存在时更新 source_name 和 last_checked，
 * 不存在时插入新记录（is_active=true）。
 */
export async function upsertSource(
  db: Pool,
  input: UpsertSourceInput
): Promise<VideoSource> {
  const result = await db.query<DbSourceRow>(
    `INSERT INTO video_sources
       (video_id, episode_number, source_url, source_name, type, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (video_id, source_url)
     DO UPDATE SET
       source_name = EXCLUDED.source_name,
       is_active = true,
       last_checked = NOW()
     RETURNING *`,
    [input.videoId, input.episodeNumber, input.sourceUrl, input.sourceName, input.type]
  )
  return mapSource(result.rows[0])
}

/** 批量 upsert 播放源（爬虫采集后批量写入） */
export async function upsertSources(
  db: Pool,
  inputs: UpsertSourceInput[]
): Promise<number> {
  if (inputs.length === 0) return 0
  let count = 0
  for (const input of inputs) {
    await upsertSource(db, input)
    count++
  }
  return count
}
