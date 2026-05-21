/**
 * crawlerTasks.queries.ts — crawler_tasks 查询函数
 * 从 crawlerTasks.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import {
  type DbCrawlerTaskRow,
  type CrawlerTask,
  type CrawlerTaskStatus,
  type CrawlerOverview,
  mapTask,
} from './crawlerTasks.types'

// ── 查询单条任务 ──────────────────────────────────────────────────

export async function findTaskById(db: Pool, taskId: string): Promise<CrawlerTask | null> {
  const result = await db.query<DbCrawlerTaskRow>(
    `SELECT id, type, source_site, target_url, status, retry_count, run_id, trigger_type,
            timeout_at, heartbeat_at, cancel_requested, result, scheduled_at, started_at, finished_at
     FROM crawler_tasks WHERE id = $1`,
    [taskId]
  )
  return result.rows[0] ? mapTask(result.rows[0]) : null
}

// ── 查询任务列表 ──────────────────────────────────────────────────

// Safe whitelist: maps frontend sortField names to DB column names
const TASK_SORT_COLUMNS: Record<string, string> = {
  runId:       'run_id',
  type:        'type',
  site:        'source_site',
  triggerType: 'trigger_type',
  status:      'status',
  startedAt:   'started_at',
  finishedAt:  'finished_at',
  error:       'error',
}

export async function listTasks(
  db: Pool,
  params: {
    status?: CrawlerTaskStatus
    triggerType?: 'single' | 'batch' | 'all' | 'schedule'
    runId?: string
    sortField?: string
    sortDir?: 'asc' | 'desc'
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

  const dbCol = params.sortField ? TASK_SORT_COLUMNS[params.sortField] : undefined
  const orderBy = dbCol
    ? `${dbCol} ${params.sortDir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`
    : 'scheduled_at DESC'

  const [dataResult, countResult] = await Promise.all([
    db.query<DbCrawlerTaskRow>(
      `SELECT * FROM crawler_tasks ${where}
       ORDER BY ${orderBy}
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
