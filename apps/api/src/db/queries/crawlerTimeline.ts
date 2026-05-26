/**
 * crawlerTimeline.ts — Crawler 重做实时任务时间轴聚合（CHG-SN-7-REDO-01-B / ADR-122）
 *
 * 真源：ADR-122 §"SQL 聚合策略 — /timeline SQL 草案"
 *       ADR-153 §5（TIMELINE_SQL_V2）+ §4（status 4 态）
 *
 * 端点消费：GET /admin/crawler/timeline?range=1h&limit=8
 *
 * 数据语义（ADR-153 改动）：
 *   - 每站最多 LANE_LIMIT=3 条 task（rn≤3，ROW_NUMBER 取最新）
 *   - 双层排序：站间 DENSE_RANK (site_ord)，站内 rn ASC
 *   - status 4 态：ok / warn / danger / neutral
 *   - pending 起点：GREATEST(COALESCE(started_at, scheduled_at), NOW()-interval)
 *   - health N+1 消除：CTE 一次扫描
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
  readonly status: 'ok' | 'warn' | 'danger' | 'neutral'
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
  scheduled_at: Date
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

/** D-153-1：每站最多显示的 lane 数（N=3） */
const LANE_LIMIT = 3

/**
 * TIMELINE_SQL_V2 — ADR-153 §5 完整草案
 *
 * 参数：
 *   $1 = range interval（如 '1 hour'）
 *   $2 = 站数上限（safeLimit，默认 8）
 *   $3 = 每站 lane 上限（LANE_LIMIT=3）
 */
const TIMELINE_SQL_V2 = `
WITH ranked_tasks AS (
  SELECT
    ct.source_site,
    cs.name AS site_name,
    ct.scheduled_at,
    ct.started_at,
    ct.finished_at,
    ct.status,
    ct.result,
    ROW_NUMBER() OVER (
      PARTITION BY ct.source_site
      ORDER BY COALESCE(ct.started_at, ct.scheduled_at) DESC
    ) AS rn
  FROM crawler_tasks ct
  JOIN crawler_sites cs ON cs.key = ct.source_site
  WHERE ct.type IN ('full-crawl', 'incremental-crawl')
    -- CHG-SN-9-CW1-CW2-HOTFIX-A Step 2：
    --   原 WHERE 用 scheduled_at >= NOW() - $1::interval 会把"早于窗口左端 scheduled，
    --   但在窗口内 finished/running 的 task"全砍掉（违反 ADR-153 §"显示窗口内有可见时段
    --   的 task"语义）。改用 COALESCE(finished_at, NOW())：未结束的取 NOW（永远在窗口
    --   右端可见），已结束的取 finished_at（在窗口内即可见）。
    AND COALESCE(ct.finished_at, NOW()) >= NOW() - $1::interval
    -- status 加 'pending'（与 ADR-153 §5 "pending 起点 GREATEST(COALESCE(started_at,
    -- scheduled_at), ...)" 决策对齐；原代码漏了 pending 导致刚 enqueue 未启动的 task
    -- 完全不显示，"刷新后任务消失"症状的核心成因之一）
    AND ct.status IN ('pending', 'running', 'done', 'failed', 'paused', 'cancelled', 'timeout')
),
site_rank AS (
  SELECT
    source_site,
    DENSE_RANK() OVER (
      ORDER BY
        MAX(CASE WHEN status = 'running' THEN 0 ELSE 1 END),
        MAX(COALESCE(started_at, scheduled_at)) DESC
    ) AS site_ord
  FROM ranked_tasks
  GROUP BY source_site
),
health_cte AS (
  SELECT
    source_site,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'done' AND rn_h <= 5)
            / NULLIF(COUNT(*) FILTER (WHERE rn_h <= 5), 0)
    )::int AS health
  FROM (
    SELECT
      source_site,
      status,
      ROW_NUMBER() OVER (PARTITION BY source_site ORDER BY scheduled_at DESC) AS rn_h
    FROM crawler_tasks
    WHERE type IN ('full-crawl', 'incremental-crawl')
  ) h
  GROUP BY source_site
)
SELECT
  rt.source_site,
  rt.site_name,
  rt.scheduled_at,
  GREATEST(COALESCE(rt.started_at, rt.scheduled_at), NOW() - $1::interval) AS started_at,
  COALESCE(rt.finished_at, NOW()) AS effective_end,
  rt.status,
  rt.result,
  COALESCE(h.health, 0)::text AS health
FROM ranked_tasks rt
JOIN site_rank sr ON sr.source_site = rt.source_site
LEFT JOIN health_cte h ON h.source_site = rt.source_site
WHERE sr.site_ord <= $2
  AND rt.rn <= $3
ORDER BY
  sr.site_ord ASC,
  rt.rn ASC
`

/** ADR-153 D-153-2：status 4 态映射（含 R-153-3 timeout→danger 修复） */
function statusToCategory(raw: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (raw === 'done' || raw === 'running') return 'ok'
  if (raw === 'failed' || raw === 'timeout') return 'danger'   // R-153-3：timeout 补归 danger
  if (raw === 'paused' || raw === 'cancelled') return 'neutral'
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

  const result = await db.query<TimelineRawRow>(TIMELINE_SQL_V2, [interval, safeLimit, LANE_LIMIT])

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
