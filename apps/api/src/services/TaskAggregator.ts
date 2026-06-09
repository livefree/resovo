/**
 * TaskAggregator.ts — admin Shell 任务面板聚合（ADR-147）
 *
 * 数据源（D-147-3 方案 C 有主次）：
 *   主源：crawler_runs 表（最近 N 条按 created_at DESC，可配 since 窗口）
 *   副源：bull queue active jobs（crawlerQueue + maintenanceQueue 仅 active 状态）
 *   合并去重：CrawlerRun 优先（业务语义更丰富）；bull id 加 `bull-${queueName}-` 前缀避免冲突
 *
 * R-147-3 缓解：bull queue 调用 try-catch 降级 — Redis 不可用时仅返回 CrawlerRun 数据 + degraded=true
 */

import type { Pool } from 'pg'
import type { AdminTaskItem, AdminQueueCounts, TaskResultDigest, TaskMetric } from '@resovo/types'
import { crawlerQueue, maintenanceQueue } from '@/api/lib/queue'

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

    const { bullItems, queueCounts, degraded } = await this.fetchBullSnapshot()

    const merged = [...crawlerItems, ...bullItems]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, params.limit)

    return {
      items: merged,
      total: merged.length,
      queueCounts,
      degraded,
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

  private async fetchBullSnapshot(): Promise<{
    bullItems: AdminTaskItem[]
    queueCounts: AdminQueueCounts
    degraded: boolean
  }> {
    try {
      const [cCounts, mCounts, cActive, mActive] = await Promise.all([
        crawlerQueue.getJobCounts(),
        maintenanceQueue.getJobCounts(),
        crawlerQueue.getActive(0, 9),
        maintenanceQueue.getActive(0, 9),
      ])
      const bullItems: AdminTaskItem[] = [
        ...cActive.map((job) => this.mapBullJob('crawler', job)),
        ...mActive.map((job) => this.mapBullJob('maintenance', job)),
      ]
      return {
        bullItems,
        queueCounts: {
          crawler: { waiting: cCounts.waiting, active: cCounts.active },
          maintenance: { waiting: mCounts.waiting, active: mCounts.active },
        },
        degraded: false,
      }
    } catch {
      return {
        bullItems: [],
        queueCounts: {
          crawler: { waiting: 0, active: 0 },
          maintenance: { waiting: 0, active: 0 },
        },
        degraded: true,
      }
    }
  }

  private mapBullJob(
    queueName: 'crawler' | 'maintenance',
    job: { id: number | string; progress?: () => number | object; processedOn?: number },
  ): AdminTaskItem {
    const startedAt = job.processedOn
      ? new Date(job.processedOn).toISOString()
      : new Date().toISOString()
    let progress: number | undefined
    if (typeof job.progress === 'function') {
      const raw = job.progress()
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        progress = Math.max(0, Math.min(100, raw))
      }
    }
    const item: AdminTaskItem = {
      id: `bull-${queueName}-${job.id}`,
      title: `${queueName} queue job`,
      status: 'running',
      startedAt,
    }
    return progress !== undefined ? { ...item, progress } : item
  }
}
