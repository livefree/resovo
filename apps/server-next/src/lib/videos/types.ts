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
