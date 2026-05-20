/**
 * lib/staging/api.ts — 暂存发布页 API 客户端（CHG-SN-7-REDO-04-B）
 *
 * 端点（apps/api staging.ts / ADR-NNN 前置已通过，端点 M-SN-3 时期已立 ADR）：
 *   GET  /admin/staging              — 列表（含 rules + summary）
 *   GET  /admin/staging/rules        — 规则
 *   PUT  /admin/staging/rules        — 保存规则
 *   POST /admin/staging/:id/publish  — 单条发布
 *   POST /admin/staging/batch-publish — 批量发布就绪
 *   POST /admin/staging/:id/revert   — 退回待审
 */

import { apiClient } from '@/lib/api-client'

// ── 类型 ──────────────────────────────────────────────────────────────

export interface StagingRules {
  readonly minMetaScore: number
  readonly requireDoubanMatched: boolean
  readonly requireCoverUrl: boolean
  readonly minActiveSourceCount: number
}

export interface StagingReadinessSummary {
  readonly all: number
  readonly ready: number
  readonly warning: number
  readonly blocked: number
}

export interface StagingRowReadiness {
  readonly ready: boolean
  readonly blockers: readonly string[]
}

export interface StagingRow {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly year: number | null
  readonly coverUrl: string | null
  readonly doubanStatus: string
  readonly sourceCheckStatus: string
  readonly metaScore: number
  readonly activeSourceCount: number
  readonly qualityHighest: string | null
  readonly approvedAt: string | null
  readonly updatedAt: string
  readonly readiness: StagingRowReadiness
}

export interface StagingListResponse {
  readonly data: readonly StagingRow[]
  readonly total: number
  readonly rules: StagingRules
  readonly summary: StagingReadinessSummary
}

export type StagingReadinessFilter = 'ready' | 'warning' | 'blocked'

export interface StagingListParams {
  page?: number
  limit?: number
  readiness?: StagingReadinessFilter
}

// ── API 函数 ──────────────────────────────────────────────────────────

export async function listStagingVideos(params: StagingListParams = {}): Promise<StagingListResponse> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.readiness) q.set('readiness', params.readiness)
  const qs = q.toString()
  return apiClient.get<StagingListResponse>(`/admin/staging${qs ? `?${qs}` : ''}`)
}

export async function fetchStagingRules(): Promise<StagingRules> {
  const res = await apiClient.get<{ data: StagingRules }>('/admin/staging/rules')
  return res.data
}

export async function saveStagingRules(rules: StagingRules): Promise<StagingRules> {
  const res = await apiClient.put<{ data: StagingRules }>('/admin/staging/rules', rules)
  return res.data
}

export async function publishStagingVideo(id: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/staging/${id}/publish`, {})
}

export async function batchPublishStagingVideos(): Promise<{ published: number; skipped: number }> {
  const res = await apiClient.post<{ data: { published: number; skipped: number } }>(
    '/admin/staging/batch-publish',
    {},
  )
  return res.data
}

export async function revertStagingVideo(id: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/staging/${id}/revert`, {})
}
