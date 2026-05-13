/**
 * submissions/api.ts — `/admin/submissions` 视图 API 客户端封装
 *
 * 复用现有 admin 端点（apps/api/src/routes/admin/content.ts:183-256），零新端点需求。
 */

import { apiClient } from '@/lib/api-client'
import type {
  SubmissionListFilter,
  SubmissionListResult,
  BatchApproveResult,
  BatchRejectResult,
} from './types'

export async function listSubmissions(filter: SubmissionListFilter = {}): Promise<SubmissionListResult> {
  const params = new URLSearchParams()
  if (filter.videoType) params.set('videoType', filter.videoType)
  if (filter.siteKey)   params.set('siteKey', filter.siteKey)
  if (filter.sortField) params.set('sortField', filter.sortField)
  if (filter.sortDir)   params.set('sortDir', filter.sortDir)
  if (filter.page != null)  params.set('page', String(filter.page))
  if (filter.limit != null) params.set('limit', String(filter.limit))
  return apiClient.get<SubmissionListResult>(`/admin/submissions?${params}`)
}

export async function approveSubmission(id: string): Promise<void> {
  await apiClient.post(`/admin/submissions/${id}/approve`)
}

export async function rejectSubmission(id: string, reason?: string): Promise<void> {
  await apiClient.post(`/admin/submissions/${id}/reject`, reason ? { reason } : {})
}

export async function batchApproveSubmissions(ids: readonly string[]): Promise<number> {
  const res = await apiClient.post<BatchApproveResult>('/admin/submissions/batch-approve', { ids })
  return res.data.approved
}

export async function batchRejectSubmissions(ids: readonly string[], reason?: string): Promise<number> {
  const res = await apiClient.post<BatchRejectResult>(
    '/admin/submissions/batch-reject',
    reason ? { ids, reason } : { ids },
  )
  return res.data.rejected
}
