import type {
  VideoType,
  VideoStatus,
  VideoGenre,
  ReviewStatus,
  VisibilityStatus,
  DoubanStatus,
} from '@resovo/types'

export type { VideoType, VideoStatus, VideoGenre, ReviewStatus, VisibilityStatus, DoubanStatus }

// ── 列表行（对应 GET /admin/videos 响应结构）─────────────────────

export interface VideoAdminRow {
  id: string
  short_id: string
  title: string
  title_en: string | null
  cover_url: string | null
  type: VideoType
  year: number | null
  is_published: boolean
  source_count: string
  active_source_count?: string
  total_source_count?: string
  visibility_status?: VisibilityStatus
  review_status?: ReviewStatus
  created_at: string
  updated_at?: string
  douban_status?: DoubanStatus
  meta_score?: number
  source_check_status?: string
  poster_status?: string | null
  backdrop_status?: string | null
}

// ── 列表查询参数 ──────────────────────────────────────────────────

export interface VideoListFilter {
  q?: string
  type?: VideoType
  status?: 'published' | 'pending' | 'all'
  visibilityStatus?: VisibilityStatus
  reviewStatus?: ReviewStatus
  site?: string
  sortField?: 'title' | 'type' | 'year' | 'created_at' | 'updated_at'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// ── 列表响应 ──────────────────────────────────────────────────────

export interface VideoListResult {
  data: VideoAdminRow[]
  total: number
  page: number
  limit: number
}

// ── 单条详情（含未发布字段）──────────────────────────────────────

export interface VideoAdminDetail extends VideoAdminRow {
  description: string | null
  title_en: string | null
  genres: VideoGenre[]
  country: string | null
  episode_count: number
  status: VideoStatus
  rating: number | null
  director: string[]
  cast: string[]
  writers: string[]
  douban_id: string | null
}

// ── 元数据编辑 Patch ──────────────────────────────────────────────

export interface VideoMetaPatch {
  title?: string
  titleEn?: string | null
  description?: string | null
  coverUrl?: string | null
  type?: VideoType
  genres?: VideoGenre[]
  year?: number | null
  country?: string | null
  episodeCount?: number
  status?: VideoStatus
  rating?: number | null
  director?: string[]
  cast?: string[]
  writers?: string[]
  doubanId?: string | null
}

// ── 状态迁移动作 ──────────────────────────────────────────────────

export type StateTransitionAction =
  | 'approve'
  | 'approve_and_publish'
  | 'reject'
  | 'reopen_pending'
  | 'publish'
  | 'unpublish'
  | 'set_internal'
  | 'set_hidden'
  | 'staging_revert'  // M-SN-4 D-01：暂存退回待审核（approved+internal/hidden+0 → pending_review）

// ── 采集站点 ──────────────────────────────────────────────────────

export interface CrawlerSite {
  key: string
  name: string
}

// ── 视频线路（GET /admin/sources?videoId=<id> 行结构）────────────
// 字段命名保持 snake_case 与 API 响应一致

export type SignalStatus = 'pending' | 'ok' | 'partial' | 'dead'
export type ImageStatus = 'pending_review' | 'ok' | 'broken' | 'unknown'
export type VideoImageKind = 'poster' | 'backdrop' | 'logo' | 'banner_backdrop'

export interface VideoSource {
  readonly id: string
  readonly video_id: string
  readonly source_url: string
  readonly source_name: string
  readonly is_active: boolean
  readonly last_checked: string | null
  readonly created_at: string
  readonly episode_number: number
  readonly season_number: number
  readonly source_site_key: string | null
  readonly site_key: string | null
  readonly type: string
  readonly probe_status: SignalStatus
  readonly render_status: SignalStatus
  readonly latency_ms: number | null
  readonly last_probed_at: string | null
  readonly last_rendered_at: string | null
  readonly quality_detected: string | null
  readonly quality_source: string
  readonly resolution_width: number | null
  readonly resolution_height: number | null
  readonly detected_at: string | null
  readonly video_title: string | null
}

// ── 视频图片（GET /admin/videos/:id/images 响应）─────────────────

export interface ImageSlotInfo {
  readonly url: string | null
  readonly status: ImageStatus | null
}

export interface VideoImagesData {
  readonly poster: ImageSlotInfo
  readonly backdrop: ImageSlotInfo
  readonly logo: ImageSlotInfo
  readonly banner_backdrop: ImageSlotInfo
  readonly lastStatusUpdatedAt: string | null
}

// ── 豆瓣搜索候选（POST /admin/moderation/:id/douban-search 响应）

export interface DoubanSuggestItem {
  readonly id: string
  readonly title: string
  readonly year: string
  readonly sub_title: string
}

// ── 豆瓣字段对比（GET /admin/moderation/:id/douban-candidate 响应）

export interface DoubanFieldDiff {
  readonly field: string
  readonly label: string
  readonly current: string | null
  readonly proposed: string | null
  readonly changed: boolean
}

export interface DoubanCandidateData {
  readonly externalRefId: string
  readonly externalId: string
  readonly confidence: number | null
  readonly matchMethod: string | null
  readonly breakdown: Record<string, number> | null
  readonly diffs: readonly DoubanFieldDiff[]
}
