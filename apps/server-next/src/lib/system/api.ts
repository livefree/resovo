/**
 * system/api.ts — /admin/system/* 视图 API 客户端（CHG-SN-6-03+）
 *
 * 端点（allowlist 豁免；v1 时代 IMG / siteConfig 等卡落地）：
 *   GET /admin/system/scheduler-status     — 4 maintenance schedulers + 全局开关
 *   后续扩展：GET/POST settings / config / cache 等
 */

import { apiClient } from '@/lib/api-client'

export interface SchedulerInfo {
  readonly name: string
  readonly enabled: boolean
  readonly intervalMs: number
}

export interface SchedulerStatusResult {
  readonly enabled: boolean
  readonly schedulers: readonly SchedulerInfo[]
}

export async function getSchedulerStatus(): Promise<SchedulerStatusResult> {
  const result = await apiClient.get<{ data: SchedulerStatusResult }>('/admin/system/scheduler-status')
  return result.data
}
