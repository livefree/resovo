/**
 * system/api.ts — /admin/system/* 视图 API 客户端（CHG-SN-6-03+）
 *
 * 端点（allowlist 豁免；v1 时代 IMG / siteConfig 等卡落地）：
 *   GET /admin/system/scheduler-status     — 4 maintenance schedulers + 全局开关（CHG-SN-6-03）
 *   GET /admin/cache/stats                 — 各类型缓存统计（CHG-SN-6-04）
 *   DELETE /admin/cache/:type              — 清除指定类型缓存（CHG-SN-6-04，运维动作 audit 豁免）
 *   后续扩展：GET/POST settings / config 等
 */

import { apiClient } from '@/lib/api-client'

// CacheType / CacheStat 真源在 packages/types/src/contracts/v1/admin.ts；
// 该 contracts 子目录未在 @resovo/types 顶层 re-export，故此处 inline 镜像
// （字段命名 100% 对齐 contracts；新增类型时同步两处）
export type CacheType = 'search' | 'video' | 'danmaku' | 'analytics' | 'home' | 'all'
export interface CacheStat {
  readonly type: CacheType
  readonly count: number
  readonly sizeKb: number
}

// ── Scheduler / Monitor ──────────────────────────────────────────

export interface SchedulerInfo {
  readonly name: string
  readonly enabled: boolean
  readonly intervalMs: number
}

export interface SchedulerStatusResult {
  readonly enabled: boolean
  readonly schedulers: readonly SchedulerInfo[]
}

export async function getSchedulerStatus(): Promise<SchedulerStatusResult> {
  const result = await apiClient.get<{ data: SchedulerStatusResult }>('/admin/system/scheduler-status')
  return result.data
}

// ── Cache ────────────────────────────────────────────────────────

export async function getCacheStats(): Promise<readonly CacheStat[]> {
  const result = await apiClient.get<{ data: readonly CacheStat[] }>('/admin/cache/stats')
  return result.data
}

export async function clearCache(type: CacheType): Promise<{ deleted: number }> {
  const result = await apiClient.delete<{ data: { deleted: number } }>(
    `/admin/cache/${encodeURIComponent(type)}`,
  )
  return result.data
}

// ── Settings（站点设置 13 字段；CHG-SN-6-07） ────────────────────

import type { SiteSettings } from '@resovo/types'
export type { SiteSettings }

/** 写入 payload — 全字段 optional（部分更新） */
export type SiteSettingsPatch = Partial<SiteSettings>

// ── 按 Tab 窄化 DTO（FIX-SETTINGS-PARTIAL-SAVE）─────────────────────
// 每个 Tab 只能提交自己负责的字段，编译期杜绝越界覆盖其它 Tab（后端 schema 全 optional +
// 部分 upsert，天然支持窄提交）。bangumiApiTokenSet/tmdbApiKeySet 为 GET 派生只读，不入 patch。

/** 基础设置 Tab（基础信息 / 内容过滤 / 豆瓣 / 自动爬取 / 外部数据源） */
export type GeneralSettingsPatch = Partial<Pick<SiteSettings,
  | 'siteName' | 'siteAnnouncement'
  | 'showAdultContent' | 'contentFilterEnabled' | 'videoProxyEnabled' | 'videoProxyUrl'
  | 'doubanProxy' | 'doubanCookie'
  | 'autoCrawlEnabled' | 'autoCrawlMaxPerRun' | 'autoCrawlRecentOnly' | 'autoCrawlRecentDays'
  | 'bangumiApiToken' | 'bangumiUserAgent' | 'bangumiApiTimeoutMs' | 'tmdbApiKey'
>>

/** 通知 Tab */
export type NotificationSettingsPatch = Partial<Pick<SiteSettings,
  | 'notificationEmailEnabled' | 'notificationEmailTo'
  | 'notificationWebhookEnabled' | 'notificationWebhookUrl' | 'notificationWebhookSecret'
  | 'notificationWebhookEvents'
>>

/** 登录与会话 Tab */
export type SessionSettingsPatch = Partial<Pick<SiteSettings,
  | 'sessionTimeoutMinutes' | 'sessionMaxConcurrent' | 'sessionExtendOnActivity'
>>

export async function getSiteSettings(): Promise<SiteSettings> {
  const result = await apiClient.get<{ data: SiteSettings }>('/admin/system/settings')
  return result.data
}

/** 接受任一 Tab 的窄 patch（底层端点接受 Partial<SiteSettings> 部分更新） */
export async function saveSiteSettings(
  patch: GeneralSettingsPatch | NotificationSettingsPatch | SessionSettingsPatch,
): Promise<{ ok: true }> {
  const result = await apiClient.post<{ data: { ok: true } }>('/admin/system/settings', patch)
  return result.data
}

// ── Config（运行时 JSON 配置；CHG-SN-6-05） ──────────────────────

export interface SystemConfig {
  readonly configFile: string
  readonly subscriptionUrl: string
}

export interface SystemConfigSaveResult {
  readonly ok: true
  readonly synced: number
  readonly skipped: number
  // CHG-SN-7-MISC-CRAWLER-CONFIG-ORPHAN-DELETE：配置文件移除的孤儿站点同步删除统计
  readonly orphanDeleted: number
  readonly orphanDeletedKeys: readonly string[]
}

export async function getSystemConfig(): Promise<SystemConfig> {
  const result = await apiClient.get<{ data: SystemConfig }>('/admin/system/config')
  return result.data
}

export async function saveSystemConfig(input: {
  configFile: string
  subscriptionUrl?: string
}): Promise<SystemConfigSaveResult> {
  const result = await apiClient.post<{ data: SystemConfigSaveResult }>('/admin/system/config', input)
  return result.data
}

// ── Migration（数据导出 / 导入；CHG-SN-6-08） ───────────────────

export interface ImportSourcesResult {
  readonly imported: number
  readonly skipped: number
  readonly errors: ReadonlyArray<{ readonly index: number; readonly shortId?: string; readonly error: string }>
}

/**
 * 触发浏览器下载 sources JSON 文件（GET /admin/export/sources）
 *
 * 策略：fetch 带 Bearer token 拿响应 → blob URL → `<a download>` 触发；
 * 不能直接 `window.location =` 端点因 Authorization header 无法注入
 */
export async function exportSourcesDownload(): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'
  const token = (await import('@/stores/authStore')).useAuthStore.getState().accessToken
  const response = await fetch(`${baseUrl}/admin/export/sources`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`导出失败 (${response.status})`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = response.headers.get('Content-Disposition')?.match(/filename=([^;]+)/)?.[1]?.replace(/"/g, '') ?? `sources-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 上传 sources JSON 文件导入（POST /admin/import/sources，multipart）
 *
 * RETRO-3-A audit_log system.sources_import 已写入位点（route 层 auditSvc.write）
 */
export async function importSourcesUpload(file: File): Promise<ImportSourcesResult> {
  const fd = new FormData()
  fd.append('file', file)
  const result = await apiClient.postMultipart<{ data: ImportSourcesResult }>('/admin/import/sources', fd)
  return result.data
}
