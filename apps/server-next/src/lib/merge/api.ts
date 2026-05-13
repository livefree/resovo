/**
 * merge/api.ts — /admin/merge 视图 API 客户端（CHG-SN-5-12 / ADR-105 4 端点消费）
 *
 * 端点契约：ADR-105 §端点契约 row 1-4
 *   GET  /admin/video-merges/candidates
 *   POST /admin/video-merges
 *   POST /admin/video-merges/:auditId/unmerge
 *   POST /admin/videos/:id/split
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
} from '@resovo/types'

export async function listCandidates(params: ListCandidatesParams): Promise<ListCandidatesResult> {
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  qs.set('minScore', String(params.minScore))
  qs.set('limit', String(params.limit))
  qs.set('page', String(params.page))
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
