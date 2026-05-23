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
import type { AdminTaskItem, AdminQueueCounts } from '@resovo/types'
import { crawlerQueue, maintenanceQueue } from '@/api/lib/queue'

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
    return {
      id: row.id,
      title: `${row.crawl_mode} crawl (${row.trigger_type})`,
      status,
      startedAt,
      ...(finishedAt !== undefined && { finishedAt }),
      ...(errorMessage !== undefined && { errorMessage }),
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
