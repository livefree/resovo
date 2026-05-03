import { apiClient } from '@/lib/api-client'
import type {
  VideoAdminRow,
  VideoAdminDetail,
  VideoListFilter,
  VideoListResult,
  VideoMetaPatch,
  StateTransitionAction,
  VisibilityStatus,
  VideoSource,
  VideoImagesData,
  VideoImageKind,
  DoubanSuggestItem,
  DoubanCandidateData,
} from './types'
import type { SourceHealthEvent } from '@resovo/types'

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

// ── 线路管理（CHG-SN-4-08）───────────────────────────────────────

export interface VideoSourceListResult {
  data: VideoSource[]
  total: number
  page: number
  limit: number
}

export async function listVideoSources(videoId: string): Promise<VideoSource[]> {
  const params = new URLSearchParams({ videoId, active: 'all', limit: '100', page: '1' })
  const res = await apiClient.get<VideoSourceListResult>(`/admin/sources?${params}`)
  return res.data
}

export async function toggleVideoSource(
  videoId: string,
  sourceId: string,
  isActive: boolean,
): Promise<{ data: VideoSource }> {
  return apiClient.patch<{ data: VideoSource }>(`/admin/videos/${videoId}/sources/${sourceId}`, { isActive })
}

export async function disableDeadSources(videoId: string): Promise<{ data: { disabled: number } }> {
  return apiClient.post<{ data: { disabled: number } }>(`/admin/videos/${videoId}/sources/disable-dead`, {})
}

export interface LineHealthResult {
  data: SourceHealthEvent[]
  pagination: { total: number; page: number; limit: number; hasNext: boolean }
}

export async function getLineHealthEvents(
  videoId: string,
  sourceId: string,
  page = 1,
  limit = 20,
): Promise<LineHealthResult> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiClient.get<LineHealthResult>(`/admin/moderation/${videoId}/line-health/${sourceId}?${params}`)
}

// ── 图片管理（CHG-SN-4-08）────────────────────────────────────────

export async function getVideoImages(videoId: string): Promise<VideoImagesData> {
  const res = await apiClient.get<{ data: VideoImagesData }>(`/admin/videos/${videoId}/images`)
  return res.data
}

export async function updateVideoImage(
  videoId: string,
  kind: VideoImageKind,
  url: string,
): Promise<{ data: { kind: VideoImageKind; url: string; status: string } }> {
  return apiClient.put<{ data: { kind: VideoImageKind; url: string; status: string } }>(
    `/admin/videos/${videoId}/images`,
    { kind, url },
  )
}

// ── 豆瓣匹配（CHG-SN-4-08）───────────────────────────────────────

export async function searchDoubanForVideo(
  videoId: string,
  keyword: string,
): Promise<{ videoId: string; candidates: DoubanSuggestItem[] }> {
  const res = await apiClient.post<{ data: { videoId: string; candidates: DoubanSuggestItem[] } }>(
    `/admin/moderation/${videoId}/douban-search`,
    { keyword },
  )
  return res.data
}

export async function confirmDoubanMatch(videoId: string, subjectId: string): Promise<void> {
  await apiClient.post(`/admin/moderation/${videoId}/douban-confirm`, { subjectId })
}

export async function ignoreDoubanMatch(videoId: string): Promise<void> {
  await apiClient.post(`/admin/moderation/${videoId}/douban-ignore`, {})
}

export async function getDoubanCandidate(videoId: string): Promise<DoubanCandidateData | null> {
  try {
    const res = await apiClient.get<{ data: DoubanCandidateData }>(`/admin/moderation/${videoId}/douban-candidate`)
    return res.data
  } catch {
    return null
  }
}

// ── 审核统计（dashboard 用；CHG-DESIGN-07 7C 步骤 1）───────────────────────────────────────
//
// 后端真实契约（生产方真源）：`apps/api/src/db/queries/videos.ts` 中的
// `ModerationStats` 接口 + `getModerationStats()` 函数；本文件镜像该类型供 server-next 消费方使用。
//
// 历史 BUG（CHG-SN-3-08 假绿根因）：本文件曾用 { pendingReview / published / rejected / total }
// 4 个错误字段；TS 编译通过但 runtime 全 undefined → DashboardClient 渲染 '—'，正是
// reference §5.1.4「不应把接口成功渲染成 —」教训直接复发。本卡修正契约。

export interface ModerationStats {
  /** 当前 pending_review 视频数（实时 COUNT 查询） */
  readonly pendingCount: number
  /** 今日已审视频数（approved + rejected，reviewed_at 在今日） */
  readonly todayReviewedCount: number
  /**
   * 最近 7 天拦截率（**百分数 0-100**，保留 1 位小数；无审核数据时为 null）
   *
   * 后端公式（生产方 `getModerationStats()` 内）：
   *   `Math.round((rejected / total7d) * 1000) / 10`
   * 即 ratio × 100 后保留 1 位小数。例如 rejected=12, total7d=100 → 12.0（表示 12.0%）。
   *
   * **消费方使用约定**：直接拼接 "%"，**不要再乘以 100**（典型坑：CHG-DESIGN-07 7C 曾误乘
   * 100 致显示 1230.0% 假数据，Codex stop-time review fix#1 闭环）。
   *
   * 详见生产方 jsdoc：`apps/api/src/db/queries/videos.ts` 中 `ModerationStats.interceptRate`。
   */
  readonly interceptRate: number | null
}

export async function getModerationStats(): Promise<ModerationStats> {
  const res = await apiClient.get<{ data: ModerationStats }>('/admin/videos/moderation-stats')
  return res.data
}
