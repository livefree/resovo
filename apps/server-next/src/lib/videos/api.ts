import { apiClient } from '@/lib/api-client'
import type {
  VideoAdminRow,
  VideoAdminDetail,
  VideoListFilter,
  VideoListResult,
  VideoMetaPatch,
  StateTransitionAction,
  VisibilityStatus,
} from './types'

// ── 列表 ──────────────────────────────────────────────────────────

export async function listVideos(filter: VideoListFilter = {}): Promise<VideoListResult> {
  const params = new URLSearchParams()
  if (filter.q)               params.set('q', filter.q)
  if (filter.type)            params.set('type', filter.type)
  if (filter.status)          params.set('status', filter.status)
  if (filter.visibilityStatus) params.set('visibilityStatus', filter.visibilityStatus)
  if (filter.reviewStatus)    params.set('reviewStatus', filter.reviewStatus)
  if (filter.site)            params.set('site', filter.site)
  if (filter.sortField)       params.set('sortField', filter.sortField)
  if (filter.sortDir)         params.set('sortDir', filter.sortDir)
  if (filter.page != null)    params.set('page', String(filter.page))
  if (filter.limit != null)   params.set('limit', String(filter.limit))
  return apiClient.get<VideoListResult>(`/admin/videos?${params}`)
}

// ── 单条详情 ──────────────────────────────────────────────────────

export async function getVideo(id: string): Promise<VideoAdminDetail> {
  const res = await apiClient.get<{ data: VideoAdminDetail }>(`/admin/videos/${id}`)
  return res.data
}

// ── 元数据编辑 ────────────────────────────────────────────────────

export interface PatchVideoResult {
  data: VideoAdminRow
  skippedFields: string[]
}

export async function patchVideoMeta(id: string, patch: VideoMetaPatch): Promise<PatchVideoResult> {
  return apiClient.patch<PatchVideoResult>(`/admin/videos/${id}`, patch)
}

// ── 可见性更新 ────────────────────────────────────────────────────

export async function updateVisibility(
  id: string,
  visibility: VisibilityStatus,
): Promise<{ data: Pick<VideoAdminRow, 'visibility_status' | 'is_published'> }> {
  return apiClient.patch(`/admin/videos/${id}/visibility`, { visibility })
}

// ── 状态迁移 ──────────────────────────────────────────────────────

export async function stateTransition(
  id: string,
  action: StateTransitionAction,
  reason?: string,
): Promise<{ data: VideoAdminRow }> {
  return apiClient.post(`/admin/videos/${id}/state-transition`, { action, reason })
}

// ── 审核（用于批量逐条调用）──────────────────────────────────────

export async function reviewVideo(
  id: string,
  action: 'approve' | 'approve_and_publish' | 'reject',
  reason?: string,
): Promise<{ data: VideoAdminRow }> {
  return apiClient.post(`/admin/videos/${id}/review`, { action, reason })
}

// ── 批量上架 ──────────────────────────────────────────────────────

export async function batchPublish(ids: string[]): Promise<{ data: { updated: number } }> {
  return apiClient.post('/admin/videos/batch-publish', { ids, isPublished: true })
}

// ── 批量下架 ──────────────────────────────────────────────────────

export async function batchUnpublish(ids: string[]): Promise<{ data: { updated: number } }> {
  return apiClient.post('/admin/videos/batch-unpublish', { ids })
}

// ── 豆瓣同步 ──────────────────────────────────────────────────────

export async function doubanSync(id: string): Promise<void> {
  await apiClient.post(`/admin/videos/${id}/douban-sync`, {})
}

// ── 重新采集 ──────────────────────────────────────────────────────

export async function refetchSources(id: string, siteKeys?: string[]): Promise<void> {
  await apiClient.post(`/admin/videos/${id}/refetch-sources`, siteKeys ? { siteKeys } : {})
}

// ── 审核统计（dashboard 用）───────────────────────────────────────

export interface ModerationStats {
  pendingReview: number
  published: number
  rejected: number
  total: number
}

export async function getModerationStats(): Promise<ModerationStats> {
  const res = await apiClient.get<{ data: ModerationStats }>('/admin/videos/moderation-stats')
  return res.data
}
