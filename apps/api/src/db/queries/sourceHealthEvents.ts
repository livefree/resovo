/**
 * sourceHealthEvents.ts — source_health_events 查询
 * CHG-SN-4-05: line-health 分页查询 + feedback 写入
 */

import type { Pool } from 'pg'
import type { SourceHealthEventOrigin } from '@resovo/types'

export interface DbSourceHealthEventRow {
  id: string
  video_id: string
  source_id: string | null
  origin: SourceHealthEventOrigin
  old_status: string | null
  new_status: string | null
  triggered_by: string | null
  error_detail: string | null
  http_code: number | null
  latency_ms: number | null
  processed_at: string | null
  created_at: string
}

export interface LineHealthQuery {
  sourceId: string
  page?: number
  limit?: number
}

export async function listLineHealthEvents(
  db: Pool,
  query: LineHealthQuery,
): Promise<{ rows: DbSourceHealthEventRow[]; total: number }> {
  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 20, 100)
  const offset = (page - 1) * limit

  const [rows, countResult] = await Promise.all([
    db.query<DbSourceHealthEventRow>(
      `SELECT id, video_id, source_id, origin, old_status, new_status,
              triggered_by, error_detail, http_code, latency_ms, processed_at, created_at
       FROM source_health_events
       WHERE source_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [query.sourceId, limit, offset],
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM source_health_events WHERE source_id = $1`,
      [query.sourceId],
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export interface InsertHealthEventInput {
  videoId: string
  sourceId?: string | null
  origin: SourceHealthEventOrigin
  oldStatus?: string | null
  newStatus?: string | null
  triggeredBy?: string | null
  errorDetail?: string | null
  httpCode?: number | null
  latencyMs?: number | null
  processedAt?: string | null
}

export async function insertHealthEvent(
  db: Pool,
  input: InsertHealthEventInput,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO source_health_events
       (video_id, source_id, origin, old_status, new_status, triggered_by,
        error_detail, http_code, latency_ms, processed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      input.videoId,
      input.sourceId ?? null,
      input.origin,
      input.oldStatus ?? null,
      input.newStatus ?? null,
      input.triggeredBy ?? null,
      input.errorDetail ?? null,
      input.httpCode ?? null,
      input.latencyMs ?? null,
      input.processedAt ?? null,
    ],
  )
  return result.rows[0]!.id
}

/**
 * SRCHEALTH-P2-4-A：reprobeRoute 批量入队 manual_route_reprobe 信号（每 active 源一行）。
 * 入队口径 = countRouteSources 线路匹配口径 + is_active=true——与 P2-4-B worker 定向消费
 * （P1-5 loadSourcesByIds 的 active 口径）对齐，防「入队不被消费却标 processed」（F2-① 同型）。
 * jobId 写入 triggered_by：audit afterJsonb 的 jobId 经此关联到全部信号行（真实可溯源）。
 * 返回实际入队行数（= audit queuedCount 口径，从「线路源总数」收紧为「实际入队 active 源数」）。
 */
export async function enqueueRouteReprobeSignals(
  db: Pool,
  input: { siteKey: string; sourceName: string; jobId: string },
): Promise<number> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO source_health_events (video_id, source_id, origin, triggered_by, processed_at)
     SELECT vs.video_id, vs.id, 'manual_route_reprobe', $3, NULL
       FROM video_sources vs
       JOIN videos v ON v.id = vs.video_id
      WHERE COALESCE(vs.source_site_key, v.site_key) = $1
        AND vs.source_name = $2
        AND vs.is_active = true
        AND vs.deleted_at IS NULL
     RETURNING id`,
    [input.siteKey, input.sourceName, input.jobId],
  )
  return result.rowCount ?? result.rows.length
}
