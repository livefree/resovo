/**
 * crawlerTimeline.ts — Crawler 重做实时任务时间轴聚合（CHG-SN-7-REDO-01-B / ADR-122）
 *
 * 真源：ADR-122 §"SQL 聚合策略 — /timeline SQL 草案"
 *
 * 端点消费：GET /admin/crawler/timeline?range=1h&limit=8
 *
 * 数据语义：
 *   - 按 site_key 聚合最近时间窗口内 1 个 task（ROW_NUMBER 取最新）
 *   - status='running' 优先排序 + started_at DESC
 *   - 百分比（startPct / widthPct）Node.js 层算术（避免 SQL 层浮点精度）
 *
 * 性能预期：< 50ms（crawler_tasks 日 < 2000 行）
 * Fallback：若 benchmark > 200ms，降级为 `DISTINCT ON (source_site)` PG 扩展语法（ADR-122 D-122-4）
 */

import type { Pool } from 'pg'

export type CrawlerTimelineRange = '30m' | '1h' | '2h' | '6h'

export interface CrawlerTimelineRow {
  readonly siteKey: string
  readonly siteName: string
  readonly health: number              // 0-100
  readonly startPct: number            // 0-1
  readonly widthPct: number            // 0-1
  readonly durationSeconds: number
  readonly videoCount: number
  readonly status: 'ok' | 'warn' | 'danger'
  readonly last: string                // ISO 8601
}

export interface CrawlerTimelineResponse {
  readonly rangeStart: string
  readonly rangeEnd: string
  readonly ticks: readonly string[]
  readonly rows: readonly CrawlerTimelineRow[]
}

interface TimelineRawRow {
  source_site: string
  site_name: string
  started_at: Date
  effective_end: Date
  status: string
  result: { videosUpserted?: number | string; durationMs?: number | string } | null
  /** 最近 5 次 task 成功率（health 0-100） */
  health: string
}

const RANGE_TO_INTERVAL: Record<CrawlerTimelineRange, string> = {
  '30m': '30 minutes',
  '1h':  '1 hour',
  '2h':  '2 hours',
  '6h':  '6 hours',
}

const RANGE_TO_MS: Record<CrawlerTimelineRange, number> = {
  '30m': 30 * 60_000,
  '1h':  60 * 60_000,
  '2h':  2 * 60 * 60_000,
  '6h':  6 * 60 * 60_000,
}

const TIMELINE_SQL = `
WITH ranked_tasks AS (
  SELECT
    ct.source_site,
    cs.name AS site_name,
    ct.started_at,
    ct.finished_at,
    ct.status,
    ct.result,
    ROW_NUMBER() OVER (PARTITION BY ct.source_site ORDER BY COALESCE(ct.started_at, ct.scheduled_at) DESC) AS rn
  FROM crawler_tasks ct
  JOIN crawler_sites cs ON cs.key = ct.source_site
  WHERE ct.type IN ('full-crawl', 'incremental-crawl')
    AND ct.scheduled_at >= NOW() - $1::interval
    AND ct.status IN ('running', 'done', 'failed')
)
SELECT
  rt.source_site,
  rt.site_name,
  COALESCE(rt.started_at, NOW() - $1::interval) AS started_at,
  COALESCE(rt.finished_at, NOW())               AS effective_end,
  rt.status,
  rt.result,
  COALESCE((
    SELECT ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::int
    FROM (
      SELECT status FROM crawler_tasks
      WHERE source_site = rt.source_site
        AND type IN ('full-crawl', 'incremental-crawl')
      ORDER BY scheduled_at DESC LIMIT 5
    ) recent
  ), 0)::text AS health
FROM ranked_tasks rt
WHERE rt.rn = 1
ORDER BY
  CASE WHEN rt.status = 'running' THEN 0 ELSE 1 END,
  rt.started_at DESC
LIMIT $2
`

function statusToCategory(raw: string): 'ok' | 'warn' | 'danger' {
  if (raw === 'done' || raw === 'running') return 'ok'
  if (raw === 'failed') return 'danger'
  return 'warn'
}

function computeTicks(rangeStart: Date, rangeEnd: Date, count = 6): string[] {
  const span = rangeEnd.getTime() - rangeStart.getTime()
  const step = span / (count - 1)
  return Array.from({ length: count }, (_, i) => new Date(rangeStart.getTime() + step * i).toISOString())
}

function rowToTimelineRow(
  row: TimelineRawRow,
  rangeStart: Date,
  rangeEndMs: number,
  rangeStartMs: number,
): CrawlerTimelineRow {
  const startMs = row.started_at.getTime()
  const endMs = row.effective_end.getTime()
  const span = rangeEndMs - rangeStartMs
  const clampedStart = Math.max(0, Math.min(1, (startMs - rangeStartMs) / span))
  const clampedWidth = Math.max(0.01, Math.min(1 - clampedStart, (endMs - startMs) / span))

  const videoCountRaw = row.result?.videosUpserted
  const videoCount = typeof videoCountRaw === 'number' ? videoCountRaw
    : typeof videoCountRaw === 'string' && /^[0-9]+$/.test(videoCountRaw) ? Number(videoCountRaw)
      : 0

  const durationMs = endMs - startMs

  return {
    siteKey: row.source_site,
    siteName: row.site_name,
    health: Number(row.health),
    startPct: clampedStart,
    widthPct: clampedWidth,
    durationSeconds: Math.round(durationMs / 1000),
    videoCount,
    status: statusToCategory(row.status),
    last: row.effective_end.toISOString(),
  }
}

export async function getCrawlerTimeline(
  db: Pool,
  range: CrawlerTimelineRange = '1h',
  limit = 8,
): Promise<CrawlerTimelineResponse> {
  const interval = RANGE_TO_INTERVAL[range]
  const rangeMs = RANGE_TO_MS[range]
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit)))

  const result = await db.query<TimelineRawRow>(TIMELINE_SQL, [interval, safeLimit])

  const rangeEnd = new Date()
  const rangeStart = new Date(rangeEnd.getTime() - rangeMs)
  const rangeStartMs = rangeStart.getTime()
  const rangeEndMs = rangeEnd.getTime()

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    ticks: computeTicks(rangeStart, rangeEnd),
    rows: result.rows.map((row) => rowToTimelineRow(row, rangeStart, rangeEndMs, rangeStartMs)),
  }
}
