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
} from '@resovo/types'

export type { DashboardOverviewPayload, DashboardSparkPoint, DashboardAnalyticsPayload }

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
