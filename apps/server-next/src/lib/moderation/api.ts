import { apiClient } from '@/lib/api-client'
import type {
  PendingQueueResponse,
  VideoQueueRow,
  VideoSourceLine,
  SourceHealthEvent,
  ReviewLabel,
  DualSignalDisplayState,
} from '@resovo/types'

// ── 本地类型（GET /admin/sources snake_case 响应行）─────────────────

export interface ContentSourceRow {
  readonly id: string
  readonly probe_status: string
  readonly render_status: string
  readonly latency_ms: number | null
  readonly is_active: boolean
  readonly source_name: string
  readonly episode_number: number | null
  readonly source_site_key: string | null
  readonly source_url: string
  readonly video_title: string | null
}

export interface LineHealthPage {
  readonly data: readonly SourceHealthEvent[]
  readonly pagination: {
    readonly total: number
    readonly page: number
    readonly limit: number
    readonly hasNext: boolean
  }
}

export interface StagingApiRow {
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
  readonly readiness: { readonly ready: boolean; readonly blockers: readonly string[] }
}

export interface StagingQueueResponse {
  readonly data: readonly StagingApiRow[]
  readonly total: number
}

export interface RejectedVideoRow {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly year: number | null
  readonly review_status: string
  readonly visibility_status: string
  readonly review_label_key?: string | null
  readonly douban_status?: string
  readonly source_check_status?: string
  readonly created_at: string
  readonly updated_at?: string
  readonly cover_url: string | null
}

export interface RejectedQueueResponse {
  readonly data: readonly RejectedVideoRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

// ── 待审核队列 ────────────────────────────────────────────────────────

export async function fetchPendingQueue(
  query: Partial<{
    cursor: string
    limit: number
    type: string
    sourceCheckStatus: string
    doubanStatus: string
    hasStaffNote: boolean
    needsManualReview: boolean
  }> = {},
): Promise<PendingQueueResponse> {
  const params = new URLSearchParams()
  if (query.cursor)                           params.set('cursor', query.cursor)
  if (query.limit != null)                    params.set('limit', String(query.limit))
  if (query.type)                             params.set('type', query.type)
  if (query.sourceCheckStatus)               params.set('sourceCheckStatus', query.sourceCheckStatus)
  if (query.doubanStatus)                    params.set('doubanStatus', query.doubanStatus)
  if (query.hasStaffNote != null)            params.set('hasStaffNote', String(query.hasStaffNote))
  if (query.needsManualReview != null)       params.set('needsManualReview', String(query.needsManualReview))
  const qs = params.toString()
  return apiClient.get<PendingQueueResponse>(`/admin/moderation/pending-queue${qs ? `?${qs}` : ''}`)
}

// ── 审核操作 ──────────────────────────────────────────────────────────

export async function approveVideo(id: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/videos/${id}/review`, { action: 'approve' })
}

export async function rejectVideo(
  id: string,
  payload: { labelKey: string; reason?: string },
  updatedAt?: string,
): Promise<void> {
  await apiClient.post<unknown>(`/admin/moderation/${id}/reject-labeled`, {
    ...payload,
    ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}),
  })
}

export async function reopenVideo(id: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/moderation/${id}/reopen`, {})
}

// ── 备注 ──────────────────────────────────────────────────────────────

export async function updateStaffNote(id: string, note: string | null): Promise<void> {
  await apiClient.patch<unknown>(`/admin/moderation/${id}/staff-note`, { note })
}

// ── 线路 ──────────────────────────────────────────────────────────────

export async function fetchVideoSources(videoId: string): Promise<ContentSourceRow[]> {
  const res = await apiClient.get<{ data: ContentSourceRow[]; total: number; page: number; limit: number }>(
    `/admin/sources?videoId=${encodeURIComponent(videoId)}&limit=100`,
  )
  return res.data
}

export async function toggleSource(
  videoId: string,
  sourceId: string,
  isActive: boolean,
): Promise<void> {
  await apiClient.patch<unknown>(`/admin/videos/${videoId}/sources/${sourceId}`, { isActive })
}

export async function disableDeadSources(videoId: string): Promise<{ disabled: number }> {
  const res = await apiClient.post<{ data: { disabled: number } }>(
    `/admin/videos/${videoId}/sources/disable-dead`,
    {},
  )
  return res.data
}

export async function refetchSources(videoId: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/videos/${videoId}/refetch-sources`, {})
}

// ── 线路健康事件 ──────────────────────────────────────────────────────

export async function fetchLineHealth(
  videoId: string,
  sourceId: string,
  page = 1,
): Promise<LineHealthPage> {
  return apiClient.get<LineHealthPage>(
    `/admin/moderation/${videoId}/line-health/${sourceId}?page=${page}&limit=20`,
  )
}

// ── 视频审计日志（RightPane.History · CHG-SN-4-FIX-C）─────────────────

export interface AuditLogQueryRow {
  readonly id: string
  readonly actorId: string
  readonly actorUsername: string | null
  readonly actionType: string  // AdminAuditActionType union；前端宽松接收
  readonly targetKind: string
  readonly targetId: string | null
  readonly beforeJsonb: Readonly<Record<string, unknown>> | null
  readonly afterJsonb: Readonly<Record<string, unknown>> | null
  readonly requestId: string | null
  readonly createdAt: string
}

export interface AuditLogPage {
  readonly data: readonly AuditLogQueryRow[]
  readonly pagination: {
    readonly total: number
    readonly page: number
    readonly limit: number
    readonly hasNext: boolean
  }
}

export async function fetchVideoAuditLog(
  videoId: string,
  page = 1,
  limit = 20,
): Promise<AuditLogPage> {
  return apiClient.get<AuditLogPage>(
    `/admin/moderation/${videoId}/audit-log?page=${page}&limit=${limit}`,
  )
}

// ── 拒绝标签 ──────────────────────────────────────────────────────────

export async function fetchReviewLabels(): Promise<ReviewLabel[]> {
  const res = await apiClient.get<{ data: ReviewLabel[] }>('/admin/review-labels?appliesTo=reject')
  return res.data
}

// ── 暂存队列 ──────────────────────────────────────────────────────────

export async function fetchStagingQueue(): Promise<StagingQueueResponse> {
  return apiClient.get<StagingQueueResponse>('/admin/staging')
}

export async function publishVideo(id: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/staging/${id}/publish`, {})
}

export async function batchPublishVideos(): Promise<{ published: number; skipped: number }> {
  const res = await apiClient.post<{ data: { published: number; skipped: number } }>(
    '/admin/staging/batch-publish',
    {},
  )
  return res.data
}

export async function revertStagingVideo(id: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/staging/${id}/revert`, {})
}

// ── 已拒绝列表 ────────────────────────────────────────────────────────

export async function fetchRejectedVideos(page = 1, limit = 30): Promise<RejectedQueueResponse> {
  return apiClient.get<RejectedQueueResponse>(
    `/admin/videos?reviewStatus=rejected&page=${page}&limit=${limit}&sortField=updated_at&sortDir=desc`,
  )
}

// ── 工具函数 ──────────────────────────────────────────────────────────

export function toDisplayState(status: string): DualSignalDisplayState {
  if (status === 'ok' || status === 'partial' || status === 'dead' || status === 'pending') {
    return status
  }
  return 'unknown'
}
