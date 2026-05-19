/**
 * user-submissions/api.ts — `/admin/user-submissions` 视图 API 客户端封装
 *
 * 6 端点（ADR-124 §端点契约 / REDO-02-B 落地 commit `b2763f30`）：
 *   GET    /admin/user-submissions                        — 4 类 + status 过滤 + badges 聚合
 *   GET    /admin/user-submissions/:id                    — 详情
 *   POST   /admin/user-submissions/:id/process            — 标记处理 + audit
 *   POST   /admin/user-submissions/:id/reject             — 拒绝 + audit
 *   POST   /admin/user-submissions/batch-process          — 批量处理 + audit
 *   POST   /admin/user-submissions/batch-reject           — 批量拒绝 + audit
 *
 * 任务卡：CHG-SN-7-REDO-02-C
 */

import { apiClient } from '@/lib/api-client'
import type {
  UserSubmissionRow,
  UserSubmissionListResp,
  ListUserSubmissionsQuery,
  ProcessSubmissionInput,
  RejectSubmissionInput,
  BatchProcessInput,
  BatchRejectInput,
} from './types'

export async function listUserSubmissions(
  query: ListUserSubmissionsQuery = {},
): Promise<UserSubmissionListResp> {
  const params = new URLSearchParams()
  if (query.page != null) params.set('page', String(query.page))
  if (query.limit != null) params.set('limit', String(query.limit))
  if (query.type) params.set('type', query.type)
  if (query.status) params.set('status', query.status)
  if (query.sortField) params.set('sortField', query.sortField)
  if (query.sortDir) params.set('sortDir', query.sortDir)
  const qs = params.toString()
  return apiClient.get<UserSubmissionListResp>(`/admin/user-submissions${qs ? `?${qs}` : ''}`)
}

export async function getUserSubmissionById(id: string): Promise<UserSubmissionRow> {
  const res = await apiClient.get<{ data: UserSubmissionRow }>(
    `/admin/user-submissions/${encodeURIComponent(id)}`,
  )
  return res.data
}

export async function processUserSubmission(
  id: string,
  input: ProcessSubmissionInput = {},
): Promise<void> {
  await apiClient.post(`/admin/user-submissions/${encodeURIComponent(id)}/process`, input)
}

export async function rejectUserSubmission(
  id: string,
  input: RejectSubmissionInput,
): Promise<void> {
  await apiClient.post(`/admin/user-submissions/${encodeURIComponent(id)}/reject`, input)
}

export async function batchProcessUserSubmissions(input: BatchProcessInput): Promise<number> {
  const res = await apiClient.post<{ data: { processed: number } }>(
    '/admin/user-submissions/batch-process',
    input,
  )
  return res.data.processed
}

export async function batchRejectUserSubmissions(input: BatchRejectInput): Promise<number> {
  const res = await apiClient.post<{ data: { rejected: number } }>(
    '/admin/user-submissions/batch-reject',
    input,
  )
  return res.data.rejected
}
