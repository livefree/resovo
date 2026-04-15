/**
 * crawlerSites.ts — crawler_sites 表查询
 * CHG-33: 爬虫源站配置 CRUD
 */

import type { Pool } from 'pg'
import { DEFAULT_INGEST_POLICY } from '@/types/system.types'
import type {
  CrawlerSite,
  CreateCrawlerSiteInput,
  UpdateCrawlerSiteInput,
  CrawlerSiteBatchAction,
  IngestPolicy,
} from '@/types'

interface DbRow {
  key: string
  name: string
  display_name: string | null
  api_url: string
  detail: string | null
  source_type: string
  format: string
  weight: number
  is_adult: boolean
  disabled: boolean
  from_config: boolean
  last_crawled_at: string | null
  last_crawl_status: string | null
  ingest_policy: IngestPolicy | null
  created_at: string
  updated_at: string
}

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '')
}

function rowToSite(row: DbRow): CrawlerSite {
  return {
    key:             row.key,
    name:            row.name,
    displayName:     row.display_name ?? null,
    apiUrl:          row.api_url,
    detail:          row.detail,
    sourceType:      row.source_type as CrawlerSite['sourceType'],
    format:          row.format as CrawlerSite['format'],
    weight:          row.weight,
    isAdult:         row.is_adult,
    disabled:        row.disabled,
    fromConfig:      row.from_config,
    lastCrawledAt:   row.last_crawled_at,
    lastCrawlStatus: row.last_crawl_status as CrawlerSite['lastCrawlStatus'],
    ingestPolicy:    row.ingest_policy ?? DEFAULT_INGEST_POLICY,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

// ── 查询 ──────────────────────────────────────────────────────

export async function listCrawlerSites(db: Pool): Promise<CrawlerSite[]> {
  const result = await db.query<DbRow>(
    'SELECT * FROM crawler_sites ORDER BY weight DESC, key ASC',
  )
  return result.rows.map(rowToSite)
}

export async function listEnabledCrawlerSites(db: Pool): Promise<CrawlerSite[]> {
  const result = await db.query<DbRow>(
    'SELECT * FROM crawler_sites WHERE disabled = false ORDER BY weight DESC, key ASC',
  )
  return result.rows.map(rowToSite)
}

export async function findCrawlerSite(
  db: Pool,
  key: string,
): Promise<CrawlerSite | null> {
  const result = await db.query<DbRow>(
    'SELECT * FROM crawler_sites WHERE key = $1',
    [key],
  )
  return result.rows[0] ? rowToSite(result.rows[0]) : null
}

export async function findCrawlerSiteByApiUrl(
  db: Pool,
  apiUrl: string,
): Promise<CrawlerSite | null> {
  const normalized = normalizeApiUrl(apiUrl)
  const result = await db.query<DbRow>(
    'SELECT * FROM crawler_sites WHERE api_url = $1',
    [normalized],
  )
  return result.rows[0] ? rowToSite(result.rows[0]) : null
}

// ── 写入 ──────────────────────────────────────────────────────

export async function upsertCrawlerSite(
  db: Pool,
  input: CreateCrawlerSiteInput & { fromConfig?: boolean },
): Promise<CrawlerSite> {
  const normalizedApiUrl = normalizeApiUrl(input.apiUrl)

  // API 地址是唯一标识：优先按 api_url 更新，允许 key 重命名
  const updateByApi = await db.query<DbRow>(
    `UPDATE crawler_sites
     SET key         = $1,
         name        = $2,
         detail      = $3,
         source_type = $4,
         format      = $5,
         weight      = $6,
         is_adult    = $7,
         from_config = $8,
         updated_at  = NOW()
     WHERE api_url = $9
     RETURNING *`,
    [
      input.key,
      input.name,
      input.detail ?? null,
      input.sourceType ?? 'vod',
      input.format ?? 'json',
      input.weight ?? 50,
      input.isAdult ?? false,
      input.fromConfig ?? false,
      normalizedApiUrl,
    ],
  )
  if (updateByApi.rows[0]) {
    return rowToSite(updateByApi.rows[0])
  }

  const result = await db.query<DbRow>(
    `INSERT INTO crawler_sites
       (key, name, api_url, detail, source_type, format, weight, is_adult, from_config, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (key) DO UPDATE SET
       name        = EXCLUDED.name,
       api_url     = EXCLUDED.api_url,
       detail      = EXCLUDED.detail,
       source_type = EXCLUDED.source_type,
       format      = EXCLUDED.format,
       weight      = EXCLUDED.weight,
       is_adult    = EXCLUDED.is_adult,
       from_config = EXCLUDED.from_config,
       updated_at  = NOW()
     RETURNING *`,
    [
      input.key,
      input.name,
      normalizedApiUrl,
      input.detail ?? null,
      input.sourceType ?? 'vod',
      input.format ?? 'json',
      input.weight ?? 50,
      input.isAdult ?? false,
      input.fromConfig ?? false,
    ],
  )
  return rowToSite(result.rows[0])
}

export async function updateCrawlerSite(
  db: Pool,
  key: string,
  updates: UpdateCrawlerSiteInput,
): Promise<CrawlerSite | null> {
  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (updates.name !== undefined)              { setClauses.push(`name = $${idx++}`);        values.push(updates.name) }
  if (updates.apiUrl !== undefined)            { setClauses.push(`api_url = $${idx++}`);     values.push(normalizeApiUrl(updates.apiUrl)) }
  if (updates.detail !== undefined)            { setClauses.push(`detail = $${idx++}`);      values.push(updates.detail) }
  if (updates.sourceType !== undefined)        { setClauses.push(`source_type = $${idx++}`); values.push(updates.sourceType) }
  if (updates.format !== undefined)            { setClauses.push(`format = $${idx++}`);      values.push(updates.format) }
  if (updates.weight !== undefined)            { setClauses.push(`weight = $${idx++}`);      values.push(updates.weight) }
  if (updates.isAdult !== undefined)           { setClauses.push(`is_adult = $${idx++}`);    values.push(updates.isAdult) }
  if (updates.disabled !== undefined)          { setClauses.push(`disabled = $${idx++}`);    values.push(updates.disabled) }
  if (updates.allowAutoPublish !== undefined)  {
    setClauses.push(`ingest_policy = jsonb_set(COALESCE(ingest_policy, '{}'::jsonb), '{allow_auto_publish}', $${idx++}::jsonb)`)
    values.push(updates.allowAutoPublish ? 'true' : 'false')
  }

  if (setClauses.length === 1) return findCrawlerSite(db, key)

  values.push(key)
  const result = await db.query<DbRow>(
    `UPDATE crawler_sites SET ${setClauses.join(', ')} WHERE key = $${idx} RETURNING *`,
    values,
  )
  return result.rows[0] ? rowToSite(result.rows[0]) : null
}

export async function deleteCrawlerSite(db: Pool, key: string): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM crawler_sites WHERE key = $1 AND from_config = false',
    [key],
  )
  return (result.rowCount ?? 0) > 0
}

