/**
 * subtitles/types.ts — `/admin/subtitles` 视图数据类型契约（M-SN-5 / CHG-SN-5-02）
 *
 * 真源端点：apps/api/src/routes/admin/content.ts:269-308
 *   - GET  /admin/subtitles              — 待审字幕队列（is_verified=false）
 *   - POST /admin/subtitles/:id/approve  — 审核通过
 *   - POST /admin/subtitles/:id/reject   — 拒绝（软删除）{ reason? }
 */

export interface SubtitleRow {
  readonly id: string
  readonly video_id: string
  readonly video_title: string | null
  readonly episode_number: number | null
  readonly language: string
  readonly label: string
  readonly file_url: string
  readonly format: string
  readonly uploaded_by?: string | null
  readonly created_at: string
}

export interface SubtitleListResult {
  readonly data: readonly SubtitleRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export interface SubtitleListFilter {
  readonly page?: number
  readonly limit?: number
  readonly sortField?: string
  readonly sortDir?: 'asc' | 'desc'
}

/** ADR-134：POST /admin/subtitles 请求体 */
export interface CreateAdminSubtitleInput {
  readonly videoId: string
  readonly language: string
  readonly label: string
  readonly format: 'vtt' | 'srt' | 'ass'
  readonly fileUrl: string
  readonly episodeNumber?: number | null
}

/** ADR-133：GET /admin/subtitles/stats 响应结构 */
export interface SubtitleStats {
  readonly pendingCount: number
  readonly approvedTodayCount: number
  readonly rejectedTodayCount: number
  readonly totalVerifiedCount: number
  /** ISO 8601 时间戳 */
  readonly generatedAt: string
}
