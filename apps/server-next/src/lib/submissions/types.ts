/**
 * submissions/types.ts — `/admin/submissions` 视图数据类型契约（M-SN-5 / CHG-SN-5-01）
 *
 * 真源端点：apps/api/src/routes/admin/content.ts:183-256
 *   - GET    /admin/submissions               — 投稿队列
 *   - POST   /admin/submissions/:id/approve
 *   - POST   /admin/submissions/:id/reject       { reason? }
 *   - POST   /admin/submissions/batch-approve    { ids[] }
 *   - POST   /admin/submissions/batch-reject     { ids[], reason? }
 */

export interface SubmissionRow {
  readonly id: string
  readonly video_id: string
  readonly source_url: string
  readonly source_name: string
  readonly submitted_by: string | null
  readonly submitted_by_username?: string | null
  readonly video_title?: string | null
  readonly video_type?: string | null
  readonly video_site_key?: string | null
  readonly created_at: string
}

export interface SubmissionListResult {
  readonly data: readonly SubmissionRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export interface SubmissionListFilter {
  readonly videoType?: string
  readonly siteKey?: string
  readonly page?: number
  readonly limit?: number
  readonly sortField?: string
  readonly sortDir?: 'asc' | 'desc'
}

export interface BatchApproveResult {
  readonly data: { readonly approved: number }
}

export interface BatchRejectResult {
  readonly data: { readonly rejected: number }
}
