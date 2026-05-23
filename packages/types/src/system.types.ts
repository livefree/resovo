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
  | 'auto_crawl_schedule_type'
  | 'auto_crawl_daily_time'
  | 'auto_crawl_default_mode'
  | 'auto_crawl_only_enabled_sites'
  | 'auto_crawl_conflict_policy'
  | 'auto_crawl_per_site_overrides'
  | 'auto_crawl_last_trigger_date'
  | 'crawler_global_freeze'
  | 'config_file'
  | 'config_file_url'
  | 'auto_publish_staging_enabled'
  | 'auto_publish_staging_rules'
  | 'auto_publish_staging_last_run'
  | 'notification_email_enabled'
  | 'notification_email_to'
  | 'notification_webhook_enabled'
  | 'notification_webhook_url'
  | 'notification_webhook_secret'
  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A / ADR-146 D-146-1：事件订阅 JSON 数组（WebhookEventType[]）
  | 'notification_webhook_events'
  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.3 / ADR-146 D-146-7：审核积压超阈值 webhook（数字 / 默认 50）
  | 'notification_pending_threshold'
  // ADR-146 R-146-3：阈值类事件 1h debounce 上次告警时间戳（ms）
  | 'notification_pending_last_alert'
  | 'session_timeout_minutes'
  | 'session_max_concurrent'
  | 'session_extend_on_activity'

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
  notificationEmailEnabled: boolean
  notificationEmailTo: string
  notificationWebhookEnabled: boolean
  notificationWebhookUrl: string
  notificationWebhookSecret: string
  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B / ADR-146 D-146-1：事件订阅多选数组（默认 []）
  notificationWebhookEvents: string[]
  sessionTimeoutMinutes: number
  sessionMaxConcurrent: number
  sessionExtendOnActivity: boolean
}

export type AutoCrawlMode = 'incremental' | 'full'
export type AutoCrawlConflictPolicy = 'skip_running' | 'queue_after_running'

export interface AutoCrawlSiteOverride {
  enabled: boolean
  mode: 'inherit' | AutoCrawlMode
}

export interface AutoCrawlConfig {
  globalEnabled: boolean
  scheduleType: 'daily'
  dailyTime: string
  defaultMode: AutoCrawlMode
  onlyEnabledSites: boolean
  conflictPolicy: AutoCrawlConflictPolicy
  perSiteOverrides: Record<string, AutoCrawlSiteOverride>
}

// ── 爬虫源站 ──────────────────────────────────────────────────

export type CrawlerSiteType = 'vod' | 'shortdrama'
export type CrawlerSiteFormat = 'json' | 'xml'

/** 站点级采集策略（Migration 018） */
export interface IngestPolicy {
  allow_auto_publish: boolean
  allow_search_index: boolean
  allow_recommendation: boolean
  allow_public_detail: boolean
  allow_playback: boolean
  require_review_before_publish: boolean
  /** 同站点源更新策略：replace=全量替换（默认），append_only=只追加不删除 */
  source_update?: 'replace' | 'append_only'
}

export const DEFAULT_INGEST_POLICY: IngestPolicy = {
  allow_auto_publish: false,
  allow_search_index: true,
  allow_recommendation: true,
  allow_public_detail: true,
  allow_playback: true,
  require_review_before_publish: true,
}

export interface CrawlerSite {
  key: string
  name: string
  /** 对用户友好的中文展示名称（Migration 038）。未设置时前台 fallback 到 normalizeProviderName */
  displayName: string | null
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
  ingestPolicy: IngestPolicy
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
  allowAutoPublish?: boolean  // 更新 ingest_policy.allow_auto_publish
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

// ── ADR-146 / CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A：webhook 事件类型 ──

/**
 * Webhook 事件订阅类型（D-146-2）。命名规约：`<module>.<resource>.<verb>`
 * 与 admin audit actionType 命名一致。NotificationsTab 提供多选订阅。
 */
export type WebhookEventType =
  | 'crawler.run.failed'              // 采集 run 失败
  | 'storage.r2.alert'                // R2 配额告警
  | 'moderation.pending.threshold'    // 审核待处理积压超阈值
  | 'submission.created'              // 用户投稿新增
  | 'video.batch.complete'            // 批量发布/导入完成

/** Webhook outbound 请求 body schema */
export interface WebhookDispatchBody {
  readonly event: WebhookEventType | 'webhook.test'  // test 为 admin 连通性测试
  readonly deliveryId: string                         // UUIDv4
  readonly occurredAt: string                         // ISO 8601 UTC
  readonly payload: Record<string, unknown>
}
