/**
 * video_sources.ts — video_sources admin 写操作 queries
 * CHG-SN-4-05: toggle(is_active) / disable-dead 批量禁用
 * CHG-SN-5-PRE-01-C: toggleVideoSource 乐观锁（DEBT-SN-4-05-A）
 *
 * 写路径同时维护 updated_at（乐观锁版本字段，Migration 061）；
 * probe 后台路径只写 last_checked / probe_status，不触发 updated_at。
 */

import type { Pool, PoolClient } from 'pg'
import type { VideoSourceLine } from '@resovo/types'
import { AppError } from '@/api/lib/errors'

interface DbVideoSourceLineRow {
  id: string
  video_id: string
  episode_number: number | null
  source_url: string
  source_name: string
  source_site_key: string | null
  user_label: string | null
  display_name: string | null
  type: string
  quality: string | null
  is_active: boolean
  probe_status: string
  render_status: string
  latency_ms: number | null
  last_probed_at: string | null
  last_rendered_at: string | null
  quality_detected: string | null
  quality_source: string
  resolution_width: number | null
  resolution_height: number | null
  detected_at: string | null
  last_checked: string | null
  submitted_by: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: DbVideoSourceLineRow): VideoSourceLine {
  return {
    id: row.id,
    videoId: row.video_id,
    episodeNumber: row.episode_number,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    sourceSiteKey: row.source_site_key,
    userLabel: row.user_label,
    displayName: row.display_name,
    type: row.type as VideoSourceLine['type'],
    quality: (row.quality as VideoSourceLine['quality']) ?? null,
    isActive: row.is_active,
    probeStatus: row.probe_status as VideoSourceLine['probeStatus'],
    renderStatus: row.render_status as VideoSourceLine['renderStatus'],
    latencyMs: row.latency_ms,
    lastProbedAt: row.last_probed_at,
    lastRenderedAt: row.last_rendered_at,
    qualityDetected: (row.quality_detected as VideoSourceLine['qualityDetected']) ?? null,
    qualitySource: row.quality_source as VideoSourceLine['qualitySource'],
    resolutionWidth: row.resolution_width,
    resolutionHeight: row.resolution_height,
    detectedAt: row.detected_at,
    lastChecked: row.last_checked,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const SOURCE_SELECT = `
  vs.id, vs.video_id, vs.episode_number, vs.source_url, vs.source_name,
  vs.source_site_key, cs.user_label, cs.display_name,
  vs.type, vs.quality, vs.is_active,
  vs.probe_status, vs.render_status, vs.latency_ms,
  vs.last_probed_at, vs.last_rendered_at,
  vs.quality_detected, vs.quality_source,
  vs.resolution_width, vs.resolution_height, vs.detected_at,
  vs.last_checked, vs.submitted_by, vs.created_at, vs.updated_at
`

export async function listVideoSources(
  db: Pool,
  videoId: string,
): Promise<VideoSourceLine[]> {
  const result = await db.query<DbVideoSourceLineRow>(
    `SELECT ${SOURCE_SELECT}
     FROM video_sources vs
     LEFT JOIN crawler_sites cs ON cs.key = COALESCE(vs.source_site_key, (
       SELECT v.site_key FROM videos v WHERE v.id = vs.video_id
     ))
     WHERE vs.video_id = $1 AND vs.deleted_at IS NULL
     ORDER BY vs.created_at ASC`,
    [videoId],
  )
  return result.rows.map(mapRow)
}

export async function findVideoSourceById(
  db: Pool,
  sourceId: string,
): Promise<VideoSourceLine | null> {
  const result = await db.query<DbVideoSourceLineRow>(
    `SELECT ${SOURCE_SELECT}
     FROM video_sources vs
     LEFT JOIN crawler_sites cs ON cs.key = COALESCE(vs.source_site_key, (
       SELECT v.site_key FROM videos v WHERE v.id = vs.video_id
     ))
     WHERE vs.id = $1 AND vs.deleted_at IS NULL`,
    [sourceId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export interface ToggleVideoSourceInput {
  sourceId: string
  isActive: boolean
  /** ISO 8601 时间戳；提供时启用乐观锁。current.updated_at 不匹配则抛 STATE_CONFLICT。 */
  expectedUpdatedAt?: string
}

export interface ToggleVideoSourceResult {
  id: string
  is_active: boolean
  updated_at: string
}

/**
 * 切换线路 is_active；可选乐观锁。
 * CHG-SN-5-PRE-01-C：tx + SELECT FOR UPDATE + version 比较，并发安全。
 *
 * 行为：
 *   - 行不存在 / deleted_at 非空 → 返回 null（404 路径）
 *   - expectedUpdatedAt 提供且不匹配 current.updated_at → 抛 AppError('STATE_CONFLICT', 409)
 *   - 否则 UPDATE is_active + last_checked + updated_at = NOW()
 */
export async function toggleVideoSource(
  db: Pool,
  input: ToggleVideoSourceInput,
): Promise<ToggleVideoSourceResult | null> {
  const client: PoolClient = await db.connect()
  try {
    await client.query('BEGIN')
    const currentResult = await client.query<{ id: string; updated_at: string; deleted_at: string | null }>(
      `SELECT id, updated_at, deleted_at
       FROM video_sources
       WHERE id = $1
       FOR UPDATE`,
      [input.sourceId],
    )
    const current = currentResult.rows[0]
    if (!current || current.deleted_at) {
      await client.query('ROLLBACK')
      return null
    }

    if (
      input.expectedUpdatedAt &&
      new Date(current.updated_at).toISOString() !== new Date(input.expectedUpdatedAt).toISOString()
    ) {
      throw new AppError('STATE_CONFLICT', 'Optimistic lock conflict on video source', 409)
    }

    const updateResult = await client.query<ToggleVideoSourceResult>(
      `UPDATE video_sources
       SET is_active = $1, last_checked = NOW(), updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, is_active, updated_at`,
      [input.isActive, input.sourceId],
    )
    await client.query('COMMIT')
    return updateResult.rows[0] ?? null
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export interface DisableDeadResult {
  disabled: number
  sourceIds: string[]
}

export async function disableDeadSources(
  db: Pool,
  videoId: string,
): Promise<DisableDeadResult> {
  const result = await db.query<{ id: string }>(
    `UPDATE video_sources
     SET is_active = false, last_checked = NOW(), updated_at = NOW()
     WHERE video_id = $1
       AND deleted_at IS NULL
       AND probe_status = 'dead'
       AND is_active = true
     RETURNING id`,
    [videoId],
  )
  return {
    disabled: result.rowCount ?? 0,
    sourceIds: result.rows.map((r) => r.id),
  }
}
