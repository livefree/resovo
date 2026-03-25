/**
 * crawlerTasks.ts — crawler_tasks 表 DB 查询
 * CRAWLER-02: 任务状态跟踪
 */

import type { Pool } from 'pg'

// ── 类型 ──────────────────────────────────────────────────────────

export type CrawlerTaskStatus = 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'timeout'
export type CrawlerTaskType = 'full-crawl' | 'incremental-crawl' | 'verify-source' | 'verify-single'

export interface CrawlerTask {
  id: string
  type: CrawlerTaskType
  sourceSite: string
  targetUrl: string
  status: CrawlerTaskStatus
  retryCount: number
  runId: string | null
  triggerType: 'single' | 'batch' | 'all' | 'schedule' | null
  timeoutAt: string | null
  heartbeatAt: string | null
  cancelRequested: boolean
  result: Record<string, unknown> | null
  scheduledAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface CrawlerOverview {
  siteTotal: number
  connected: number
  running: number
  paused: number
  failed: number
  todayVideos: number
  todayDurationMs: number
}

interface DbCrawlerTaskRow {
  id: string
  type: CrawlerTaskType
  source_site: string
  target_url: string
  status: CrawlerTaskStatus
  retry_count: number
  run_id: string | null
  trigger_type: 'single' | 'batch' | 'all' | 'schedule' | null
  timeout_at: string | null
  heartbeat_at: string | null
  cancel_requested: boolean
  result: Record<string, unknown> | null
  scheduled_at: string
  started_at: string | null
  finished_at: string | null
}

function mapTask(row: DbCrawlerTaskRow): CrawlerTask {
  return {
    id: row.id,
    type: row.type,
    sourceSite: row.source_site,
    targetUrl: row.target_url,
    status: row.status,
    retryCount: row.retry_count,
    runId: row.run_id,
    triggerType: row.trigger_type,
    timeoutAt: row.timeout_at,
    heartbeatAt: row.heartbeat_at,
    cancelRequested: row.cancel_requested,
    result: row.result,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

// ── 创建任务记录 ──────────────────────────────────────────────────

export async function createTask(
  db: Pool,
  input: {
    type: CrawlerTaskType
    sourceSite: string
    targetUrl: string
    scheduledAt?: Date
    runId?: string | null
    triggerType?: 'single' | 'batch' | 'all' | 'schedule' | null
    timeoutSeconds?: number | null
  }
): Promise<CrawlerTask> {
  const result = await db.query<DbCrawlerTaskRow>(
    `INSERT INTO crawler_tasks (
       type, source_site, target_url, status, retry_count, scheduled_at,
       run_id, trigger_type, timeout_at, heartbeat_at, cancel_requested
     )
     VALUES (
       $1, $2, $3, 'pending', 0, COALESCE($4, NOW()),
       $5, $6,
       CASE WHEN $7::int IS NULL THEN NULL ELSE COALESCE($4, NOW()) + ($7::int * INTERVAL '1 second') END,
       NULL,
       false
     )
     RETURNING *`,
    [
      input.type,
      input.sourceSite,
      input.targetUrl,
      input.scheduledAt ?? null,
      input.runId ?? null,
      input.triggerType ?? null,
      input.timeoutSeconds ?? null,
    ],
  )
  return mapTask(result.rows[0])
}

// ── 更新任务状态 ──────────────────────────────────────────────────

export async function updateTaskStatus(
  db: Pool,
  id: string,
  status: CrawlerTaskStatus,
  result?: Record<string, unknown>
): Promise<void> {
  const finishedAt = (status === 'done' || status === 'failed' || status === 'cancelled' || status === 'timeout') ? new Date() : null
  await db.query(
    `UPDATE crawler_tasks
     SET status = $1::text,
         result = COALESCE($2::jsonb, result),
         finished_at = $3,
         started_at = CASE WHEN $1::text = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
         heartbeat_at = CASE WHEN $1::text = 'running' THEN NOW() ELSE heartbeat_at END,
         retry_count = CASE WHEN $1::text IN ('failed', 'timeout') THEN retry_count + 1 ELSE retry_count END
     WHERE id = $4`,
    [status, result ? JSON.stringify(result) : null, finishedAt, id]
  )
}

export async function updateTaskProgress(
  db: Pool,
  id: string,
  progress: {
    videosUpserted: number
    sourcesUpserted: number
    errors: number
    pages: number
    durationMs: number
  }
): Promise<void> {
  await db.query(
    `UPDATE crawler_tasks
     SET status = 'running',
         heartbeat_at = NOW(),
         result = COALESCE(result, '{}'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [id, JSON.stringify(progress)],
  )
}

export async function touchTaskHeartbeat(
  db: Pool,
  id: string,
): Promise<void> {
  await db.query(
    `UPDATE crawler_tasks
     SET heartbeat_at = NOW()
     WHERE id = $1`,
    [id],
  )
}

export async function requestTaskCancel(db: Pool, id: string): Promise<void> {
  await db.query(
    `UPDATE crawler_tasks
     SET cancel_requested = true
     WHERE id = $1`,
    [id],
  )
}

export async function cancelPendingTasksByRun(db: Pool, runId: string): Promise<number> {
  const result = await db.query(
    `UPDATE crawler_tasks
     SET status = 'cancelled',
         finished_at = NOW(),
         cancel_requested = true,
         result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('reason', 'run_cancelled')
     WHERE run_id = $1
       AND status = 'pending'`,
    [runId],
  )
  return result.rowCount ?? 0
}

export async function requestCancelRunningTasksByRun(db: Pool, runId: string): Promise<number> {
  const result = await db.query(
    `UPDATE crawler_tasks
     SET cancel_requested = true,
         result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('cancelRequestedAt', NOW())
     WHERE run_id = $1
       AND status = 'running'`,
    [runId],
  )
  return result.rowCount ?? 0
}

export async function cancelAllActiveTasks(db: Pool): Promise<{ cancelledPending: number; cancelledPaused: number; cancelledRunning: number }> {
  const cancelledPendingResult = await db.query(
    `UPDATE crawler_tasks
     SET status = 'cancelled',
         finished_at = NOW(),
         cancel_requested = true,
         result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('reason', 'stop_all_pending_cancelled')
     WHERE status = 'pending'`,
  )

  const cancelledPausedResult = await db.query(
    `UPDATE crawler_tasks
     SET status = 'cancelled',
         finished_at = NOW(),
         cancel_requested = true,
         result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('reason', 'stop_all_paused_cancelled')
     WHERE status = 'paused'`,
  )

  const cancelledRunningResult = await db.query(
    `UPDATE crawler_tasks
     SET status = 'cancelled',
         finished_at = NOW(),
         cancel_requested = true,
         result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('cancelledAt', NOW(), 'reason', 'stop_all_running_cancelled')
     WHERE status = 'running'`,
  )

  return {
    cancelledPending: cancelledPendingResult.rowCount ?? 0,
    cancelledPaused: cancelledPausedResult.rowCount ?? 0,
    cancelledRunning: cancelledRunningResult.rowCount ?? 0,
  }
}

export async function markTimedOutRunningTasks(db: Pool): Promise<number> {
  const { count } = await markTimedOutRunningTasksWithRunIds(db)
  return count
}

export async function markTimedOutRunningTasksWithRunIds(
  db: Pool,
): Promise<{ count: number; runIds: string[] }> {
  const result = await db.query<{ run_id: string | null }>(
    `UPDATE crawler_tasks
     SET status = 'timeout',
         finished_at = NOW(),
         result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('error', 'TASK_TIMEOUT')
     WHERE status IN ('pending', 'running')
       AND timeout_at IS NOT NULL
       AND timeout_at < NOW()
     RETURNING run_id`,
  )

  const runIds = Array.from(
    new Set(
      result.rows
        .map((row) => row.run_id)
        .filter((runId): runId is string => typeof runId === 'string' && runId.length > 0),
    ),
  )

  return {
    count: result.rowCount ?? 0,
    runIds,
  }
}

export async function markStaleHeartbeatRunningTasks(
  db: Pool,
  staleMinutes = 15,
): Promise<number> {
  const { count } = await markStaleHeartbeatRunningTasksWithRunIds(db, staleMinutes)
  return count
}

export async function markStaleHeartbeatRunningTasksWithRunIds(
  db: Pool,
  staleMinutes = 15,
): Promise<{ count: number; runIds: string[] }> {
  const result = await db.query<{ run_id: string | null }>(
    `UPDATE crawler_tasks
     SET status = CASE WHEN cancel_requested THEN 'cancelled' ELSE 'timeout' END,
         finished_at = NOW(),
         result = COALESCE(result, '{}'::jsonb) || jsonb_build_object(
           'error',
           CASE WHEN cancel_requested THEN 'TASK_CANCELLED_STALE_HEARTBEAT' ELSE 'TASK_STALE_HEARTBEAT_TIMEOUT' END,
           'staleMinutes',
           $1::int
         )
     WHERE status = 'running'
       AND COALESCE(heartbeat_at, scheduled_at) < NOW() - ($1::int * INTERVAL '1 minute')
     RETURNING run_id`,
    [staleMinutes],
  )

  const runIds = Array.from(
    new Set(
      result.rows
        .map((row) => row.run_id)
        .filter((runId): runId is string => typeof runId === 'string' && runId.length > 0),
    ),
  )

  return {
    count: result.rowCount ?? 0,
    runIds,
  }
}

// ── 查询任务列表 ──────────────────────────────────────────────────

export async function listTasks(
  db: Pool,
  params: {
    status?: CrawlerTaskStatus
    triggerType?: 'single' | 'batch' | 'all' | 'schedule'
    runId?: string
    limit?: number
    offset?: number
  }
): Promise<{ rows: CrawlerTask[]; total: number }> {
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
  if (params.runId) {
    conditions.push(`run_id = $${idx++}`)
    values.push(params.runId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit ?? 20
  const offset = params.offset ?? 0

  const [dataResult, countResult] = await Promise.all([
    db.query<DbCrawlerTaskRow>(
      `SELECT * FROM crawler_tasks ${where}
       ORDER BY scheduled_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    ),
    db.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM crawler_tasks ${where}`,
      values
    ),
  ])

  return {
    rows: dataResult.rows.map(mapTask),
    total: parseInt(countResult.rows[0].total, 10),
  }
}

export async function listTasksByRunId(
  db: Pool,
  runId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<{ rows: CrawlerTask[]; total: number }> {
  const limit = params.limit ?? 200
  const offset = params.offset ?? 0
  const [dataResult, countResult] = await Promise.all([
    db.query<DbCrawlerTaskRow>(
      `SELECT *
       FROM crawler_tasks
       WHERE run_id = $1
       ORDER BY scheduled_at DESC
       LIMIT $2 OFFSET $3`,
      [runId, limit, offset],
    ),
    db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM crawler_tasks
       WHERE run_id = $1`,
      [runId],
    ),
  ])
  return {
    rows: dataResult.rows.map(mapTask),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10) || 0,
  }
}

