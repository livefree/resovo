import type { Pool } from 'pg'

export type CrawlerRunTriggerType = 'single' | 'batch' | 'all' | 'schedule'
export type CrawlerRunMode = 'incremental' | 'full'
export type CrawlerRunStatus = 'queued' | 'running' | 'paused' | 'success' | 'partial_failed' | 'failed' | 'cancelled'
export type CrawlerRunControlStatus = 'active' | 'pausing' | 'paused' | 'cancelling' | 'cancelled'

export interface CrawlerRun {
  id: string
  triggerType: CrawlerRunTriggerType
  mode: CrawlerRunMode
  status: CrawlerRunStatus
  controlStatus: CrawlerRunControlStatus
  requestedSiteCount: number
  enqueuedSiteCount: number
  skippedSiteCount: number
  timeoutSeconds: number
  createdBy: string | null
  scheduleId: string | null
  summary: Record<string, unknown> | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

interface DbRunRow {
  id: string
  trigger_type: CrawlerRunTriggerType
  mode: CrawlerRunMode
  status: CrawlerRunStatus
  control_status: CrawlerRunControlStatus
  requested_site_count: number
  enqueued_site_count: number
  skipped_site_count: number
  timeout_seconds: number
  created_by: string | null
  schedule_id: string | null
  summary: Record<string, unknown> | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

function mapRun(row: DbRunRow): CrawlerRun {
  return {
    id: row.id,
    triggerType: row.trigger_type,
    mode: row.mode,
    status: row.status,
    controlStatus: row.control_status,
    requestedSiteCount: row.requested_site_count,
    enqueuedSiteCount: row.enqueued_site_count,
    skippedSiteCount: row.skipped_site_count,
    timeoutSeconds: row.timeout_seconds,
    createdBy: row.created_by,
    scheduleId: row.schedule_id,
    summary: row.summary,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createRun(
  db: Pool,
  input: {
    triggerType: CrawlerRunTriggerType
    mode: CrawlerRunMode
    requestedSiteCount: number
    timeoutSeconds: number
    createdBy?: string | null
    scheduleId?: string | null
    summary?: Record<string, unknown> | null
  },
): Promise<CrawlerRun> {
  const result = await db.query<DbRunRow>(
    `INSERT INTO crawler_runs (
       trigger_type, mode, status, control_status,
       requested_site_count, timeout_seconds, created_by, schedule_id, summary
     ) VALUES ($1, $2, 'queued', 'active', $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      input.triggerType,
      input.mode,
      input.requestedSiteCount,
      input.timeoutSeconds,
      input.createdBy ?? null,
      input.scheduleId ?? null,
      input.summary ? JSON.stringify(input.summary) : null,
    ],
  )
  return mapRun(result.rows[0])
}

export async function getRunById(db: Pool, runId: string): Promise<CrawlerRun | null> {
  const result = await db.query<DbRunRow>(
    `SELECT * FROM crawler_runs WHERE id = $1`,
    [runId],
  )
  return result.rows[0] ? mapRun(result.rows[0]) : null
}

export async function listRuns(
  db: Pool,
  params: {
    status?: CrawlerRunStatus
    triggerType?: CrawlerRunTriggerType
    limit?: number
    offset?: number
  } = {},
): Promise<{ rows: CrawlerRun[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1
  if (params.status) {
    conditions.push(`status = $${idx++}`)
    values.push(params.status)
  }
  if (params.triggerType) {
    conditions.push(`trigger_type = $${idx++}`)
    values.push(params.triggerType)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit ?? 20
  const offset = params.offset ?? 0

  const [dataResult, countResult] = await Promise.all([
    db.query<DbRunRow>(
      `SELECT * FROM crawler_runs ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset],
    ),
    db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM crawler_runs ${where}`,
      values,
    ),
  ])

  return {
    rows: dataResult.rows.map(mapRun),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10) || 0,
  }
}

export async function setRunEnqueueStats(
  db: Pool,
  runId: string,
  stats: { enqueued: number; skipped: number; summary?: Record<string, unknown> },
): Promise<void> {
  await db.query(
    `UPDATE crawler_runs
     SET enqueued_site_count = $1,
         skipped_site_count = $2,
         summary = COALESCE(summary, '{}'::jsonb) || COALESCE($3::jsonb, '{}'::jsonb),
         updated_at = NOW()
     WHERE id = $4`,
    [stats.enqueued, stats.skipped, stats.summary ? JSON.stringify(stats.summary) : null, runId],
  )
}

export async function updateRunControlStatus(
  db: Pool,
  runId: string,
  controlStatus: CrawlerRunControlStatus,
): Promise<void> {
  await db.query(
    `UPDATE crawler_runs
     SET control_status = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [controlStatus, runId],
  )
}

export async function requestCancelAllActiveRuns(db: Pool): Promise<{ count: number; runIds: string[] }> {
  const result = await db.query<{ id: string }>(
    `UPDATE crawler_runs
     SET control_status = 'cancelling',
         updated_at = NOW()
     WHERE status IN ('queued', 'running', 'paused')
       AND control_status NOT IN ('cancelling', 'cancelled')
     RETURNING id`,
  )
  return {
    count: result.rowCount ?? 0,
    runIds: result.rows.map((r) => r.id),
  }
}

export async function listActiveRunIds(db: Pool): Promise<string[]> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM crawler_runs WHERE status IN ('queued', 'running', 'paused')`,
  )
  return result.rows.map((row) => row.id)
}

export async function syncRunStatusFromTasks(db: Pool, runId: string): Promise<void> {
  await db.query(
    `WITH agg AS (
       SELECT
         COUNT(*)::int AS total,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending,
         SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END)::int AS running,
         SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END)::int AS paused,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int AS done,
         SUM(CASE WHEN status IN ('failed', 'timeout') THEN 1 ELSE 0 END)::int AS failed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled
       FROM crawler_tasks
       WHERE run_id = $1
     )
     UPDATE crawler_runs r
     SET status = CASE
           WHEN a.total = 0 THEN r.status
           WHEN r.control_status IN ('pausing', 'paused') AND a.running = 0 AND (a.pending > 0 OR a.paused > 0) THEN 'paused'
           WHEN a.running > 0 THEN 'running'
           WHEN a.pending > 0 THEN 'queued'
           WHEN a.cancelled = a.total THEN 'cancelled'
           WHEN a.failed > 0 AND a.done > 0 THEN 'partial_failed'
           WHEN a.failed > 0 AND a.done = 0 THEN 'failed'
           ELSE 'success'
         END,
         control_status = CASE
           WHEN a.total > 0 AND a.cancelled = a.total THEN 'cancelled'
           ELSE r.control_status
         END,
         started_at = CASE
           WHEN r.started_at IS NULL AND (a.running > 0 OR a.paused > 0 OR a.done > 0 OR a.failed > 0 OR a.cancelled > 0) THEN NOW()
           ELSE r.started_at
         END,
         finished_at = CASE
           WHEN a.pending = 0 AND a.running = 0 AND a.paused = 0 THEN NOW()
           ELSE NULL
         END,
         updated_at = NOW(),
         summary = COALESCE(r.summary, '{}'::jsonb) || jsonb_build_object(
           'total', a.total,
           'pending', a.pending,
           'running', a.running,
           'paused', a.paused,
           'done', a.done,
           'failed', a.failed,
           'cancelled', a.cancelled
         )
     FROM agg a
     WHERE r.id = $1`,
    [runId],
  )
}
