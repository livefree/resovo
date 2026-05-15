/**
 * system/api.ts — /admin/system/* 视图 API 客户端（CHG-SN-6-03+）
 *
 * 端点（allowlist 豁免；v1 时代 IMG / siteConfig 等卡落地）：
 *   GET /admin/system/scheduler-status     — 4 maintenance schedulers + 全局开关（CHG-SN-6-03）
 *   GET /admin/cache/stats                 — 各类型缓存统计（CHG-SN-6-04）
 *   DELETE /admin/cache/:type              — 清除指定类型缓存（CHG-SN-6-04，运维动作 audit 豁免）
 *   后续扩展：GET/POST settings / config 等
 */

import { apiClient } from '@/lib/api-client'

// CacheType / CacheStat 真源在 packages/types/src/contracts/v1/admin.ts；
// 该 contracts 子目录未在 @resovo/types 顶层 re-export，故此处 inline 镜像
// （字段命名 100% 对齐 contracts；新增类型时同步两处）
export type CacheType = 'search' | 'video' | 'danmaku' | 'analytics' | 'home' | 'all'
export interface CacheStat {
  readonly type: CacheType
  readonly count: number
  readonly sizeKb: number
}

// ── Scheduler / Monitor ──────────────────────────────────────────

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

// ── Cache ────────────────────────────────────────────────────────

export async function getCacheStats(): Promise<readonly CacheStat[]> {
  const result = await apiClient.get<{ data: readonly CacheStat[] }>('/admin/cache/stats')
  return result.data
}

export async function clearCache(type: CacheType): Promise<{ deleted: number }> {
  const result = await apiClient.delete<{ data: { deleted: number } }>(
    `/admin/cache/${encodeURIComponent(type)}`,
  )
  return result.data
}
