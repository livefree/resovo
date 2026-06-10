/**
 * TaskAggregator.ts — admin Shell 任务面板聚合（ADR-147）
 *
 * 数据源（D-147-3 方案 C 有主次 / ADR-194 D-194-5 副源升级）：
 *   主源：crawler_runs 表（最近 N 条按 created_at DESC，可配 since 窗口）
 *   副源：task_runs 持久登记（替代旧「bull active 瞬时快照」——终态留存 + digest + 失败锚点）；
 *         id 加 `taskrun-${id}` 前缀避免与 crawler UUID / bull-{queue}-{jobId} 冲突
 *   合并：两源 union 按 startedAt 倒序，slice(limit)
 *
 * R-147-3 缓解：bull getJobCounts（任务闪电 running 计数）try-catch 降级 — Redis 不可用时
 *   queueCounts 归零 + degraded=true；task_runs/crawler_runs 走同一 DB，DB 不可用则整体失败（口径一致）。
 */

import type { Pool } from 'pg'
import type { AdminTaskItem, AdminQueueCounts, TaskResultDigest, TaskMetric } from '@resovo/types'
import { crawlerQueue, maintenanceQueue } from '@/api/lib/queue'
import { listTaskRuns, type TaskRunRow, type TaskRunStatus } from '@/api/db/queries/taskRuns'

/**
 * buildTaskResultDigest — 从 crawler_runs.summary 投影结构化 TaskResultDigest（ADR-193 D-193-4，path A）。
 *
 * summary 键（syncRunStatusFromTasks 落库）：videosUpserted/sourcesUpserted/failed/errors
 * （+ total/pending/running/paused/done/cancelled 6 个生命周期内部计数，运营无需感知 → 不投影）。
 *
 * 投影口径（D-193-4 表，零自由度）：
 *   - videos_added（新增视频）/ sources_added（新增线路）：tone='ok'，恒展示（即使为 0，运营需知本次采集产出）
 *   - sites_failed（站点失败）：tone='warn'，>0 展示 / =0 省略（不展示「0 失败」噪声）
 *   - errors（错误）：tone='danger'，>0 展示 / =0 省略
 *
 * num 守卫复用 buildRunDigest 口径（BackgroundEventService）：非数字 / 缺字段 → 该 metric 省略，不抛错、不进空 catch。
 * summary=null 或投影后无任何 metric → 返回 undefined（不挂 digest）。
 */
export function buildTaskResultDigest(
  summary: Record<string, unknown> | null,
): TaskResultDigest | undefined {
  if (!summary) return undefined
  const num = (key: string): number | undefined => {
    const v = summary[key]
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined
  }
  const metrics: TaskMetric[] = []
  const parts: string[] = []

  const videos = num('videosUpserted')
  if (videos !== undefined) {
    metrics.push({ key: 'videos_added', label: '新增视频', value: videos, tone: 'ok' })
    parts.push(`新增 ${videos} 视频`)
  }
  const sources = num('sourcesUpserted')
  if (sources !== undefined) {
    metrics.push({ key: 'sources_added', label: '新增线路', value: sources, tone: 'ok' })
    parts.push(`${sources} 线路`)
  }
  const failed = num('failed')
  if (failed !== undefined && failed > 0) {
    metrics.push({ key: 'sites_failed', label: '站点失败', value: failed, tone: 'warn' })
    parts.push(`${failed} 站点失败`)
  }
  const errors = num('errors')
  if (errors !== undefined && errors > 0) {
    metrics.push({ key: 'errors', label: '错误', value: errors, tone: 'danger' })
    parts.push(`${errors} 错误`)
  }

  if (metrics.length === 0) return undefined
  return { summary: parts.join(' · '), metrics }
}

interface CrawlerRunRow {
  id: string
  crawl_mode: string
  trigger_type: string
  status: string
  started_at: Date | null
  finished_at: Date | null
  created_at: Date
  summary: Record<string, unknown> | null
}

/** CrawlerRun.status → TaskItem.status 映射（D-147-3 字段映射表） */
const STATUS_MAP: Record<string, AdminTaskItem['status']> = {
  queued: 'pending',
  paused: 'pending',
  running: 'running',
  success: 'success',
  failed: 'failed',
  partial_failed: 'failed',
  cancelled: 'failed',
}

const FAILED_STATUSES = new Set(['failed', 'partial_failed', 'cancelled'])

/** task_runs.status（6 态）→ AdminTaskItem.status（4 态）映射（ADR-194 D-194-5）。
 *  cancelled→failed 与 crawler STATUS_MAP 同口径；cancelling=取消进行中仍在跑 → running（直至 cancelled）。 */
const TASK_RUN_STATUS_MAP: Record<TaskRunStatus, AdminTaskItem['status']> = {
  pending: 'pending',
  running: 'running',
  cancelling: 'running',
  success: 'success',
  failed: 'failed',
  cancelled: 'failed',
}

