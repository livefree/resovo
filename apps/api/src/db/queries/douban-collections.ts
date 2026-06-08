// douban-collections.ts — external_data.douban_collection_items / _sync_state 查询（ADR-187）
// 所有 SQL 参数化，不拼接字符串（db-rules.md）。
// 全量替换 = 同事务 DELETE WHERE collection + 批量 INSERT + sync_state UPSERT ok（D-187-3 M4①）。
// 失败/守护 → recordCollectionSyncState 仅写 sync_state（items 不动，D-187-4/5）。

import type { Pool } from 'pg'
import type { DoubanCollectionItem } from 'douban-adapter'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type CollectionDomain = 'movie' | 'tv' | 'show'
export type CollectionCategory = 'trending' | 'ranking' | 'upcoming'
export type CollectionSyncStatus = 'ok' | 'failed' | 'empty_guard'

/** 入库行（采集层产出 item + 注册表派生 domain/category + rank） */
export interface CollectionItemInput {
  readonly item: DoubanCollectionItem
  readonly domain: CollectionDomain
  readonly category: CollectionCategory
  readonly rank: number
}

export interface CollectionSyncState {
  collection: string
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastStatus: CollectionSyncStatus | null
  lastError: string | null
  itemCount: number
}

interface DbSyncStateRow {
  collection: string
  last_attempt_at: string | null
  last_success_at: string | null
  last_status: string | null
  last_error: string | null
  item_count: number
}

function mapSyncState(row: DbSyncStateRow): CollectionSyncState {
  return {
    collection: row.collection,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at,
    lastStatus: (row.last_status as CollectionSyncStatus | null) ?? null,
    lastError: row.last_error,
    itemCount: row.item_count,
  }
}

const SYNC_STATE_COLUMNS = `collection,
  last_attempt_at::TEXT AS last_attempt_at,
  last_success_at::TEXT AS last_success_at,
  last_status, last_error, item_count`

// ── 全量替换（成功路径，D-187-3 M4①）──────────────────────────────────────────

/**
 * 同事务全量替换某 collection 的所有条目 + 标记 sync_state='ok'。
 * DELETE WHERE collection + 批量 INSERT + sync_state UPSERT 同一事务——
 * MVCC READ COMMITTED 下并发读 commit 后才见新整份，永不见半份/空榜中间态。
 * 返回写入条目数。
 */
export async function replaceCollectionItems(
  db: Pool,
  collection: string,
  rows: readonly CollectionItemInput[],
): Promise<number> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `DELETE FROM external_data.douban_collection_items WHERE collection = $1`,
      [collection],
    )
    for (const { item, domain, category, rank } of rows) {
      await client.query(
        `INSERT INTO external_data.douban_collection_items
           (collection, domain, category, douban_id, rank, title, original_title,
            card_subtitle, info, year, rating_value, rating_count, cover_url, uri,
            release_date, subject_type, has_linewatch, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          collection,
          domain,
          category,
          item.id,
          rank,
          item.title,
          item.originalTitle,
          item.cardSubtitle,
          item.info,
          parseYear(item.year),
          item.ratingValue,
          item.ratingCount,
          item.coverUrl,
          item.uri,
          item.releaseDate,
          item.subjectType,
          item.hasLinewatch,
          JSON.stringify(item.raw ?? null),
        ],
      )
    }
    await client.query(
      `INSERT INTO external_data.douban_collection_sync_state
         (collection, last_attempt_at, last_success_at, last_status, last_error, item_count)
       VALUES ($1, NOW(), NOW(), 'ok', NULL, $2)
       ON CONFLICT (collection) DO UPDATE SET
         last_attempt_at = NOW(),
         last_success_at = NOW(),
         last_status = 'ok',
         last_error = NULL,
         item_count = EXCLUDED.item_count`,
      [collection, rows.length],
    )
    await client.query('COMMIT')
    return rows.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── 仅记状态（失败 / 守护路径，D-187-4/5）──────────────────────────────────────

/**
 * 抓取失败或 empty_guard：仅 UPSERT sync_state，items 不动（保留上一轮旧数据，D-187-5）。
 * item_count 维持原值（COALESCE 既有；首次失败无既有行则 0）。
 */
export async function recordCollectionSyncState(
  db: Pool,
  collection: string,
  status: 'failed' | 'empty_guard',
  error: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO external_data.douban_collection_sync_state
       (collection, last_attempt_at, last_success_at, last_status, last_error, item_count)
     VALUES ($1, NOW(), NULL, $2, $3, 0)
     ON CONFLICT (collection) DO UPDATE SET
       last_attempt_at = NOW(),
       last_status = $2,
       last_error = $3`,
    [collection, status, error],
  )
}