// ── 采集状态 ──────────────────────────────────────────────────

export async function updateCrawlStatus(
  db: Pool,
  key: string,
  status: 'ok' | 'failed' | 'running',
): Promise<void> {
  await db.query(
    `UPDATE crawler_sites
     SET last_crawl_status = $1::varchar,
         last_crawled_at   = CASE WHEN $1::varchar != 'running' THEN NOW() ELSE last_crawled_at END,
         updated_at        = NOW()
     WHERE key = $2`,
    [status, key],
  )
}

// ── 批量操作 ──────────────────────────────────────────────────

export async function batchUpdateCrawlerSites(
  db: Pool,
  keys: string[],
  action: CrawlerSiteBatchAction,
): Promise<number> {
  if (keys.length === 0) return 0

  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

  let sql: string
  switch (action) {
    case 'enable':
      sql = `UPDATE crawler_sites SET disabled = false, updated_at = NOW() WHERE key IN (${placeholders})`
      break
    case 'disable':
      sql = `UPDATE crawler_sites SET disabled = true, updated_at = NOW() WHERE key IN (${placeholders})`
      break
    case 'delete':
      sql = `DELETE FROM crawler_sites WHERE key IN (${placeholders}) AND from_config = false`
      break
    case 'mark_adult':
      sql = `UPDATE crawler_sites SET is_adult = true, updated_at = NOW() WHERE key IN (${placeholders})`
      break
    case 'unmark_adult':
      sql = `UPDATE crawler_sites SET is_adult = false, updated_at = NOW() WHERE key IN (${placeholders})`
      break
    case 'mark_shortdrama':
      sql = `UPDATE crawler_sites SET source_type = 'shortdrama', updated_at = NOW() WHERE key IN (${placeholders})`
      break
    case 'mark_vod':
      sql = `UPDATE crawler_sites SET source_type = 'vod', updated_at = NOW() WHERE key IN (${placeholders})`
      break
  }

  const result = await db.query(sql, keys)
  return result.rowCount ?? 0
}