// ── 活跃任务查询（互斥控制）───────────────────────────────────────

export async function findActiveTaskBySite(
  db: Pool,
  siteKey: string,
): Promise<CrawlerTask | null> {
  const result = await db.query<DbCrawlerTaskRow>(
    `SELECT *
     FROM crawler_tasks
     WHERE source_site = $1
       AND status IN ('pending', 'running', 'paused')
     ORDER BY scheduled_at DESC
     LIMIT 1`,
    [siteKey],
  )

  return result.rows[0] ? mapTask(result.rows[0]) : null
}

// ── 陈旧 pending 任务清理（入队失败补偿）───────────────────────────

export async function markStalePendingTasks(
  db: Pool,
  params: { siteKey?: string; staleMinutes?: number } = {},
): Promise<number> {
  const staleMinutes = params.staleMinutes ?? 10
  const baseSql = `WITH stale AS (
    UPDATE crawler_tasks
    SET status = 'failed',
        finished_at = NOW(),
        retry_count = retry_count + 1,
        result = COALESCE(result, '{}'::jsonb) || jsonb_build_object(
          'error',
          'QUEUE_ENQUEUE_TIMEOUT',
          'message',
          '任务长时间处于 pending，已自动标记失败，请检查 Redis/worker',
          'staleMinutes',
          $1::int
        )
    WHERE status = 'pending'
      AND scheduled_at < NOW() - ($1::int * INTERVAL '1 minute')
      %SITE_FILTER%
    RETURNING id
  )
  SELECT COUNT(*)::text AS count FROM stale`

  const result = params.siteKey
    ? await db.query<{ count: string }>(
        baseSql.replace('%SITE_FILTER%', 'AND source_site = $2::text'),
        [staleMinutes, params.siteKey],
      )
    : await db.query<{ count: string }>(
        baseSql.replace('%SITE_FILTER%', ''),
        [staleMinutes],
      )

  return parseInt(result.rows[0]?.count ?? '0', 10) || 0
}

