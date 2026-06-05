/**
 * merge/api.ts — /admin/merge 视图 API 客户端（CHG-SN-5-12 / ADR-105 4 端点消费）
 *
 * 端点契约：ADR-105 §端点契约 row 1-4 + #6
 *   GET  /admin/video-merges/candidates
 *   POST /admin/video-merges
 *   POST /admin/video-merges/:auditId/unmerge
 *   POST /admin/videos/:id/split
 *   GET  /admin/videos/:id/split-suggestions（ADR-105 AMENDMENT 2026-06-03 / CHG-VIR-11-B）
 */

import { apiClient } from '@/lib/api-client'
import type {
  ListCandidatesParams,
  ListCandidatesResult,
  MergeParams,
  MergeResult,
  UnmergeResult,
  SplitParams,
  SplitResult,
  SplitSuggestionsResult,
  ListAuditParams,
  ListAuditResult,
} from '@resovo/types'

export async function listCandidates(params: ListCandidatesParams): Promise<ListCandidatesResult> {
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  qs.set('minScore', String(params.minScore))
  qs.set('limit', String(params.limit))
  qs.set('page', String(params.page))
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 全栈打通 URL 透传
  if (params.sortField) qs.set('sortField', params.sortField)
  if (params.sortDir)   qs.set('sortDir', params.sortDir)
  // CHG-VIR-9-A：候选来源（默认 legacy；identity 读 candidate 表，空表降级）
  if (params.source) qs.set('source', params.source)
  // ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL）：组级筛选 + 标题搜索
  if (params.identityScoreMin !== undefined) qs.set('identityScoreMin', String(params.identityScoreMin))
  if (params.identityScoreMax !== undefined) qs.set('identityScoreMax', String(params.identityScoreMax))
  if (params.videoCountMin !== undefined) qs.set('videoCountMin', String(params.videoCountMin))
  if (params.videoCountMax !== undefined) qs.set('videoCountMax', String(params.videoCountMax))
  if (params.q) qs.set('q', params.q)
  return apiClient.get<ListCandidatesResult>(`/admin/video-merges/candidates?${qs.toString()}`)
}

export async function mergeVideos(params: MergeParams): Promise<MergeResult> {
  const result = await apiClient.post<{ data: MergeResult }>('/admin/video-merges', params)
  return result.data
}

export async function unmergeVideos(auditId: string, reason?: string): Promise<UnmergeResult> {
  const body = reason ? { reason } : {}
  const result = await apiClient.post<{ data: UnmergeResult }>(
    `/admin/video-merges/${encodeURIComponent(auditId)}/unmerge`,
    body,
  )
  return result.data
}

export async function splitVideo(params: SplitParams): Promise<SplitResult> {
  const { videoId, groups } = params
  const result = await apiClient.post<{ data: SplitResult }>(
    `/admin/videos/${encodeURIComponent(videoId)}/split`,
    { groups },
  )
  return result.data
}

// CHG-VIR-11-B — GET /admin/videos/:id/split-suggestions（ADR-105 AMENDMENT 2026-06-03 D-105-1）
export async function getSplitSuggestions(videoId: string): Promise<SplitSuggestionsResult> {
  const result = await apiClient.get<{ data: SplitSuggestionsResult }>(
    `/admin/videos/${encodeURIComponent(videoId)}/split-suggestions`,
  )
  return result.data
}

// CHG-SN-6-AUDIT-TIMELINE-B — GET /admin/video-merges/audit
export async function listAudit(params: ListAuditParams): Promise<ListAuditResult> {
  const qs = new URLSearchParams()
  if (params.action) qs.set('action', params.action)
  if (params.videoId) qs.set('videoId', params.videoId)
  qs.set('limit', String(params.limit))
  qs.set('page', String(params.page))
  return apiClient.get<ListAuditResult>(`/admin/video-merges/audit?${qs.toString()}`)
}
