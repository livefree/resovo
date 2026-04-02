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
