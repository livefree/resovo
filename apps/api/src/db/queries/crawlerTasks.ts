/**
 * crawlerTasks.ts — crawler_tasks 表 DB 查询
 * CRAWLER-02: 任务状态跟踪
 * 查询函数迁至 crawlerTasks.queries.ts（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import { AppError } from '@/api/lib/errors'
import { syncRunStatusFromTasks } from './crawlerRuns'
import {
  type DbCrawlerTaskRow,
  type CrawlerTaskStatus,
  type CrawlerTaskType,
  type CrawlerTask,
  mapTask,
} from './crawlerTasks.types'

import { getTaskById } from './crawlerTasks.queries'

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

// ── CW1-B-EP / ADR-151 §5.1 — task 级 cancel（单点）─────────────────

export type CancelTaskErrorCode = 'NOT_FOUND' | 'STATE_CONFLICT'

export interface CancelTaskResult {
  readonly task: CrawlerTask
  readonly runId: string | null
  readonly finalStatus: 'cancelled' | 'cancel_requested'
  readonly alreadyRequested: boolean
}

/**
 * ADR-151 §5.1：task 级 cancel（含 R-151-2 幂等守卫）
 *
 * 状态机：
 * - pending / paused → 直接 cancelled + finished_at=NOW() + cancel_requested=true
 * - running 首次 cancel → cancel_requested=true（worker 15s 内响应）
 * - running 已 cancel_requested → 幂等返回 alreadyRequested=true（不重写时间戳 / 不重复 audit）
 * - terminal（done/failed/cancelled/timeout）→ throw STATE_CONFLICT
 *
 * 注：本函数不触发 syncRunStatusFromTasks，由调用方决定（单点 route / batch query 末段触发）
 */
export async function cancelTaskById(
  db: Pool,
  taskId: string,
): Promise<CancelTaskResult | null> {
  const existing = await getTaskById(db, taskId)
  if (!existing) return null
  if (['done', 'failed', 'cancelled', 'timeout'].includes(existing.status)) {
    throw new AppError('STATE_CONFLICT', 'TASK_CANCEL_FORBIDDEN_TERMINAL', 422)
  }
  if (existing.status === 'running') {
    if (existing.cancelRequested) {
      return {
        task: existing,
        runId: existing.runId,
        finalStatus: 'cancel_requested',
        alreadyRequested: true,
      }
    }
    await db.query(
      `UPDATE crawler_tasks
         SET cancel_requested = true,
             result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('cancelRequestedAt', NOW(), 'reason', 'task_manual_cancel')
         WHERE id = $1`,
      [taskId],
    )
    return {
      task: { ...existing, cancelRequested: true },
      runId: existing.runId,
      finalStatus: 'cancel_requested',
      alreadyRequested: false,
    }
  }
  // pending / paused → 直接 cancelled
  await db.query(
    `UPDATE crawler_tasks
       SET status = 'cancelled', finished_at = NOW(), cancel_requested = true,
           result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('reason', 'task_manual_cancel')
       WHERE id = $1`,
    [taskId],
  )
  const refreshed = await getTaskById(db, taskId)
  if (!refreshed) return null
  return {
    task: refreshed,
    runId: existing.runId,
    finalStatus: 'cancelled',
    alreadyRequested: false,
  }
}

// ── CW1-B-EP / ADR-151 §5.2 — task 级 batch cancel ─────────────────

export interface BatchCancelErrorEntry {
  readonly id: string
  readonly code: CancelTaskErrorCode
  readonly reason: string
}

export interface BatchCancelSummary {
  readonly cancelled: number
  readonly cancelRequested: number
  readonly alreadyRequested: number
  readonly errors: readonly BatchCancelErrorEntry[]
}

export interface BatchCancelResult {
  readonly summary: BatchCancelSummary
  readonly runIds: readonly string[]
  /** Y-151-1 best-effort：syncRunStatusFromTasks 失败的 run IDs */
  readonly failedRunSyncIds: readonly string[]
}

/**
 * ADR-151 §5.2：batch task 级 cancel
 *
 * 两阶段：
 * 1. 逐个 cancelTaskById（部分失败累入 errors[]）
 * 2. R-151-1：for-of 串行触发 syncRunStatusFromTasks（与现有 4 处历史范式对齐）
 *    + Y-151-1 best-effort：单个 syncRun throw → 计入 failedRunSyncIds[] 不阻塞
 */
export async function batchCancelTasks(
  db: Pool,
  taskIds: readonly string[],
): Promise<BatchCancelResult> {
  const errors: BatchCancelErrorEntry[] = []
  const cancelledRunIds = new Set<string>()
  let cancelled = 0
  let cancelRequested = 0
  let alreadyRequested = 0

  for (const id of taskIds) {
    try {
      const result = await cancelTaskById(db, id)
      if (!result) {
        errors.push({ id, code: 'NOT_FOUND', reason: 'task not found' })
        continue
      }
      if (result.alreadyRequested) alreadyRequested++
      else if (result.finalStatus === 'cancelled') cancelled++
      else if (result.finalStatus === 'cancel_requested') cancelRequested++
      if (result.runId) cancelledRunIds.add(result.runId)
    } catch (err) {
      if (err instanceof AppError && err.code === 'STATE_CONFLICT') {
        errors.push({ id, code: 'STATE_CONFLICT', reason: err.message })
        continue
      }
      throw err
    }
  }

  const failedRunSyncIds: string[] = []
  for (const runId of cancelledRunIds) {
    try {
      await syncRunStatusFromTasks(db, runId)
    } catch {
      failedRunSyncIds.push(runId)
    }
  }

  return {
    summary: { cancelled, cancelRequested, alreadyRequested, errors },
    runIds: Array.from(cancelledRunIds),
    failedRunSyncIds,
  }
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

/**
 * listDistinctSiteKeysByRun — 取某 run 涉及的去重站点键（NTLG-P0-3 / ADR-191）。
 * crawler retry 重建 createAndEnqueueRun 的 siteKeys 输入（source_site 列即 siteKey）。
 */
export async function listDistinctSiteKeysByRun(db: Pool, runId: string): Promise<string[]> {
  const result = await db.query<{ source_site: string }>(
    `SELECT DISTINCT source_site FROM crawler_tasks WHERE run_id = $1 AND source_site IS NOT NULL`,
    [runId],
  )
  return result.rows.map((row) => row.source_site).filter((s): s is string => typeof s === 'string' && s.length > 0)
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
