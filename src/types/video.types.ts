/**
 * video.types.ts — 视频内容类型
 */

// ── 枚举 ─────────────────────────────────────────────────────────

export type VideoType     = 'movie' | 'series' | 'anime' | 'variety'
export type VideoStatus   = 'ongoing' | 'completed'
export type VideoCategory =
  | 'action' | 'comedy' | 'drama' | 'sci-fi' | 'horror'
  | 'romance' | 'thriller' | 'documentary' | 'animation'
  | 'history' | 'fantasy' | 'crime' | 'mystery'

export type VideoQuality  = '4K' | '1080P' | '720P' | '480P' | '360P'
export type SourceType    = 'hls' | 'mp4' | 'dash'

// ── 视频实体 ─────────────────────────────────────────────────────

export interface Video {
  id: string
  shortId: string          // 8 位 nanoid，URL 使用
  slug: string | null      // SEO 路径段，如 attack-on-titan
  title: string            // 中文标题
  titleEn: string | null   // 英文原名
  description: string | null
  coverUrl: string | null  // Cloudflare R2 URL
  type: VideoType
  category: VideoCategory | null
  rating: number | null    // 0-10
  year: number | null
  country: string | null   // ISO 3166-1 alpha-2，如 JP、US、CN
  episodeCount: number     // 电影为 1
  status: VideoStatus
  director: string[]       // 导演列表
  cast: string[]           // 演员/声优列表
  writers: string[]        // 编剧列表
  sourceCount: number      // 可用播放源数量（冗余字段）
  subtitleLangs: string[]  // 已有字幕语言列表，BCP 47
  createdAt: string
}

// ── 视频卡片（列表用，字段较少）────────────────────────────────

export type VideoCard = Pick<
  Video,
  'id' | 'shortId' | 'slug' | 'title' | 'titleEn' |
  'coverUrl' | 'type' | 'rating' | 'year' | 'status' |
  'episodeCount' | 'sourceCount'
>

// ── 播放源 ───────────────────────────────────────────────────────

export interface VideoSource {
  id: string
  videoId: string
  episodeNumber: number | null  // null 表示电影
  sourceUrl: string             // 第三方直链（ADR-001：不做代理）
  sourceName: string            // 如"线路1"
  quality: VideoQuality | null
  type: SourceType
  isActive: boolean
  lastChecked: string | null
}

// ── 字幕 ─────────────────────────────────────────────────────────

export type SubtitleFormat = 'vtt' | 'srt' | 'ass'

export interface Subtitle {
  id: string
  videoId: string
  episodeNumber: number | null
  language: string         // BCP 47，如 zh-CN、en、ja
  label: string            // 显示名称，如"中文简体"
  fileUrl: string          // R2 URL
  format: SubtitleFormat
  isVerified: boolean      // 版主审核通过
  createdAt: string
}

// ── 标签 ─────────────────────────────────────────────────────────

export interface Tag {
  id: string
  name: string             // 中文标签名
  nameEn: string | null    // 英文标签名
  category: string | null  // 如 genre、theme
}

// ── 请求参数 ─────────────────────────────────────────────────────

export interface VideoListParams {
  type?: VideoType
  category?: VideoCategory
  year?: number
  country?: string
  ratingMin?: number
  sort?: 'hot' | 'rating' | 'latest'
  page?: number
  limit?: number
}

export interface TrendingParams {
  period?: 'today' | 'week' | 'month'
  type?: VideoType
}

export interface SourceReportInput {
  reason: 'broken' | 'low_quality' | 'wrong_episode' | 'other'
}

export interface SubtitleUploadInput {
  language: string
  episode?: number
  file: File
}
