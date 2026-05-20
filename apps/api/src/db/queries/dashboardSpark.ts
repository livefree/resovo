/**
 * dashboardSpark.ts — Dashboard KPI 历史 spark 数据查询（ADR-127 / CHG-SN-7-MISC-DASHBOARD-2）
 *
 * 端点消费：GET /admin/dashboard/spark?metric=&days=
 *
 * 实现策略（ADR-127 D-127-2 实时聚合，触发 ADR-127a 时再建快照表）：
 *   - videoTotal: generate_series + COUNT 子查询（累计总量 per day）
 *   - pendingStaging: 每日新入库视频数（趋势代理）
 *   - sourceReachableRate: 每日抽样当前比率（无历史表，填充当前值）
 *   - inactiveSources: 每日失效源增量（创建于当天）
 *
 * 触发 ADR-127a 条件：单 spark 请求 P95 > 200ms（监控指标）。
 */

import type { Pool } from 'pg'
import type { DashboardSparkPoint } from '@/types'

type SparkMetric = 'videoTotal' | 'pendingStaging' | 'sourceReachableRate' | 'inactiveSources'

interface DayRow {
  date: string
  value: string
}

// ── 各 metric SQL ─────────────────────────────────────────────────

function videoTotalSql(days: number): string {
  return `
SELECT
  gs::date AS date,
  (
    SELECT COUNT(*) FROM videos
    WHERE created_at < gs + INTERVAL '1 day'
      AND deleted_at IS NULL
  )::text AS value
FROM generate_series(
  (NOW()::date - ($1 - 1) * INTERVAL '1 day'),
  NOW()::date,
  INTERVAL '1 day'
) AS gs
ORDER BY 1
LIMIT ${days}
`
}

function pendingStagingSql(): string {
  return `
SELECT
  gs::date AS date,
  COALESCE(c.cnt, 0)::text AS value
FROM generate_series(
  (NOW()::date - ($1 - 1) * INTERVAL '1 day'),
  NOW()::date,
  INTERVAL '1 day'
) AS gs
LEFT JOIN (
  SELECT date_trunc('day', created_at)::date AS d, COUNT(*) AS cnt
  FROM videos
  WHERE created_at >= (NOW()::date - ($1 - 1) * INTERVAL '1 day')
    AND deleted_at IS NULL
  GROUP BY 1
) AS c ON c.d = gs::date
ORDER BY 1
`
}

function sourceReachableRateSql(): string {
  return `
SELECT
  gs::date AS date,
  ROUND(
    (SELECT COUNT(*) FILTER (WHERE is_active = true)::numeric / NULLIF(COUNT(*), 0) * 100
     FROM video_sources WHERE deleted_at IS NULL),
  1)::text AS value
FROM generate_series(
  (NOW()::date - ($1 - 1) * INTERVAL '1 day'),
  NOW()::date,
  INTERVAL '1 day'
) AS gs
ORDER BY 1
`
}

function inactiveSourcesSql(): string {
  return `
SELECT
  gs::date AS date,
  COALESCE(c.cnt, 0)::text AS value
FROM generate_series(
  (NOW()::date - ($1 - 1) * INTERVAL '1 day'),
  NOW()::date,
  INTERVAL '1 day'
) AS gs
LEFT JOIN (
  SELECT date_trunc('day', created_at)::date AS d, COUNT(*) AS cnt
  FROM video_sources
  WHERE created_at >= (NOW()::date - ($1 - 1) * INTERVAL '1 day')
    AND is_active = false
    AND deleted_at IS NULL
  GROUP BY 1
) AS c ON c.d = gs::date
ORDER BY 1
`
}

// ── 主查询函数 ────────────────────────────────────────────────────

export async function getDashboardSpark(
  db: Pool,
  metric: SparkMetric,
  days: number,
): Promise<DashboardSparkPoint[]> {
  let sql: string
  switch (metric) {
    case 'videoTotal':         sql = videoTotalSql(days); break
    case 'pendingStaging':     sql = pendingStagingSql(); break
    case 'sourceReachableRate': sql = sourceReachableRateSql(); break
    case 'inactiveSources':    sql = inactiveSourcesSql(); break
  }

  const res = await db.query<DayRow>(sql, [days])
  return res.rows.map((r) => ({
    date: r.date,
    value: parseFloat(r.value),
  }))
}
