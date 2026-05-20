/**
 * dashboardAnalytics.ts — Dashboard analytics tab 专用聚合（ADR-127 / CHG-SN-7-MISC-DASHBOARD-2）
 *
 * 端点消费：GET /admin/dashboard/analytics?period=7d|30d|90d
 *
 * 聚合策略：
 *   - KPI：复用 getDashboardOverview 数据（+ period-specific delta）
 *   - collectTimeline：crawler_tasks 按日聚合 videosUpserted（period 天窗口）
 *   - sourceTypeDistribution：video_sources.type GROUP BY（当前快照）
 *   - recentTasks：最近 20 条 crawler_tasks（跨 period）
 */

import type { Pool } from 'pg'
import type {
  DashboardTimelinePoint,
  DashboardSourceTypeStat,
  DashboardCrawlerRunBrief,
} from '@/types'

export type AnalyticsPeriod = '7d' | '30d' | '90d'

// ── DB 行类型 ─────────────────────────────────────────────────────

interface TimelineRow {
  date: string
  count: string
}

interface SourceTypeRow {
  type: string
  cnt: string
  total: string
}

interface RecentTaskRow {
  id: string
  source_site: string
  status: string
  started_at: string | null
  finished_at: string | null
  result: { videosUpserted?: number; sourcesUpserted?: number; durationMs?: number } | null
}

// ── SQL ───────────────────────────────────────────────────────────

function periodDays(period: AnalyticsPeriod): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90
}

function collectTimelineSql(days: number): string {
  return `
SELECT
  gs::date AS date,
  COALESCE(c.cnt, 0)::text AS count
FROM generate_series(
  (NOW()::date - (${days} - 1) * INTERVAL '1 day'),
  NOW()::date,
  INTERVAL '1 day'
) AS gs
LEFT JOIN (
  SELECT
    date_trunc('day', scheduled_at)::date AS d,
    COALESCE(SUM(
      CASE WHEN (result ->> 'videosUpserted') ~ '^[0-9]+$'
           THEN (result ->> 'videosUpserted')::bigint ELSE 0 END
    ), 0) AS cnt
  FROM crawler_tasks
  WHERE status = 'done'
    AND type IN ('full-crawl', 'incremental-crawl')
    AND scheduled_at >= NOW()::date - (${days} - 1) * INTERVAL '1 day'
  GROUP BY 1
) AS c ON c.d = gs::date
ORDER BY 1
`
}

const SOURCE_TYPE_SQL = `
SELECT
  COALESCE(type, '其他') AS type,
  COUNT(*)::text AS cnt,
  SUM(COUNT(*)) OVER ()::text AS total
FROM video_sources
WHERE deleted_at IS NULL
GROUP BY 1
ORDER BY COUNT(*) DESC
LIMIT 10
`

const RECENT_TASKS_SQL = `
SELECT
  id,
  source_site,
  status,
  started_at,
  finished_at,
  result
FROM crawler_tasks
WHERE type IN ('full-crawl', 'incremental-crawl')
ORDER BY COALESCE(started_at, scheduled_at) DESC
LIMIT 20
`

// ── 主查询函数 ─────────────────────────────────────────────────────

export async function getDashboardAnalyticsData(
  db: Pool,
  period: AnalyticsPeriod,
): Promise<{
  collectTimeline: DashboardTimelinePoint[]
  sourceTypeDistribution: DashboardSourceTypeStat[]
  recentTasks: DashboardCrawlerRunBrief[]
}> {
  const days = periodDays(period)

  const [tlRes, stRes, rtRes] = await Promise.all([
    db.query<TimelineRow>(collectTimelineSql(days)),
    db.query<SourceTypeRow>(SOURCE_TYPE_SQL),
    db.query<RecentTaskRow>(RECENT_TASKS_SQL),
  ])

  const collectTimeline: DashboardTimelinePoint[] = tlRes.rows.map((r) => ({
    date: r.date,
    count: parseInt(r.count),
  }))

  const total = parseInt(stRes.rows[0]?.total ?? '0')
  const sourceTypeDistribution: DashboardSourceTypeStat[] = stRes.rows.map((r) => ({
    type: r.type,
    count: parseInt(r.cnt),
    pct: total > 0 ? Math.round((parseInt(r.cnt) / total) * 1000) / 10 : 0,
  }))

  const recentTasks: DashboardCrawlerRunBrief[] = rtRes.rows.map((r) => {
    const result = r.result ?? {}
    const videosUpserted = result.videosUpserted ?? 0
    const sourcesUpserted = result.sourcesUpserted ?? 0
    const durationMs = result.durationMs ?? null

    let status: DashboardCrawlerRunBrief['status'] = 'ok'
    let statusLabel = '成功'
    if (r.status === 'failed' || r.status === 'timeout') {
      status = 'danger'
      statusLabel = r.status === 'timeout' ? '超时' : '失败'
    } else if (r.status === 'running' || r.status === 'pending') {
      status = 'warn'
      statusLabel = '运行中'
    } else if (r.status === 'cancelled') {
      status = 'warn'
      statusLabel = '已取消'
    }

    return {
      id: r.id,
      site: r.source_site,
      status,
      statusLabel,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      videosUpserted,
      sourcesUpserted,
      durationSeconds: durationMs !== null ? Math.round(durationMs / 1000) : null,
    }
  })

  return { collectTimeline, sourceTypeDistribution, recentTasks }
}
