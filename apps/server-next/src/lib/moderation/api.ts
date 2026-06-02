import { apiClient } from '@/lib/api-client'
import type {
  PendingQueueResponse,
  VideoQueueRow,
  VideoSourceLine,
  ReviewLabel,
} from '@resovo/types'
// CHG-VSR-PRE-2（R1）：source 操作真源已移至 sources/api；本文件 re-export 保后兼容
import type { SourceLineRowData } from '@/lib/sources/types'

// ── 本地类型 ───────────────────────────────────────────────────────
// CHG-VSR-PRE-2（R1/Y1）：ContentSourceRow 收敛为中性 SourceLineRowData 别名（历史消费方零破坏）。
// LineHealthPage / source 操作真源移至 sources/api（见本文件「线路」段 re-export）。
export type ContentSourceRow = SourceLineRowData

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
    /** CHG-350：title ILIKE 模糊搜索（≤ 200 字符） */
    q: string
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
  if (query.q && query.q.trim())             params.set('q', query.q.trim())
  const qs = params.toString()
  return apiClient.get<PendingQueueResponse>(`/admin/moderation/pending-queue${qs ? `?${qs}` : ''}`)
}

// ── 审核操作 ──────────────────────────────────────────────────────────

/**
 * CHG-SN-8-06：approveVideo 可选「通过即上架」模式
 *   - andPublish=false (默认)：action='approve' → 入 staging
 *   - andPublish=true：action='approve_and_publish' → 直接发布前台（admin 角色限定，FORBIDDEN 时由 toast 告知）
 */
export async function approveVideo(id: string, andPublish: boolean = false): Promise<void> {
  await apiClient.post<unknown>(`/admin/videos/${id}/review`, {
    action: andPublish ? 'approve_and_publish' : 'approve',
  })
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

// ── CHG-SN-8-GAPS-MOD-BATCH · 批量审核（GAPS #G-moderation-batch-ui）

export interface BatchActionResult {
  readonly ok: number
  readonly failed: number
  readonly failedIds?: readonly string[]
}

/** 批量通过；后端 POST /admin/moderation/batch-approve（ids 1-50） */
export async function batchApproveVideos(ids: readonly string[]): Promise<BatchActionResult> {
  const res = await apiClient.post<{ data: BatchActionResult }>('/admin/moderation/batch-approve', { ids })
  return res.data
}

/** 批量拒绝；后端 POST /admin/moderation/batch-reject（含 reason + 可选 labelKey） */
export async function batchRejectVideos(
  ids: readonly string[],
  reason: string,
  labelKey?: string,
): Promise<BatchActionResult> {
  const res = await apiClient.post<{ data: BatchActionResult }>(
    '/admin/moderation/batch-reject',
    { ids, reason, ...(labelKey ? { labelKey } : {}) },
  )
  return res.data
}

export async function reopenVideo(id: string): Promise<void> {
  await apiClient.post<unknown>(`/admin/moderation/${id}/reopen`, {})
}

// ── 备注 ──────────────────────────────────────────────────────────────

export async function updateStaffNote(id: string, note: string | null): Promise<void> {
  await apiClient.patch<unknown>(`/admin/moderation/${id}/staff-note`, { note })
}

// ── 线路（视频级播放源操作）──────────────────────────────────────────
// CHG-VSR-PRE-2（R1 方案 B）：实现已移至 `@/lib/sources/api`（单一真源）；端点不变。
// 唯一历史消费方 moderation/_client/LinesPanel 已迁移至 useSourceLinesController；
// 此处 re-export 保后兼容（旧 import path 不破坏）。
export {
  fetchVideoSources,
  toggleSource,
  disableDeadSources,
  refetchSources,
  probeOneSource,
  renderCheckOneSource,
  batchProbeVideo,
  batchRenderCheckVideo,
  fetchLineHealth,
} from '@/lib/sources/api'
export type {
  LineHealthPage,
  SingleSourceProbeResult,
  SingleSourceRenderCheckResult,
  BatchProbeResultItem,
  BatchProbeResult,
  BatchRenderCheckResultItem,
  BatchRenderCheckResult,
} from '@/lib/sources/api'

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
// CHG-VSR-PRE-2：toDisplayState 真源移至 sources/api；re-export 保后兼容（moderation-api.test 消费）
export { toDisplayState } from '@/lib/sources/api'

// ── CHG-SN-8-04-VIEW · ADR-137：类似视频召回（GET /admin/moderation/:id/similar）

export interface SimilarVideoItem {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly year: number | null
  readonly country: string | null
  readonly genres: readonly string[]
  readonly coverUrl: string | null
  readonly metaScore: number
  readonly reviewStatus: string
  readonly isPublished: boolean
  readonly similarityScore: number
}

export interface ListSimilarVideosOptions {
  readonly limit?: number
  readonly yearRange?: number
}

export async function listSimilarVideos(
  videoId: string,
  opts: ListSimilarVideosOptions = {},
): Promise<readonly SimilarVideoItem[]> {
  const params = new URLSearchParams()
  if (opts.limit != null) params.set('limit', String(opts.limit))
  if (opts.yearRange != null) params.set('yearRange', String(opts.yearRange))
  const qs = params.toString()
  const path = `/admin/moderation/${encodeURIComponent(videoId)}/similar${qs ? `?${qs}` : ''}`
  const res = await apiClient.get<{ data: readonly SimilarVideoItem[] }>(path)
  return res.data
}
