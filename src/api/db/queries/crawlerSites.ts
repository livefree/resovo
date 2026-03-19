/**
 * crawlerSites.ts — crawler_sites 表查询
 * CHG-33: 爬虫源站配置 CRUD
 */

import type { Pool } from 'pg'
import type {
  CrawlerSite,
  CreateCrawlerSiteInput,
  UpdateCrawlerSiteInput,
  CrawlerSiteBatchAction,
} from '@/types'

interface DbRow {
  key: string
  name: string
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
  created_at: string
  updated_at: string
}

function rowToSite(row: DbRow): CrawlerSite {
  return {
    key:             row.key,
    name:            row.name,
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

// ── 写入 ──────────────────────────────────────────────────────

export async function upsertCrawlerSite(
  db: Pool,
  input: CreateCrawlerSiteInput & { fromConfig?: boolean },
): Promise<CrawlerSite> {
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
      input.apiUrl,
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

  if (updates.name !== undefined)       { setClauses.push(`name = $${idx++}`);        values.push(updates.name) }
  if (updates.apiUrl !== undefined)     { setClauses.push(`api_url = $${idx++}`);     values.push(updates.apiUrl) }
  if (updates.detail !== undefined)     { setClauses.push(`detail = $${idx++}`);      values.push(updates.detail) }
  if (updates.sourceType !== undefined) { setClauses.push(`source_type = $${idx++}`); values.push(updates.sourceType) }
  if (updates.format !== undefined)     { setClauses.push(`format = $${idx++}`);      values.push(updates.format) }
  if (updates.weight !== undefined)     { setClauses.push(`weight = $${idx++}`);      values.push(updates.weight) }
  if (updates.isAdult !== undefined)    { setClauses.push(`is_adult = $${idx++}`);    values.push(updates.isAdult) }
  if (updates.disabled !== undefined)   { setClauses.push(`disabled = $${idx++}`);    values.push(updates.disabled) }

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
     SET last_crawl_status = $1,
         last_crawled_at   = CASE WHEN $1 != 'running' THEN NOW() ELSE last_crawled_at END,
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