export interface ListTasksParams {
  limit: number
  since: string
}

export interface ListTasksResult {
  items: AdminTaskItem[]
  total: number
  queueCounts: AdminQueueCounts
  /** Redis 不可用时为 true */
  degraded: boolean
}

export class TaskAggregator {
  constructor(private readonly db: Pool) {}

  async list(params: ListTasksParams): Promise<ListTasksResult> {
    const runsRes = await this.db.query<CrawlerRunRow>(
      `SELECT id::text, crawl_mode, trigger_type, status,
              started_at, finished_at, created_at, summary
         FROM crawler_runs
        WHERE created_at >= $1::timestamptz
        ORDER BY created_at DESC
        LIMIT $2`,
      [params.since, params.limit],
    )

    const crawlerItems: AdminTaskItem[] = runsRes.rows.map((row) => this.mapCrawlerRun(row))

    // ADR-194 D-194-5：副源从「bull active 瞬时快照」升级为「task_runs 持久登记」
    //   （终态留存 + digest + 失败锚点；同 DB 读，DB 不可用与 crawler_runs 一并失败、口径一致）。
    const taskRunItems = await this.fetchTaskRuns(params)

    // queueCounts 仍取 bull getJobCounts（任务闪电 running 计数，§4.1）；Redis 不可用降级。
    const { queueCounts, degraded } = await this.fetchQueueCounts()

    const merged = [...crawlerItems, ...taskRunItems]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, params.limit)

    return {
      items: merged,
      total: merged.length,
      queueCounts,
      degraded,
    }
  }

  /** 副源 task_runs 持久登记 → AdminTaskItem（D-194-5；同 since 窗口 + limit，命中 idx_task_runs_created_at）。 */
  private async fetchTaskRuns(params: ListTasksParams): Promise<AdminTaskItem[]> {
    const rows = await listTaskRuns(this.db, { limit: params.limit, since: params.since })
    return rows.map((row) => this.mapTaskRun(row))
  }

  private mapTaskRun(row: TaskRunRow): AdminTaskItem {
    const startedAt = (row.startedAt ?? row.createdAt).toISOString()
    const status = TASK_RUN_STATUS_MAP[row.status] ?? 'pending'
    const finishedAt = row.finishedAt?.toISOString()
    return {
      id: `taskrun-${row.id}`,           // 前缀避免与 crawler UUID / bull-{queue}-{jobId} 冲突，供 -C parseTaskId 分派
      title: row.title,
      status,
      startedAt,
      ...(finishedAt !== undefined && { finishedAt }),
      ...(row.error != null && { errorMessage: row.error }),
      ...(row.digest != null && { digest: row.digest }),
      ...(row.progress != null && { progress: row.progress }),
    }
  }

  private mapCrawlerRun(row: CrawlerRunRow): AdminTaskItem {
    const startedAt = (row.started_at ?? row.created_at).toISOString()
    const status = STATUS_MAP[row.status] ?? 'pending'
    const finishedAt = row.finished_at?.toISOString()
    const summaryError = FAILED_STATUSES.has(row.status)
      ? (row.summary as { error?: unknown } | null)?.error
      : undefined
    const errorMessage = FAILED_STATUSES.has(row.status)
      ? typeof summaryError === 'string' ? summaryError : 'Crawl failed'
      : undefined
    // ADR-193 D-193-4 path A：从已落库 summary 投影结构化 digest（纯只读，零 schema 变更）
    const digest = buildTaskResultDigest(row.summary)
    return {
      id: row.id,
      title: `${row.crawl_mode} crawl (${row.trigger_type})`,
      status,
      startedAt,
      ...(finishedAt !== undefined && { finishedAt }),
      ...(errorMessage !== undefined && { errorMessage }),
      ...(digest !== undefined && { digest }),
    }
  }

  /**
   * 取 bull queue 计数供任务闪电 running 计数（§4.1）。R-147-3 缓解：Redis 不可用降级 degraded=true。
   * 副源 items 已切 task_runs（D-194-5），本方法不再 getActive 拉取 job 明细，仅 getJobCounts。
   */
  private async fetchQueueCounts(): Promise<{ queueCounts: AdminQueueCounts; degraded: boolean }> {
    try {
      const [cCounts, mCounts] = await Promise.all([
        crawlerQueue.getJobCounts(),
        maintenanceQueue.getJobCounts(),
      ])
      return {
        queueCounts: {
          crawler: { waiting: cCounts.waiting, active: cCounts.active },
          maintenance: { waiting: mCounts.waiting, active: mCounts.active },
        },
        degraded: false,
      }
    } catch {
      return {
        queueCounts: {
          crawler: { waiting: 0, active: 0 },
          maintenance: { waiting: 0, active: 0 },
        },
        degraded: true,
      }
    }
  }
}
