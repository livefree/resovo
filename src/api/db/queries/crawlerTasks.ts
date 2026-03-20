/**
 * crawlerTasks.ts — crawler_tasks 表 DB 查询
 * CRAWLER-02: 任务状态跟踪
 */

import type { Pool } from 'pg'

// ── 类型 ──────────────────────────────────────────────────────────

export type CrawlerTaskStatus = 'pending' | 'running' | 'done' | 'failed'
export type CrawlerTaskType = 'full-crawl' | 'incremental-crawl' | 'verify-source' | 'verify-single'

export interface CrawlerTask {
  id: string
  type: CrawlerTaskType
  sourceSite: string
  targetUrl: string
  status: CrawlerTaskStatus
  retryCount: number
  result: Record<string, unknown> | null
  scheduledAt: string
  finishedAt: string | null
}

export interface CrawlerOverview {
  siteTotal: number
  connected: number
  running: number
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
  result: Record<string, unknown> | null
  scheduled_at: string
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
    result: row.result,
    scheduledAt: row.scheduled_at,
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
  }
): Promise<CrawlerTask> {
  const result = await db.query<DbCrawlerTaskRow>(
    `INSERT INTO crawler_tasks (type, source_site, target_url, status, retry_count, scheduled_at)
     VALUES ($1, $2, $3, 'pending', 0, COALESCE($4, NOW()))
     RETURNING *`,
    [input.type, input.sourceSite, input.targetUrl, input.scheduledAt ?? null]
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
  const finishedAt = (status === 'done' || status === 'failed') ? new Date() : null
  await db.query(
    `UPDATE crawler_tasks
     SET status = $1,
         result = COALESCE($2::jsonb, result),
         finished_at = $3,
         retry_count = CASE WHEN $1 = 'failed' THEN retry_count + 1 ELSE retry_count END
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
         result = COALESCE(result, '{}'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [id, JSON.stringify(progress)],
  )
}

// ── 查询任务列表 ──────────────────────────────────────────────────

export async function listTasks(
  db: Pool,
  params: { status?: CrawlerTaskStatus; limit?: number; offset?: number }
): Promise<{ rows: CrawlerTask[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (params.status) {
    conditions.push(`status = $${idx++}`)
    values.push(params.status)
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

// ── 活跃任务查询（互斥控制）───────────────────────────────────────

export async function findActiveTaskBySite(
  db: Pool,
  siteKey: string,
): Promise<CrawlerTask | null> {
  const result = await db.query<DbCrawlerTaskRow>(
    `SELECT *
     FROM crawler_tasks
     WHERE source_site = $1
       AND status IN ('pending', 'running')
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
  const result = await db.query<{ count: string }>(
    `WITH stale AS (
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
             $2::int
           )
       WHERE status = 'pending'
         AND scheduled_at < NOW() - ($2::int * INTERVAL '1 minute')
         AND ($1::text IS NULL OR source_site = $1::text)
       RETURNING id
     )
     SELECT COUNT(*)::text AS count FROM stale`,
    [params.siteKey ?? null, staleMinutes],
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
         COUNT(DISTINCT source_site)::text AS running
       FROM crawler_tasks
       WHERE status IN ('pending', 'running')
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
       WHERE status = 'done'
         AND type IN ('full-crawl', 'incremental-crawl')
         AND scheduled_at >= date_trunc('day', NOW())
     )
     SELECT
       COALESCE(site_stats.site_total, '0') AS site_total,
       COALESCE(site_stats.connected, '0') AS connected,
       COALESCE(running_stats.running, '0') AS running,
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
    failed: parseInt(row.failed, 10) || 0,
    todayVideos: parseInt(row.today_videos, 10) || 0,
    todayDurationMs: parseInt(row.today_duration_ms, 10) || 0,
  }
}
