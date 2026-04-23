/**
 * contracts/v1/admin.ts — 后台 API 共享类型契约
 * DEC-02: 从 @/api/routes/admin/analytics 迁移，作为前后台唯一共享边界
 *
 * 此文件可被前台组件和后台路由同时引用。
 * 禁止在此文件中 import 任何后端实现（@/api/**）。
 */

export interface AnalyticsData {
  videos: {
    total: number
    published: number
    pending: number
  }
  sources: {
    total: number
    active: number
    inactive: number
    failRate: number  // 0~1
  }
  users: {
    total: number
    todayNew: number
    banned: number
  }
  queues: {
    submissions: number   // 待审投稿
    subtitles: number     // 待审字幕
  }
  crawlerTasks: {
    recent: Array<{
      id: string
      type: string
      status: string
      created_at: string
      finished_at: string | null
    }>
  }
}

/** 缓存业务分类 */
export type CacheType = 'search' | 'video' | 'danmaku' | 'analytics' | 'home' | 'all'

/** 单个缓存类型的统计信息 */
export interface CacheStat {
  type: CacheType
  count: number
  sizeKb: number
}

/** 单站内容质量统计行 */
export interface ContentQualityRow {
  siteKey: string
  total: number
  published: number
  hasCover: number
  hasDescription: number
  hasYear: number
  activeSources: number
  totalSources: number
  aliasCount: number  // 该站点中有跨站合并记录的视频数
}

// ── 豆瓣同步类型（前后台共享契约） ────────────────────────────────

export type DoubanSyncReason = 'already_synced' | 'no_match' | 'fetch_failed'

export interface DoubanPreviewFound {
  found: true
  doubanId: string
  title: string
  titleOriginal?: string | null   // 原标题（来自 douban-adapter）
  year: number | null
  rating: number | null
  description: string | null
  coverUrl: string | null
  directors: string[]
  casts: string[]
  screenwriters?: string[]        // 编剧（来自 douban-adapter）
  genres?: string[]               // 题材标签，如 ['剧情', '动作']（来自 douban-adapter）
  countries?: string[]            // 出品国家（来自 douban-adapter）
  languages?: string[]            // 语言（来自 douban-adapter）
  partial?: boolean
}

export interface DoubanPreviewMiss {
  found: false
  reason: DoubanSyncReason
}

export type DoubanPreview = DoubanPreviewFound | DoubanPreviewMiss

// ── MediaCatalog 公开类型契约（CHG-371）────────────────────────────

export interface MediaCatalogRow {
  id: string
  title: string
  titleEn: string | null
  titleOriginal: string | null
  titleNormalized: string
  type: string
  genres: string[]
  genresRaw: string[]
  year: number | null
  releaseDate: string | null
  country: string | null
  runtimeMinutes: number | null
  status: string
  description: string | null
  coverUrl: string | null
  rating: number | null
  ratingVotes: number | null
  director: string[]
  cast: string[]
  writers: string[]
  imdbId: string | null
  tmdbId: number | null
  doubanId: string | null
  bangumiSubjectId: number | null
  metadataSource: string
  lockedFields: string[]
  // META-06 新增字段
  aliases: string[]
  languages: string[]
  officialSite: string | null
  tags: string[]
  backdropUrl: string | null
  trailerUrl: string | null
  createdAt: string
  updatedAt: string
}