// ── 最新任务查询（单站/批量）─────────────────────────────────────

export async function getLatestTaskBySite(
  db: Pool,
  siteKey: string,
): Promise<CrawlerTask | null> {
  const result = await db.query<DbCrawlerTaskRow>(
    `SELECT *
     FROM crawler_tasks
     WHERE source_site = $1
     ORDER BY scheduled_at DESC
     LIMIT 1`,
    [siteKey],
  )

  return result.rows[0] ? mapTask(result.rows[0]) : null
}

export async function getTaskById(
  db: Pool,
  taskId: string,
): Promise<CrawlerTask | null> {
  const result = await db.query<DbCrawlerTaskRow>(
    `SELECT * FROM crawler_tasks WHERE id = $1`,
    [taskId],
  )
  return result.rows[0] ? mapTask(result.rows[0]) : null
}

export async function getLatestTasksBySites(
  db: Pool,
  siteKeys: string[],
): Promise<CrawlerTask[]> {
  if (siteKeys.length === 0) return []

  const result = await db.query<DbCrawlerTaskRow>(
    `SELECT DISTINCT ON (source_site) *
     FROM crawler_tasks
     WHERE source_site = ANY($1::text[])
     ORDER BY source_site, scheduled_at DESC`,
    [siteKeys],
  )

  return result.rows.map(mapTask)
}

