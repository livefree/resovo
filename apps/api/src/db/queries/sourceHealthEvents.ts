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
