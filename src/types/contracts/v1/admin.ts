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
export type CacheType = 'search' | 'video' | 'danmaku' | 'analytics' | 'all'

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
  year: number | null
  rating: number | null
  description: string | null
  coverUrl: string | null
  directors: string[]
  casts: string[]
  partial?: boolean
}

export interface DoubanPreviewMiss {
  found: false
  reason: DoubanSyncReason
}

export type DoubanPreview = DoubanPreviewFound | DoubanPreviewMiss