// ── 采集概览汇总 ────────────────────────────────────────────────

interface OverviewRow {
  site_total: string
  connected: string
  running: string
  paused: string
  failed: string
  today_videos: string
  today_duration_ms: string
}

export async function getCrawlerOverview(db: Pool): Promise<CrawlerOverview> {
  const result = await db.query<OverviewRow>(
    `WITH site_stats AS (
       SELECT
         COUNT(*)::text AS site_total,
         SUM(CASE WHEN last_crawl_status = 'ok' THEN 1 ELSE 0 END)::text AS connected,
         SUM(CASE WHEN last_crawl_status = 'failed' THEN 1 ELSE 0 END)::text AS failed
       FROM crawler_sites
     ),
     running_stats AS (
       SELECT
         COUNT(
           DISTINCT CASE
             WHEN status = 'pending' AND scheduled_at >= NOW() - INTERVAL '10 minute' THEN source_site
             WHEN status = 'running' AND COALESCE(heartbeat_at, scheduled_at) >= NOW() - INTERVAL '5 minute' THEN source_site
             ELSE NULL
           END
         )::text AS running,
         COUNT(DISTINCT CASE WHEN status = 'paused' THEN source_site END)::text AS paused
       FROM crawler_tasks
       WHERE status IN ('pending', 'running', 'paused')
         AND type IN ('full-crawl', 'incremental-crawl')
     ),
     today_stats AS (
       SELECT
         SUM(
           CASE
             WHEN status IN ('running', 'done')
              AND (result ->> 'videosUpserted') ~ '^[0-9]+$'
               THEN (result ->> 'videosUpserted')::bigint
             ELSE 0
           END
         )::text AS today_videos,
         SUM(
           CASE
             WHEN status = 'running'
               THEN GREATEST((EXTRACT(EPOCH FROM (NOW() - scheduled_at)) * 1000)::bigint, 0)
             WHEN status = 'done'
              AND (result ->> 'durationMs') ~ '^[0-9]+$'
               THEN (result ->> 'durationMs')::bigint
             ELSE 0
           END
         )::text AS today_duration_ms
       FROM crawler_tasks
       WHERE status IN ('running', 'done')
         AND type IN ('full-crawl', 'incremental-crawl')
         AND scheduled_at >= date_trunc('day', NOW())
     )
     SELECT
       COALESCE(site_stats.site_total, '0') AS site_total,
       COALESCE(site_stats.connected, '0') AS connected,
       COALESCE(running_stats.running, '0') AS running,
       COALESCE(running_stats.paused, '0') AS paused,
       COALESCE(site_stats.failed, '0') AS failed,
       COALESCE(today_stats.today_videos, '0') AS today_videos,
       COALESCE(today_stats.today_duration_ms, '0') AS today_duration_ms
     FROM site_stats, running_stats, today_stats`,
  )

  const row = result.rows[0]
  return {
    siteTotal: parseInt(row.site_total, 10) || 0,
    connected: parseInt(row.connected, 10) || 0,
    running: parseInt(row.running, 10) || 0,
    paused: parseInt(row.paused, 10) || 0,
    failed: parseInt(row.failed, 10) || 0,
    todayVideos: parseInt(row.today_videos, 10) || 0,
    todayDurationMs: parseInt(row.today_duration_ms, 10) || 0,
  }
}

export async function countOrphanActiveTasks(db: Pool): Promise<number> {
  const result = await db.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM crawler_tasks
     WHERE run_id IS NULL
       AND status IN ('pending', 'running', 'paused')
       AND type IN ('full-crawl', 'incremental-crawl')`,
  )
  return parseInt(result.rows[0]?.total ?? '0', 10) || 0
}
