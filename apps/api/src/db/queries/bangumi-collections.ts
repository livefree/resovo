// bangumi-collections.ts — external_data.bangumi_collection_items / _sync_state 查询（ADR-189 D-189-3）
// 所有 SQL 参数化，不拼接字符串（db-rules.md）。落库范式对齐 douban-collections：
//   全量替换 = 同事务 DELETE WHERE collection + 批量 INSERT + sync_state UPSERT ok。
//   calendar「一拉七写」原子 = replaceBangumiCollectionGroupsAtomic 单事务替换多 collection（D-189-2）。
//   失败/守护 → recordBangumiCollectionSyncState 仅写 sync_state（items 不动）。

import type { Pool, PoolClient } from 'pg'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type BangumiCollectionCategory = 'trending' | 'ranking' | 'calendar'
export type BangumiCollectionSyncStatus = 'ok' | 'failed' | 'empty_guard'

/** 入库行（worker 从 search/calendar 产出，规整为中性 shape） */
export interface BangumiCollectionItemInput {
  readonly bangumiId: string
  readonly rank: number
  readonly title: string
  readonly nameCn: string | null
  readonly year: number | null
  readonly rating: number | null
  /** 仅 calendar 非空（1=周一..7=周日） */
  readonly airWeekday: number | null
  readonly coverUrl: string | null
  readonly raw: unknown
}

/** 一个 collection 的全量替换组（含 category 归类） */
export interface BangumiCollectionGroup {
  readonly collection: string
  readonly category: BangumiCollectionCategory
  readonly rows: readonly BangumiCollectionItemInput[]
}

