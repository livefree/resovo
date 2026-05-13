/**
 * sources/api.ts — /admin/sources 视图 API 客户端封装（CHG-SN-5-11）
 */

import { apiClient } from '@/lib/api-client'
import type {
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
  LineMatrixRow,
  SourceLineAlias,
} from './types'

export async function listVideoGroups(params: VideoGroupListParams = {}): Promise<VideoGroupListResult> {
  const qs = new URLSearchParams()
  if (params.page != null)    qs.set('page', String(params.page))
  if (params.limit != null)   qs.set('limit', String(params.limit))
  if (params.keyword)         qs.set('keyword', params.keyword)
  if (params.segment)         qs.set('segment', params.segment)
  if (params.siteKey)         qs.set('siteKey', params.siteKey)
  const q = qs.toString()
  return apiClient.get<VideoGroupListResult>(`/admin/sources/video-groups${q ? `?${q}` : ''}`)
}

export async function getVideoGroupStats(): Promise<VideoGroupStats> {
  const result = await apiClient.get<{ data: VideoGroupStats }>('/admin/sources/video-groups/stats')
  return result.data
}

export async function getVideoMatrix(videoId: string): Promise<LineMatrixRow[]> {
  const result = await apiClient.get<{ data: LineMatrixRow[] }>(`/admin/sources/video-groups/${videoId}/matrix`)
  return result.data
}

export async function listLineAliases(): Promise<SourceLineAlias[]> {
  const result = await apiClient.get<{ data: SourceLineAlias[] }>('/admin/source-line-aliases')
  return result.data
}

export async function upsertLineAlias(
  siteKey: string,
  sourceName: string,
  displayName: string,
): Promise<SourceLineAlias> {
  const result = await apiClient.put<{ data: SourceLineAlias }>(
    `/admin/source-line-aliases/${encodeURIComponent(siteKey)}/${encodeURIComponent(sourceName)}`,
    { displayName },
  )
  return result.data
}
