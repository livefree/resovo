/**
 * video.types.ts — 视频内容类型
 */

// ── 枚举 ─────────────────────────────────────────────────────────

export type VideoType =
  | 'movie'       // 电影
  | 'series'      // 连续剧 / 电视剧
  | 'anime'       // 动画
  | 'variety'     // 综艺（含游戏类综艺）
  | 'documentary' // 纪录片
  | 'short'       // 短剧 / 短片
  | 'sports'      // 体育赛事
  | 'music'       // 音乐节目
  | 'news'        // 新闻 / 时事
  | 'kids'        // 儿童内容
  | 'other'       // 其他

export type ContentFormat = 'movie' | 'episodic' | 'collection' | 'clip'
export type EpisodePattern = 'single' | 'multi' | 'ongoing' | 'unknown'

export type VideoStatus   = 'ongoing' | 'completed'

// ── 内容治理（Migration 016）────────────────────────────────────
export type ReviewStatus     = 'pending_review' | 'approved' | 'rejected'
export type VisibilityStatus = 'public' | 'internal' | 'hidden'

// ── 流水线辅助状态（Migration 032，Pipeline Overhaul）────────────
/** 豆瓣匹配状态：自动丰富 Job 写入 */
export type DoubanStatus = 'pending' | 'matched' | 'candidate' | 'unmatched'
/** 源活性批量检验结果 */
export type SourceCheckStatus = 'pending' | 'ok' | 'partial' | 'all_dead'
/** VideoGenre — 内容题材（与 VideoType 内容形式严格正交）*/
export type VideoGenre =
  | 'action'       // 动作
  | 'comedy'       // 喜剧
  | 'romance'      // 爱情
  | 'thriller'     // 惊悚
  | 'horror'       // 恐怖
  | 'sci_fi'       // 科幻
  | 'fantasy'      // 奇幻 / 魔幻
  | 'history'      // 历史 / 古装
  | 'crime'        // 犯罪
  | 'mystery'      // 悬疑
  | 'war'          // 战争
  | 'family'       // 家庭 / 亲情
  | 'biography'    // 传记 / 人物
  | 'martial_arts' // 武侠 / 功夫
  | 'other'        // 其他

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
  genres: VideoGenre[]
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
  // 类型判定辅助字段（Migration 013）
  sourceContentType: string | null  // 爬虫原样写入的源站类型字符串
  normalizedType: string | null     // 平台规范化分类
  contentFormat: ContentFormat | null
  episodePattern: EpisodePattern | null
  // 内容治理字段（Migration 016）
  reviewStatus: ReviewStatus
  visibilityStatus: VisibilityStatus
  needsManualReview: boolean
  contentRating: 'general' | 'adult'      // 内容分级（adult 为隐藏，未来专区门控）
  createdAt: string
  // 三层架构字段（CHG-371）
  catalogId: string | null
  imdbId: string | null
  tmdbId: number | null
  // META-06/08 扩展字段（来自 media_catalog）
  titleOriginal: string | null
  aliases: string[]
  languages: string[]
  tags: string[]
  ratingVotes: number | null
  runtimeMinutes: number | null
  // 流水线辅助字段（Migration 032）
  doubanStatus: DoubanStatus
  sourceCheckStatus: SourceCheckStatus
  /** 元数据完整度评分 0-100 */
  metaScore: number
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
  /** CHG-412: crawler_sites.display_name，用于前台线路命名；未配置时为 null */
  siteDisplayName: string | null
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
  genre?: VideoGenre    // 单值过滤参数（后端使用 @> 数组包含查询）
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
