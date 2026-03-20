/**
 * systemSettings.ts — system_settings 表查询
 * CHG-33: 站点配置键值对读写
 */

import type { Pool } from 'pg'
import type { AutoCrawlConfig, AutoCrawlSiteOverride, SystemSettingKey, SiteSettings } from '@/types'

interface DbRow {
  key: SystemSettingKey
  value: string
  updated_at: string
}

// ── 读取 ──────────────────────────────────────────────────────

export async function getSetting(
  db: Pool,
  key: SystemSettingKey,
): Promise<string | null> {
  const result = await db.query<DbRow>(
    'SELECT value FROM system_settings WHERE key = $1',
    [key],
  )
  return result.rows[0]?.value ?? null
}

export async function getAllSettings(db: Pool): Promise<Record<string, string>> {
  const result = await db.query<DbRow>('SELECT key, value FROM system_settings')
  const map: Record<string, string> = {}
  for (const row of result.rows) {
    map[row.key] = row.value
  }
  return map
}

// ── 写入 ──────────────────────────────────────────────────────

export async function setSetting(
  db: Pool,
  key: SystemSettingKey,
  value: string,
): Promise<void> {
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value],
  )
}

export async function setManySettings(
  db: Pool,
  pairs: Partial<Record<SystemSettingKey, string>>,
): Promise<void> {
  const entries = Object.entries(pairs) as [SystemSettingKey, string][]
  if (entries.length === 0) return

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const [key, value] of entries) {
      await client.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── 反序列化为结构化对象 ──────────────────────────────────────

export function deserializeSiteSettings(raw: Record<string, string>): SiteSettings {
  return {
    siteName:              raw.site_name ?? '',
    siteAnnouncement:      raw.site_announcement ?? '',
    doubanProxy:           raw.douban_proxy ?? '',
    doubanCookie:          raw.douban_cookie ?? '',
    showAdultContent:      raw.show_adult_content === 'true',
    contentFilterEnabled:  raw.content_filter_enabled !== 'false',
    videoProxyEnabled:     raw.video_proxy_enabled === 'true',
    videoProxyUrl:         raw.video_proxy_url ?? '',
    autoCrawlEnabled:      raw.auto_crawl_enabled === 'true',
    autoCrawlMaxPerRun:    Number(raw.auto_crawl_max_per_run ?? 100),
    autoCrawlRecentOnly:   raw.auto_crawl_recent_only === 'true',
    autoCrawlRecentDays:   Number(raw.auto_crawl_recent_days ?? 30),
  }
}

function parseDailyTime(input: string | undefined): string {
  const value = (input ?? '').trim()
  if (!/^\d{2}:\d{2}$/.test(value)) return '03:00'
  const [h, m] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '03:00'
  if (h < 0 || h > 23 || m < 0 || m > 59) return '03:00'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parsePerSiteOverrides(input: string | undefined): Record<string, AutoCrawlSiteOverride> {
  if (!input) return {}
  try {
    const parsed = JSON.parse(input) as Record<string, { enabled?: unknown; mode?: unknown }>
    const result: Record<string, AutoCrawlSiteOverride> = {}
    for (const [siteKey, override] of Object.entries(parsed ?? {})) {
      if (!siteKey) continue
      const enabled = override?.enabled === true
      const mode = override?.mode === 'full' || override?.mode === 'incremental' ? override.mode : 'inherit'
      result[siteKey] = { enabled, mode }
    }
    return result
  } catch {
    return {}
  }
}

export function deserializeAutoCrawlConfig(raw: Record<string, string>): AutoCrawlConfig {
  const legacyRecentOnly = raw.auto_crawl_recent_only !== 'false'
  const defaultMode = raw.auto_crawl_default_mode === 'full' || raw.auto_crawl_default_mode === 'incremental'
    ? raw.auto_crawl_default_mode
    : (legacyRecentOnly ? 'incremental' : 'full')

  const conflictPolicy = raw.auto_crawl_conflict_policy === 'queue_after_running'
    ? 'queue_after_running'
    : 'skip_running'

  return {
    globalEnabled: raw.auto_crawl_enabled === 'true',
    scheduleType: 'daily',
    dailyTime: parseDailyTime(raw.auto_crawl_daily_time),
    defaultMode,
    onlyEnabledSites: raw.auto_crawl_only_enabled_sites !== 'false',
    conflictPolicy,
    perSiteOverrides: parsePerSiteOverrides(raw.auto_crawl_per_site_overrides),
  }
}

export async function getAutoCrawlConfig(db: Pool): Promise<AutoCrawlConfig> {
  const raw = await getAllSettings(db)
  return deserializeAutoCrawlConfig(raw)
}

export async function setAutoCrawlConfig(db: Pool, config: AutoCrawlConfig): Promise<void> {
  const pairs: Partial<Record<SystemSettingKey, string>> = {
    auto_crawl_enabled: String(config.globalEnabled),
    auto_crawl_schedule_type: 'daily',
    auto_crawl_daily_time: parseDailyTime(config.dailyTime),
    auto_crawl_default_mode: config.defaultMode,
    auto_crawl_only_enabled_sites: String(config.onlyEnabledSites),
    auto_crawl_conflict_policy: config.conflictPolicy,
    auto_crawl_per_site_overrides: JSON.stringify(config.perSiteOverrides ?? {}),
    // 兼容旧逻辑，直到 scheduler/run 全量切换完成
    auto_crawl_recent_only: String(config.defaultMode !== 'full'),
  }
  await setManySettings(db, pairs)
}