// ── 读取 ────────────────────────────────────────────────────────────────────────

/** 单 collection 新鲜度状态（抓取 job empty_guard 比对上轮 item_count；无行 → null） */
export async function getCollectionSyncState(
  db: Pool,
  collection: string,
): Promise<CollectionSyncState | null> {
  const result = await db.query<DbSyncStateRow>(
    `SELECT ${SYNC_STATE_COLUMNS}
       FROM external_data.douban_collection_sync_state
      WHERE collection = $1`,
    [collection],
  )
  const row = result.rows[0]
  return row ? mapSyncState(row) : null
}

/** 全部合集新鲜度状态（外部资源治理概览 collectionFreshness，ADR-188；按 collection 升序） */
export async function listAllCollectionSyncState(db: Pool): Promise<CollectionSyncState[]> {
  const result = await db.query<DbSyncStateRow>(
    `SELECT ${SYNC_STATE_COLUMNS}
       FROM external_data.douban_collection_sync_state
      ORDER BY collection ASC`,
  )
  return result.rows.map(mapSyncState)
}

export interface CollectionItemRow {
  doubanId: string
  rank: number
  title: string
  originalTitle: string | null
  year: number | null
  ratingValue: number | null
  ratingCount: number | null
  coverUrl: string | null
  releaseDate: string | null
  subjectType: string | null
  hasLinewatch: boolean
}

interface DbItemRow {
  douban_id: string
  rank: number
  title: string
  original_title: string | null
  year: number | null
  rating_value: string | number | null
  rating_count: number | null
  cover_url: string | null
  release_date: string | null
  subject_type: string | null
  has_linewatch: boolean
}

/** 某 collection 条目按 rank 升序（消费方读路径；limit 防御性截断） */
export async function listCollectionItems(
  db: Pool,
  collection: string,
  limit = 100,
): Promise<CollectionItemRow[]> {
  const result = await db.query<DbItemRow>(
    `SELECT douban_id, rank, title, original_title, year,
            rating_value, rating_count, cover_url, release_date,
            subject_type, has_linewatch
       FROM external_data.douban_collection_items
      WHERE collection = $1
      ORDER BY rank ASC
      LIMIT $2`,
    [collection, Math.min(Math.max(limit, 1), 1000)],
  )
  return result.rows.map((row) => ({
    doubanId: row.douban_id,
    rank: row.rank,
    title: row.title,
    originalTitle: row.original_title,
    year: row.year,
    ratingValue: row.rating_value == null ? null : Number(row.rating_value),
    ratingCount: row.rating_count,
    coverUrl: row.cover_url,
    releaseDate: row.release_date,
    subjectType: row.subject_type,
    hasLinewatch: row.has_linewatch,
  }))
}

// ── 辅助 ────────────────────────────────────────────────────────────────────────

/** 豆瓣 year 为 string（可能 ''/非法）→ INT 列；非法返回 null */
function parseYear(value: string | null): number | null {
  if (!value) return null
  const match = value.match(/\d{4}/)
  if (!match) return null
  const year = Number.parseInt(match[0], 10)
  return Number.isFinite(year) ? year : null
}
