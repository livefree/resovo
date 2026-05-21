/**
 * crawlerTasks.types.ts — crawler_tasks 共享类型与映射函数
 * 从 crawlerTasks.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 * 本文件供 crawlerTasks.ts 和 crawlerTasks.queries.ts 引用。
 */

// ── 公开类型 ──────────────────────────────────────────────────────

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

// ── 内部 DB 行类型 ────────────────────────────────────────────────

export interface DbCrawlerTaskRow {
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

export function mapTask(row: DbCrawlerTaskRow): CrawlerTask {
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
