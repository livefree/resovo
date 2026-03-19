/**
 * system.types.ts — 站点配置 & 爬虫源站类型
 * CHG-33
 */

// ── 站点配置键 ────────────────────────────────────────────────

export type SystemSettingKey =
  | 'site_name'
  | 'site_announcement'
  | 'douban_proxy'
  | 'douban_cookie'
  | 'show_adult_content'
  | 'content_filter_enabled'
  | 'video_proxy_enabled'
  | 'video_proxy_url'
  | 'auto_crawl_enabled'
  | 'auto_crawl_max_per_run'
  | 'auto_crawl_recent_only'
  | 'auto_crawl_recent_days'
  | 'config_file'

export interface SystemSetting {
  key: SystemSettingKey
  value: string
  updatedAt: string
}

/** 站点配置对象（反序列化后） */
export interface SiteSettings {
  siteName: string
  siteAnnouncement: string
  doubanProxy: string
  doubanCookie: string
  showAdultContent: boolean
  contentFilterEnabled: boolean
  videoProxyEnabled: boolean
  videoProxyUrl: string
  autoCrawlEnabled: boolean
  autoCrawlMaxPerRun: number
  autoCrawlRecentOnly: boolean
  autoCrawlRecentDays: number
}

// ── 爬虫源站 ──────────────────────────────────────────────────

export type CrawlerSiteType = 'vod' | 'shortdrama'
export type CrawlerSiteFormat = 'json' | 'xml'

export interface CrawlerSite {
  key: string
  name: string
  apiUrl: string
  detail: string | null
  sourceType: CrawlerSiteType
  format: CrawlerSiteFormat
  weight: number
  isAdult: boolean
  disabled: boolean
  fromConfig: boolean
  lastCrawledAt: string | null
  lastCrawlStatus: 'ok' | 'failed' | 'running' | null
  createdAt: string
  updatedAt: string
}

export interface CreateCrawlerSiteInput {
  key: string
  name: string
  apiUrl: string
  detail?: string
  sourceType?: CrawlerSiteType
  format?: CrawlerSiteFormat
  weight?: number
  isAdult?: boolean
}

export interface UpdateCrawlerSiteInput {
  name?: string
  apiUrl?: string
  detail?: string
  sourceType?: CrawlerSiteType
  format?: CrawlerSiteFormat
  weight?: number
  isAdult?: boolean
  disabled?: boolean
}

/** 批量操作 */
export type CrawlerSiteBatchAction =
  | 'enable'
  | 'disable'
  | 'delete'
  | 'mark_adult'
  | 'unmark_adult'
  | 'mark_shortdrama'
  | 'mark_vod'
