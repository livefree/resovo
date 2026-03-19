/**
 * systemSettings.ts — system_settings 表查询
 * CHG-33: 站点配置键值对读写
 */

import type { Pool } from 'pg'
import type { SystemSettingKey, SiteSettings } from '@/types'

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
