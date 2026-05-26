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

// ADR-155 D-155-3 / EP-3a：range 选项扩展 4 → 7
export type CrawlerTimelineRange = '30m' | '1h' | '2h' | '6h' | '12h' | '24h' | '7d'

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

// ADR-155 D-155-3 / EP-3a：range 扩展到 7 选项
const RANGE_TO_MS: Record<CrawlerTimelineRange, number> = {
  '30m': 30 * 60_000,
  '1h':  60 * 60_000,
  '2h':  2 * 60 * 60_000,
  '6h':  6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d':  7 * 24 * 60 * 60_000,
}

// ADR-155 D-155-3 / EP-3a：三段窗历史:未来 = 70:30 比例
const HISTORY_RATIO = 0.7
const FUTURE_RATIO = 0.3

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
  -- ADR-155 D-155-3 / EP-3a R-155-2：移除 D-153-4 GREATEST 钳值；保留 started_at 真实值
  -- JS 层 rowToTimelineRow 做双字段 clamp（durationSeconds 真实 + startPct/widthPct 可视化）
  COALESCE(rt.started_at, rt.scheduled_at) AS started_at,
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

/**
 * ADR-155 D-155-3 / EP-3a R-155-2 双字段语义：
 *
 * - `durationSeconds`（业务字段 / hover tooltip 显示）= **真实 task 持续时长**
 *   `(realEnd - realStart) / 1000`，与窗口位置无关。即使 task 实际跨越窗口 3 倍，
 *   tooltip 仍显示真实 "已运行 3 天" 等。
 *
 * - `startPct / widthPct`（可视化字段 / SVG 渲染位置）= **viewport 二次 clamp**：
 *   `visStart = max(realStart, rangeStartMs)` + `visEnd = min(realEnd, rangeEndMs)`
 *   保证 SVG bar 不溢出窗口；超出窗口的部分由 JS 层裁剪而非 SQL（D-153-4 GREATEST 已移除）。
 */
function rowToTimelineRow(
  row: TimelineRawRow,
  _rangeStart: Date,  // 保留签名兼容（旧调用方）
  rangeEndMs: number,
  rangeStartMs: number,
): CrawlerTimelineRow {
  // 真实业务值（pending bar 的 scheduled_at 可能远早于窗口左侧）
  const realStart = row.started_at.getTime()
  const realEnd = row.effective_end.getTime()
  const durationSeconds = Math.round((realEnd - realStart) / 1000)

  // 可视化 clamp（JS 层 viewport 二次 clamp，替代 D-153-4 SQL GREATEST）
  const visStart = Math.max(realStart, rangeStartMs)
  const visEnd = Math.min(realEnd, rangeEndMs)
  const span = rangeEndMs - rangeStartMs
  const startPct = Math.max(0, Math.min(1, (visStart - rangeStartMs) / span))
  const widthPct = Math.max(0.01, Math.min(1 - startPct, (visEnd - visStart) / span))

  const videoCountRaw = row.result?.videosUpserted
  const videoCount = typeof videoCountRaw === 'number' ? videoCountRaw
    : typeof videoCountRaw === 'string' && /^[0-9]+$/.test(videoCountRaw) ? Number(videoCountRaw)
      : 0

  return {
    siteKey: row.source_site,
    siteName: row.site_name,
    health: Number(row.health),
    startPct,
    widthPct,
    durationSeconds,
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
  const rangeMs = RANGE_TO_MS[range]
  // ADR-155 D-155-3 / EP-3a：三段窗 [NOW - rangeMs×0.7, NOW + rangeMs×0.3]
  // - 历史段 70%：已发生 task 占主要可视空间
  // - 未来段 30%：留 buffer 给即将触发的 pending / scheduler nextRun（now-line 居中偏右 70%）
  const historyMs = Math.round(rangeMs * HISTORY_RATIO)
  const futureMs = Math.round(rangeMs * FUTURE_RATIO)
  // SQL interval = historyMs / 1000 秒（精确取可视窗口左半部分数据，避免取多余的过去数据）
  const intervalSeconds = Math.round(historyMs / 1000)
  const interval = `${intervalSeconds} seconds`

  // ADR-155 D-155-4：safeLimit 上限 20→50（站数上限解锁），单 SQL 查询每站最多 LANE_LIMIT=3 task
  // = 最多 150 bar / 窗口；前端 UI 提供 8/20/全部 三档选择器，"全部" = 50 上限
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)))

  const result = await db.query<TimelineRawRow>(TIMELINE_SQL_V2, [interval, safeLimit, LANE_LIMIT])

  const now = new Date()
  const rangeStart = new Date(now.getTime() - historyMs)
  const rangeEnd = new Date(now.getTime() + futureMs)
  const rangeStartMs = rangeStart.getTime()
  const rangeEndMs = rangeEnd.getTime()

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    ticks: computeTicks(rangeStart, rangeEnd),
    rows: result.rows.map((row) => rowToTimelineRow(row, rangeStart, rangeEndMs, rangeStartMs)),
  }
}
