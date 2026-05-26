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
    autoCrawlEnabled:           raw.auto_crawl_enabled === 'true',
    autoCrawlMaxPerRun:         Number(raw.auto_crawl_max_per_run ?? 100),
    autoCrawlRecentOnly:        raw.auto_crawl_recent_only === 'true',
    autoCrawlRecentDays:        Number(raw.auto_crawl_recent_days ?? 30),
    notificationEmailEnabled:   raw.notification_email_enabled === 'true',
    notificationEmailTo:        raw.notification_email_to ?? '',
    notificationWebhookEnabled: raw.notification_webhook_enabled === 'true',
    notificationWebhookUrl:     raw.notification_webhook_url ?? '',
    notificationWebhookSecret:  raw.notification_webhook_secret ?? '',
    // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B / ADR-146：事件订阅 JSON 数组（解析失败降级 []）
    notificationWebhookEvents:  parseWebhookEvents(raw.notification_webhook_events),
    sessionTimeoutMinutes:      Number(raw.session_timeout_minutes ?? 60),
    sessionMaxConcurrent:       Number(raw.session_max_concurrent ?? 5),
    sessionExtendOnActivity:    raw.session_extend_on_activity !== 'false',
  }
}

function parseWebhookEvents(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    // ignore malformed JSON
  }
  return []
}

function parseDailyTime(input: string | undefined): string {
  const value = (input ?? '').trim()
  if (!/^\d{2}:\d{2}$/.test(value)) return '03:00'
  const [h, m] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '03:00'
  if (h < 0 || h > 23 || m < 0 || m > 59) return '03:00'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * ADR-155 D-155-6 / EP-1C-1a：多 dailyTime KV 反序列化（R-155-3 必修 / 3 路径兼容）。
 *
 * KV `auto_crawl_daily_time` value 历史形态（按出现顺序）：
 *   - 旧裸单字符串："03:00"（CHG-SN-6-27 起）
 *   - JSON 字符串：'"03:00"'（极少出现 / 误操作）
 *   - JSON 数组：'["03:00","04:00"]'（D-155-6 后新格式）
 *
 * 非法 / 空 / 解析失败统一兜底 `['03:00']`（默认全局每日 3am）。
 */
function parseDailyTimes(input: string | undefined): readonly string[] {
  const raw = (input ?? '').trim()
  if (!raw) return ['03:00']

  // 路径 1：尝试 JSON.parse
  try {
    const parsed: unknown = JSON.parse(raw)
    // 路径 1a：JSON 数组 → 过滤合法 HH:MM
    if (Array.isArray(parsed)) {
      const valid = parsed
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter((x) => /^\d{2}:\d{2}$/.test(x))
        .map((x) => {
          const [h, m] = x.split(':').map(Number)
          if (h < 0 || h > 23 || m < 0 || m > 59) return null
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        })
        .filter((x): x is string => x !== null)
      return valid.length > 0 ? valid : ['03:00']
    }
    // 路径 1b：JSON 但 typeof === 'string'（旧值被引号包裹）→ [parsed]
    if (typeof parsed === 'string' && /^\d{2}:\d{2}$/.test(parsed.trim())) {
      const single = parseDailyTime(parsed.trim())
      return [single]
    }
  } catch {
    // 路径 2：非 JSON → 视为裸 HH:MM 旧值
    if (/^\d{2}:\d{2}$/.test(raw)) {
      return [parseDailyTime(raw)]
    }
  }
  // 兜底
  return ['03:00']
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

  // ADR-154 D-154-1：scheduleType 两态（向后兼容：无 / 'daily' → 'daily'）
  const scheduleType: import('@/types').AutoCrawlScheduleType =
    raw.auto_crawl_schedule_type === 'interval' ? 'interval' : 'daily'

  // ADR-154 D-154-1：intervalMinutes 默认 60（向后兼容：无键 → 默认值）
  const intervalMinutes = Math.max(5, Math.min(1440, Number(raw.auto_crawl_interval_minutes) || 60))

  // ADR-155 D-155-6：多 dailyTime（主字段）+ dailyTime alias 向后兼容
  const dailyTimes = parseDailyTimes(raw.auto_crawl_daily_time)
  const dailyTime = dailyTimes[0] ?? '03:00'

  return {
    globalEnabled: raw.auto_crawl_enabled === 'true',
    scheduleType,
    dailyTimes,
    dailyTime,
    intervalMinutes,
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
  // ADR-155 D-155-6 / EP-1C-1a Y-155-1：dailyTime → dailyTimes 序列化升级
  //   - 优先用 dailyTimes（新格式 / 多时间）；
  //   - 兜底从 dailyTime alias 推 `[dailyTime]`（兼容仅传 dailyTime 的旧调用方 / EP-1C-1b zod preprocess 后会消失）；
  //   - 每个 HH:MM 都通过 parseDailyTime 规范化（防御非法格式）。
  const inputTimes = config.dailyTimes && config.dailyTimes.length > 0
    ? config.dailyTimes
    : [config.dailyTime || '03:00']
  const normalizedTimes = inputTimes.map(parseDailyTime)

  const pairs: Partial<Record<SystemSettingKey, string>> = {
    auto_crawl_enabled: String(config.globalEnabled),
    auto_crawl_schedule_type: config.scheduleType,                    // ADR-154 D-154-1：解除写死
    auto_crawl_interval_minutes: String(config.intervalMinutes ?? 60), // ADR-154 D-154-1
    auto_crawl_daily_time: JSON.stringify(normalizedTimes),            // ADR-155 D-155-6：永远写 JSON 数组
    auto_crawl_default_mode: config.defaultMode,
    auto_crawl_only_enabled_sites: String(config.onlyEnabledSites),
    auto_crawl_conflict_policy: config.conflictPolicy,
    auto_crawl_per_site_overrides: JSON.stringify(config.perSiteOverrides ?? {}),
    // 兼容旧逻辑，直到 scheduler/run 全量切换完成
    auto_crawl_recent_only: String(config.defaultMode !== 'full'),
  }
  await setManySettings(db, pairs)
}
