/**
 * dashboardOverview.ts — Dashboard overview 数据聚合（ADR-127 / CHG-SN-7-MISC-DASHBOARD-2）
 *
 * 端点消费：GET /admin/dashboard/overview
 *
 * 聚合策略：
 *   - video counts: 单 SQL 4 COUNT FILTER（一次扫描，避免 4 次独立 SELECT）
 *   - source reachability: 单 SQL COUNT FILTER（一次扫描 video_sources）
 *   - today collected: 复用 crawlerKpi.ts 的 result.videosUpserted 逻辑
 *   - 无 UI 字段（color / dataSource / sparkData），消费方自行映射
 */

import type { Pool } from 'pg'
import type {
  DashboardKpiSnapshot,
  DashboardWorkflowSegment,
  DashboardOverviewPayload,
} from '@/types'

// ── DB 行类型 ─────────────────────────────────────────────────────

interface VideoCountsRow {
  video_total: string
  pending_count: string
  staging_count: string
  published_count: string
}

interface SourceRow {
  active_count: string
  total_count: string
  inactive_count: string
}

interface CollectedRow {
  collected_today: string
  collected_yesterday: string
}

// ── SQL ───────────────────────────────────────────────────────────

const VIDEO_COUNTS_SQL = `
SELECT
  COUNT(*)                                                                             AS video_total,
  COUNT(*) FILTER (WHERE review_status = 'pending_review')                            AS pending_count,
  COUNT(*) FILTER (WHERE review_status = 'approved'
                     AND visibility_status = 'internal'
                     AND is_published = false)                                         AS staging_count,
  COUNT(*) FILTER (WHERE is_published = true)                                         AS published_count
FROM videos
WHERE deleted_at IS NULL
`

const SOURCE_SQL = `
SELECT
  COUNT(*) FILTER (WHERE is_active = true)  AS active_count,
  COUNT(*)                                  AS total_count,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive_count
FROM video_sources
WHERE deleted_at IS NULL
`

const COLLECTED_SQL = `
SELECT
  COALESCE(SUM(
    CASE WHEN (result ->> 'videosUpserted') ~ '^[0-9]+$'
         THEN (result ->> 'videosUpserted')::bigint ELSE 0 END
  ) FILTER (WHERE scheduled_at >= date_trunc('day', NOW())), 0)          AS collected_today,
  COALESCE(SUM(
    CASE WHEN (result ->> 'videosUpserted') ~ '^[0-9]+$'
         THEN (result ->> 'videosUpserted')::bigint ELSE 0 END
  ) FILTER (WHERE scheduled_at >= date_trunc('day', NOW() - INTERVAL '1 day')
               AND scheduled_at <  date_trunc('day', NOW())), 0)         AS collected_yesterday
FROM crawler_tasks
WHERE status = 'done'
  AND type IN ('full-crawl', 'incremental-crawl')
  AND scheduled_at >= date_trunc('day', NOW() - INTERVAL '1 day')
`

// ── 格式化 helper ─────────────────────────────────────────────────

function fmtNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function deltaDir(diff: number): 'up' | 'down' | 'flat' {
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'flat'
}

function deltaSign(diff: number): string {
  if (diff > 0) return `↑ +${fmtNumber(diff)}`
  if (diff < 0) return `↓ ${fmtNumber(diff)}`
  return '→ 持平'
}

// ── 主查询函数 ─────────────────────────────────────────────────────

export async function getDashboardOverview(db: Pool): Promise<DashboardOverviewPayload> {
  const [vcRes, srcRes, colRes] = await Promise.all([
    db.query<VideoCountsRow>(VIDEO_COUNTS_SQL),
    db.query<SourceRow>(SOURCE_SQL),
    db.query<CollectedRow>(COLLECTED_SQL),
  ])

  const vc = vcRes.rows[0]
  const src = srcRes.rows[0]
  const col = colRes.rows[0]

  const videoTotal = parseInt(vc?.video_total ?? '0')
  const pendingCount = parseInt(vc?.pending_count ?? '0')
  const stagingCount = parseInt(vc?.staging_count ?? '0')
  const publishedCount = parseInt(vc?.published_count ?? '0')

  const activeCount = parseInt(src?.active_count ?? '0')
  const totalCount = parseInt(src?.total_count ?? '0')
  const inactiveCount = parseInt(src?.inactive_count ?? '0')
  const reachableRate = totalCount > 0 ? (activeCount / totalCount) * 100 : 0

  const collectedToday = parseInt(col?.collected_today ?? '0')
  const collectedYesterday = parseInt(col?.collected_yesterday ?? '0')
  const collectedDelta = collectedToday - collectedYesterday

  // ── KPI 派生 ─────────────────────────────────────────────────────

  const kpis: DashboardKpiSnapshot[] = [
    {
      key: 'videoTotal',
      value: fmtNumber(videoTotal),
      deltaText: `${deltaSign(collectedDelta)} 今日`,
      deltaDirection: deltaDir(collectedDelta),
      variant: 'default',
    },
    {
      key: 'pendingStaging',
      value: `${fmtNumber(pendingCount)} / ${fmtNumber(stagingCount)}`,
      deltaText: pendingCount > 100 ? `待审 ${fmtNumber(pendingCount)} 堆积` : '待审正常',
      deltaDirection: pendingCount > 100 ? 'up' : 'flat',
      variant: pendingCount > 200 ? 'is-danger' : pendingCount > 50 ? 'is-warn' : 'default',
    },
    {
      key: 'sourceReachableRate',
      value: `${reachableRate.toFixed(1)}%`,
      deltaText: reachableRate >= 95 ? '↑ 健康' : reachableRate >= 80 ? '→ 一般' : '↓ 告警',
      deltaDirection: reachableRate >= 95 ? 'up' : reachableRate >= 80 ? 'flat' : 'down',
      variant: reachableRate >= 95 ? 'is-ok' : reachableRate >= 80 ? 'is-warn' : 'is-danger',
    },
    {
      key: 'inactiveSources',
      value: fmtNumber(inactiveCount),
      deltaText: inactiveCount < 100 ? '↓ 较少' : inactiveCount < 1000 ? '→ 一般' : '↑ 偏多',
      deltaDirection: inactiveCount < 100 ? 'down' : inactiveCount < 1000 ? 'flat' : 'up',
      variant: inactiveCount < 100 ? 'default' : inactiveCount < 1000 ? 'is-warn' : 'is-danger',
    },
  ]

  // ── Workflow 4 段 ─────────────────────────────────────────────────

  const workflow: DashboardWorkflowSegment[] = [
    { key: 'collected', current: collectedToday, total: Math.max(collectedToday, 200) },
    { key: 'pendingReview', current: pendingCount, total: Math.max(pendingCount, 600) },
    { key: 'staging', current: stagingCount, total: Math.max(stagingCount, 50) },
    { key: 'published', current: publishedCount, total: Math.max(publishedCount, videoTotal) },
  ]

  return {
    kpis,
    workflow,
    generatedAt: new Date().toISOString(),
  }
}
