/**
 * subtitles/api.ts — `/admin/subtitles` 视图 API 客户端封装
 *
 * 复用现有 admin 端点（apps/api/src/routes/admin/content.ts:269-308），零新端点需求。
 */

import { apiClient } from '@/lib/api-client'
import type { SubtitleListFilter, SubtitleListResult, SubtitleStats, CreateAdminSubtitleInput } from './types'

export async function listSubtitles(filter: SubtitleListFilter = {}): Promise<SubtitleListResult> {
  const params = new URLSearchParams()
  if (filter.sortField) params.set('sortField', filter.sortField)
  if (filter.sortDir)   params.set('sortDir', filter.sortDir)
  if (filter.page != null)  params.set('page', String(filter.page))
  if (filter.limit != null) params.set('limit', String(filter.limit))
  return apiClient.get<SubtitleListResult>(`/admin/subtitles?${params}`)
}

export async function approveSubtitle(id: string): Promise<void> {
  await apiClient.post(`/admin/subtitles/${id}/approve`)
}

export async function rejectSubtitle(id: string, reason?: string): Promise<void> {
  await apiClient.post(`/admin/subtitles/${id}/reject`, reason ? { reason } : {})
}

export async function fetchSubtitleStats(): Promise<SubtitleStats> {
  const res = await apiClient.get<{ data: SubtitleStats }>('/admin/subtitles/stats')
  return res.data
}

export async function createAdminSubtitle(input: CreateAdminSubtitleInput): Promise<void> {
  await apiClient.post('/admin/subtitles', input)
}
