/**
 * crawlerTasks.ts — crawler_tasks 表 DB 查询
 * CRAWLER-02: 任务状态跟踪
 * 查询函数迁至 crawlerTasks.queries.ts（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import {
  type DbCrawlerTaskRow,
  type CrawlerTaskStatus,
  type CrawlerTaskType,
  type CrawlerTask,
  mapTask,
} from './crawlerTasks.types'

export type { CrawlerTaskStatus, CrawlerTaskType, CrawlerTask, CrawlerOverview } from './crawlerTasks.types'
export {
  findTaskById, listTasks, listTasksByRunId, findActiveTaskBySite,
  markStalePendingTasks, getLatestTaskBySite, getTaskById, getLatestTasksBySites,
  getCrawlerOverview, countOrphanActiveTasks,
} from './crawlerTasks.queries'

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