export interface BangumiCollectionSyncState {
  collection: string
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastStatus: BangumiCollectionSyncStatus | null
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

function mapSyncState(row: DbSyncStateRow): BangumiCollectionSyncState {
  return {
    collection: row.collection,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at,
    lastStatus: (row.last_status as BangumiCollectionSyncStatus | null) ?? null,
    lastError: row.last_error,
    itemCount: row.item_count,
  }
}

const SYNC_STATE_COLUMNS = `collection,
  last_attempt_at::TEXT AS last_attempt_at,
  last_success_at::TEXT AS last_success_at,
  last_status, last_error, item_count`

// ── 全量替换（成功路径）──────────────────────────────────────────────────────────

/** 单 collection 的 DELETE + 批量 INSERT + sync_state UPSERT ok（复用同一 client/事务） */
async function replaceOneCollection(
  client: PoolClient,
  group: BangumiCollectionGroup,
): Promise<void> {
  await client.query(
    `DELETE FROM external_data.bangumi_collection_items WHERE collection = $1`,
    [group.collection],
  )
  for (const row of group.rows) {
    await client.query(
      `INSERT INTO external_data.bangumi_collection_items
         (collection, category, bangumi_id, rank, title, name_cn, year, rating, air_weekday, cover_url, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        group.collection,
        group.category,
        row.bangumiId,
        row.rank,
        row.title,
        row.nameCn,
        row.year,
        row.rating,
        row.airWeekday,
        row.coverUrl,
        JSON.stringify(row.raw ?? null),
      ],
    )
  }
  await client.query(
    `INSERT INTO external_data.bangumi_collection_sync_state
       (collection, last_attempt_at, last_success_at, last_status, last_error, item_count)
     VALUES ($1, NOW(), NOW(), 'ok', NULL, $2)
     ON CONFLICT (collection) DO UPDATE SET
       last_attempt_at = NOW(),
       last_success_at = NOW(),
       last_status = 'ok',
       last_error = NULL,
       item_count = EXCLUDED.item_count`,
    [group.collection, group.rows.length],
  )
}

/**
 * 单 collection 全量替换（trending/ranking 各自独立，对齐 douban replaceCollectionItems）。
 * MVCC READ COMMITTED 下并发读 commit 后才见新整份，永不见半份/空榜中间态。返回写入条目数。
 */
export async function replaceBangumiCollectionItems(
  db: Pool,
  collection: string,
  category: BangumiCollectionCategory,
  rows: readonly BangumiCollectionItemInput[],
): Promise<number> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await replaceOneCollection(client, { collection, category, rows })
    await client.query('COMMIT')
    return rows.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * 多 collection 原子全量替换（calendar「一拉七写」，ADR-189 D-189-2）。
 * 7 weekday 共享一次 GET /calendar → 单事务替换全部：要么全替换、要么全保留旧值。
 * 任一组失败整体 ROLLBACK（不留半份 calendar）。返回写入总条目数。
 */
export async function replaceBangumiCollectionGroupsAtomic(
  db: Pool,
  groups: readonly BangumiCollectionGroup[],
): Promise<number> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    let total = 0
    for (const group of groups) {
      await replaceOneCollection(client, group)
      total += group.rows.length
    }
    await client.query('COMMIT')
    return total
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── 仅记状态（失败 / 守护路径）─────────────────────────────────────────────────────

/**
 * 抓取失败或 empty_guard：仅 UPSERT sync_state，items 不动（保留上一轮旧数据）。
 * 失败路径绝不刷新 last_success_at（陈旧度据其持续增长）。calendar 整体失败时由调用方对 7 key 逐个调用。
 */
export async function recordBangumiCollectionSyncState(
  db: Pool,
  collection: string,
  status: 'failed' | 'empty_guard',
  error: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO external_data.bangumi_collection_sync_state
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

/** 单 collection 新鲜度状态（worker empty_guard 比对上轮 item_count；无行 → null） */
export async function getBangumiCollectionSyncState(
  db: Pool,
  collection: string,
): Promise<BangumiCollectionSyncState | null> {
  const result = await db.query<DbSyncStateRow>(
    `SELECT ${SYNC_STATE_COLUMNS}
       FROM external_data.bangumi_collection_sync_state
      WHERE collection = $1`,
    [collection],
  )
  const row = result.rows[0]
  return row ? mapSyncState(row) : null
}

/** 全部合集新鲜度状态（治理概览 collectionFreshness；按 collection 升序） */
export async function listAllBangumiCollectionSyncState(db: Pool): Promise<BangumiCollectionSyncState[]> {
  const result = await db.query<DbSyncStateRow>(
    `SELECT ${SYNC_STATE_COLUMNS}
       FROM external_data.bangumi_collection_sync_state
      ORDER BY collection ASC`,
  )
  return result.rows.map(mapSyncState)
}

// ── 治理浏览（ADR-189 热门·每日放送 Tab）─────────────────────────────────────────

export interface BangumiCollectionBrowseRow {
  collection: string
  category: string
  bangumiId: string
  rank: number
  title: string
  nameCn: string | null
  year: number | null
  rating: number | null
  airWeekday: number | null
  coverUrl: string | null
}

interface DbBrowseRow {
  collection: string
  category: string
  bangumi_id: string
  rank: number
  title: string
  name_cn: string | null
  year: number | null
  rating: string | number | null
  air_weekday: number | null
  cover_url: string | null
}

function mapBrowseRow(r: DbBrowseRow): BangumiCollectionBrowseRow {
  return {
    collection: r.collection,
    category: r.category,
    bangumiId: r.bangumi_id,
    rank: r.rank,
    title: r.title,
    nameCn: r.name_cn,
    year: r.year,
    rating: r.rating == null ? null : Number(r.rating),
    airWeekday: r.air_weekday,
    coverUrl: r.cover_url,
  }
}

/**
 * 合集展示排序（近期新番 → 高分排行 → 每日放送周一..周日）：
 * category 优先级 + calendar 内按 air_weekday(1=周一..7=周日)，**非英文 collection key 字母序**
 * （修复 chips/条目按 bgm_calendar_fri/mon/sat… 字母序错乱，按日期正确排列）。
 */
const COLLECTION_ORDER_SQL = `CASE category WHEN 'trending' THEN 0 WHEN 'ranking' THEN 1 ELSE 2 END, air_weekday ASC NULLS FIRST`

/** 合集条目分页浏览（可选 collection 过滤；跨合集按 类别→放送星期→rank 排序）。 */
export async function listBangumiCollectionItemsPaged(
  db: Pool,
  opts: { collection?: string; limit: number; offset: number },
): Promise<{ rows: BangumiCollectionBrowseRow[]; total: number }> {
  const params: unknown[] = []
  let where = ''
  if (opts.collection) {
    params.push(opts.collection)
    where = `WHERE collection = $1`
  }
  const totalRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM external_data.bangumi_collection_items ${where}`,
    params,
  )
  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
  const rowsRes = await db.query<DbBrowseRow>(
    `SELECT collection, category, bangumi_id, rank, title, name_cn, year, rating, air_weekday, cover_url
       FROM external_data.bangumi_collection_items ${where}
      ORDER BY ${COLLECTION_ORDER_SQL}, collection ASC, rank ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, Math.min(Math.max(opts.limit, 1), 100), Math.max(opts.offset, 0)],
  )
  return {
    rows: rowsRes.rows.map(mapBrowseRow),
    total: Number.parseInt(totalRes.rows[0]?.count ?? '0', 10),
  }
}

export interface BangumiCollectionSummaryRow {
  collection: string
  category: string
  count: number
}

/**
 * 各合集条目数摘要（热门·每日放送 Tab 分类 chips；近期新番→高分排行→周一..周日）。
 * grouped → 用 `MIN(air_weekday)` 排 calendar 内放送星期（修复字母序错乱，按日期正确排列）。
 */
export async function listBangumiCollectionsSummary(db: Pool): Promise<BangumiCollectionSummaryRow[]> {
  const res = await db.query<{ collection: string; category: string; count: string }>(
    `SELECT collection, category, COUNT(*)::TEXT AS count
       FROM external_data.bangumi_collection_items
      GROUP BY collection, category
      ORDER BY
        CASE category WHEN 'trending' THEN 0 WHEN 'ranking' THEN 1 ELSE 2 END,
        MIN(air_weekday) ASC NULLS FIRST,
        collection ASC`,
  )
  return res.rows.map((r) => ({
    collection: r.collection,
    category: r.category,
    count: Number.parseInt(r.count, 10),
  }))
}
