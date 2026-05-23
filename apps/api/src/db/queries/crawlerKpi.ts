/**
 * crawlerKpi.ts — Crawler 重做 KPI 5 列聚合（CHG-SN-7-REDO-01-B / ADR-122）
 *
 * 真源：ADR-122 §"SQL 聚合策略"（4 CTE + siteStats 子查询）
 *
 * 端点消费：GET /admin/crawler/kpi
 *
 * 数据语义：
 *   - totalSites / healthySites / failedSites：来自 crawler_sites 状态聚合
 *   - runningSites：来自 crawler_tasks 当前 running/pending 任务（5min 心跳窗口）
 *   - batchVideoCount / avgDurationSeconds：来自当日 crawler_tasks result.videosUpserted / durationMs
 *   - batchVideoDelta：今日 vs 昨日同时段差
 *   - siteStats：per-site routeCount（video_sources JOIN）+ health（最近 5 task 成功率）
 *
 * 注：siteStats LEFT JOIN video_sources 按 source_name = site.key 匹配；如未来 source_name
 *     语义演进为 source_line_aliases 表统计，需修改 JOIN 策略（ADR-122 §未来触发条件第 3 条）。
 */

import type { Pool } from 'pg'

export interface CrawlerSiteStat {
  readonly key: string
  readonly routeCount: number
  readonly health: number
}

export interface CrawlerKpiResponse {
  readonly totalSites: number
  readonly healthySites: number
  readonly runningSites: number
  readonly failedSites: number
  readonly batchVideoCount: number
  readonly batchVideoDelta: number
  readonly avgDurationSeconds: number
  readonly siteStats: readonly CrawlerSiteStat[]
}

interface KpiRow {
  total_sites: string
  healthy_sites: string
  running_sites: string
  failed_sites: string
  batch_video_count: string
  batch_video_delta: string
  avg_duration_seconds: string
}

interface SiteStatRow {
  key: string
  route_count: string
  health: string
}

const KPI_SQL = `
WITH site_counts AS (
  SELECT
    COUNT(*)::text AS total_sites,
    SUM(CASE WHEN NOT disabled AND last_crawl_status = 'ok' THEN 1 ELSE 0 END)::text AS healthy_sites,
    SUM(CASE WHEN last_crawl_status = 'failed' THEN 1 ELSE 0 END)::text AS failed_sites
  FROM crawler_sites
),
running_count AS (
  SELECT
    COUNT(
      DISTINCT CASE
        WHEN status = 'pending' AND scheduled_at >= NOW() - INTERVAL '10 minute' THEN source_site
        WHEN status = 'running' AND COALESCE(heartbeat_at, scheduled_at) >= NOW() - INTERVAL '5 minute' THEN source_site
        ELSE NULL
      END
    )::text AS running_sites
  FROM crawler_tasks
  WHERE status IN ('pending', 'running')
    AND type IN ('full-crawl', 'incremental-crawl')
),
today_tasks AS (
  SELECT
    COALESCE(SUM(
      CASE WHEN (result ->> 'videosUpserted') ~ '^[0-9]+$'
           THEN (result ->> 'videosUpserted')::bigint ELSE 0 END
    ), 0)::text AS batch_video_count,
    COALESCE(AVG(
      CASE WHEN status = 'done' AND (result ->> 'durationMs') ~ '^[0-9]+$'
           THEN (result ->> 'durationMs')::bigint / 1000.0 END
    ), 0)::text AS avg_duration_seconds
  FROM crawler_tasks
  WHERE status IN ('running', 'done')
    AND type IN ('full-crawl', 'incremental-crawl')
    AND scheduled_at >= date_trunc('day', NOW())
),
yesterday_tasks AS (
  SELECT
    COALESCE(SUM(
      CASE WHEN (result ->> 'videosUpserted') ~ '^[0-9]+$'
           THEN (result ->> 'videosUpserted')::bigint ELSE 0 END
    ), 0)::bigint AS yesterday_count
  FROM crawler_tasks
  WHERE status = 'done'
    AND type IN ('full-crawl', 'incremental-crawl')
    AND scheduled_at >= date_trunc('day', NOW() - INTERVAL '1 day')
    AND scheduled_at <  date_trunc('day', NOW())
)
SELECT
  COALESCE(site_counts.total_sites, '0')                AS total_sites,
  COALESCE(site_counts.healthy_sites, '0')              AS healthy_sites,
  COALESCE(running_count.running_sites, '0')            AS running_sites,
  COALESCE(site_counts.failed_sites, '0')               AS failed_sites,
  COALESCE(today_tasks.batch_video_count, '0')          AS batch_video_count,
  (
    COALESCE(today_tasks.batch_video_count::bigint, 0)
    - COALESCE(yesterday_tasks.yesterday_count, 0)
  )::text                                                AS batch_video_delta,
  COALESCE(today_tasks.avg_duration_seconds, '0')       AS avg_duration_seconds
FROM site_counts, running_count, today_tasks, yesterday_tasks
`

const SITE_STATS_SQL = `
SELECT
  cs.key,
  COALESCE(rc.route_count, 0)::text AS route_count,
  COALESCE(ts.health, 0)::text      AS health
FROM crawler_sites cs
LEFT JOIN (
  SELECT source_name, COUNT(DISTINCT source_name)::int AS route_count
  FROM video_sources
  WHERE deleted_at IS NULL
  GROUP BY source_name
) rc ON rc.source_name = cs.key
LEFT JOIN LATERAL (
  SELECT
    ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::int AS health
  FROM (
    SELECT status FROM crawler_tasks
    WHERE source_site = cs.key
      AND type IN ('full-crawl', 'incremental-crawl')
    ORDER BY scheduled_at DESC
    LIMIT 5
  ) recent
) ts ON true
ORDER BY cs.key
`

function rowToKpi(row: KpiRow, siteStats: readonly CrawlerSiteStat[]): CrawlerKpiResponse {
  return {
    totalSites: Number(row.total_sites),
    healthySites: Number(row.healthy_sites),
    runningSites: Number(row.running_sites),
    failedSites: Number(row.failed_sites),
    batchVideoCount: Number(row.batch_video_count),
    batchVideoDelta: Number(row.batch_video_delta),
    avgDurationSeconds: Number(row.avg_duration_seconds),
    siteStats,
  }
}

function rowToSiteStat(row: SiteStatRow): CrawlerSiteStat {
  return {
    key: row.key,
    routeCount: Number(row.route_count),
    health: Number(row.health),
  }
}

export async function getCrawlerKpi(db: Pool): Promise<CrawlerKpiResponse> {
  const [kpiResult, siteStatsResult] = await Promise.all([
    db.query<KpiRow>(KPI_SQL),
    db.query<SiteStatRow>(SITE_STATS_SQL),
  ])
  const kpiRow = kpiResult.rows[0]
  if (!kpiRow) {
    return {
      totalSites: 0, healthySites: 0, runningSites: 0, failedSites: 0,
      batchVideoCount: 0, batchVideoDelta: 0, avgDurationSeconds: 0,
      siteStats: [],
    }
  }
  return rowToKpi(kpiRow, siteStatsResult.rows.map(rowToSiteStat))
}
