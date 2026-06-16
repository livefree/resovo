/**
 * dashboard/api.ts — Dashboard 数据层 API 客户端（ADR-127 / CHG-SN-7-MISC-DASHBOARD-2）
 *
 * 消费端点：
 *   GET /v1/admin/dashboard/overview   — KPI×4 + workflow×4
 *   GET /v1/admin/dashboard/spark      — 历史 spark 序列
 *   GET /v1/admin/dashboard/analytics  — Analytics tab 专用
 */

import { apiClient } from '@/lib/api-client'
import type {
  DashboardOverviewPayload,
  DashboardSparkPoint,
  DashboardAnalyticsPayload,
  DashboardActivityRow,
  AdminQueueCounts,
} from '@resovo/types'

export type { DashboardOverviewPayload, DashboardSparkPoint, DashboardAnalyticsPayload, DashboardActivityRow }
export type { AdminQueueCounts }

export type SparkMetric = 'videoTotal' | 'pendingStaging' | 'sourceReachableRate' | 'inactiveSources'
export type AnalyticsPeriod = '7d' | '30d' | '90d'

export async function getDashboardOverview(): Promise<DashboardOverviewPayload> {
  const res = await apiClient.get<{ data: DashboardOverviewPayload }>('/admin/dashboard/overview')
  return res.data
}

export async function getDashboardSpark(
  metric: SparkMetric,
  days = 7,
): Promise<{ metric: string; points: DashboardSparkPoint[] }> {
  const res = await apiClient.get<{ data: { metric: string; points: DashboardSparkPoint[] } }>(
    `/admin/dashboard/spark?metric=${metric}&days=${days}`,
  )
  return res.data
}

export async function getDashboardAnalytics(
  period: AnalyticsPeriod = '7d',
): Promise<DashboardAnalyticsPayload> {
  const res = await apiClient.get<{ data: DashboardAnalyticsPayload }>(
    `/admin/dashboard/analytics?period=${period}`,
  )
  return res.data
}

// ADR-141 / CHG-SN-8-FUP-DASH-ACTIVITY-LIVE：dashboard 活动时序真端点
// 后端 60s TTL Map 缓存；前端无需自管缓存
export async function getDashboardActivities(limit = 10): Promise<readonly DashboardActivityRow[]> {
  const res = await apiClient.get<{ data: readonly DashboardActivityRow[] }>(
    `/admin/dashboard/activities?limit=${limit}`,
  )
  return res.data
}

// DASH-QUEUE-HEALTH-B：复用 ADR-147 `/admin/system/jobs` 的 meta.queueCounts（全 9 队列 + 4 计数，
// ADR-147 AMENDMENT）。limit=1 仅为取 meta（data 任务项卡片不消费）；degraded=Redis 不可用降级标记。
export async function getQueueHealth(): Promise<{ queueCounts: AdminQueueCounts; degraded: boolean }> {
  const res = await apiClient.get<{ meta: { queueCounts: AdminQueueCounts; degraded?: boolean } }>(
    '/admin/system/jobs?limit=1',
  )
  return { queueCounts: res.meta.queueCounts, degraded: res.meta.degraded ?? false }
}
