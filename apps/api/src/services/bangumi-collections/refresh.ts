/**
 * refresh.ts — Bangumi 派生合集采集编排（ADR-189 D-189-2）
 *
 * - trending/ranking：分页 searchSubjectsSorted（sort=heat/rank）→ per-collection empty_guard → 全量替换
 * - calendar：getCalendar 一次 → 7 weekday 分组 → 7 天总量 empty_guard → **一拉七写**原子替换（整体失败全不替换）
 * worker 消费（bangumiCollectionsQueue）。网络 I/O 在本编排层；source=collections_worker（埋点在 lib/bangumi）。
 */

import type { Pool } from 'pg'
import { browseSubjects, getCalendar } from '@/api/lib/bangumi'
import type { BangumiSearchItem, BangumiCalendarItem } from '@/api/lib/bangumi'
import {
  replaceBangumiCollectionItems,
  replaceBangumiCollectionGroupsAtomic,
  recordBangumiCollectionSyncState,
  getBangumiCollectionSyncState,
  listAllBangumiCollectionSyncState,
  type BangumiCollectionItemInput,
  type BangumiCollectionGroup,
} from '@/api/db/queries/bangumi-collections'
import {
  BANGUMI_SEARCH_COLLECTIONS,
  BANGUMI_CALENDAR_COLLECTIONS,
  calendarKeyForWeekday,
  SEARCH_PAGE_SIZE,
  SEARCH_MAX_ITEMS,
  SEARCH_PAGE_DELAY_MS,
  COLLECTION_DELAY_MS,
  GUARD_MIN_BASELINE,
  GUARD_DROP_RATIO,
  CALENDAR_GUARD_MIN_BASELINE,
  type BangumiCollectionEntry,
} from './registry'
import { baseLogger } from '@/api/lib/logger'

const log = baseLogger.child({ service: 'bangumi-collections-refresh' })

export type BangumiRefreshStatus = 'ok' | 'failed' | 'empty_guard'

export interface BangumiRefreshResult {
  collection: string
  status: BangumiRefreshStatus
  count: number
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function parseYear(date: string | null | undefined): number | null {
  if (!date) return null
  const m = date.match(/(\d{4})/)
  return m ? Number.parseInt(m[1], 10) : null
}

function coverOf(images: { large?: string; common?: string } | null | undefined): string | null {
  return images?.large || images?.common || null
}

/** search 候选 → 入库行（rank=累积序位）。 */
function mapSearchItem(item: BangumiSearchItem, rank: number): BangumiCollectionItemInput {
  return {
    bangumiId: String(item.id),
    rank,
    title: item.name_cn?.trim() || item.name,
    nameCn: item.name_cn?.trim() || null,
    year: parseYear(item.date),
    rating: item.rating?.score ?? null,
    airWeekday: null,
    coverUrl: coverOf(item.images),
    raw: item,
  }
}

/** calendar 条目 → 入库行（airWeekday 来自所属 day）。 */
function mapCalendarItem(item: BangumiCalendarItem, weekday: number, rank: number): BangumiCollectionItemInput {
  return {
    bangumiId: String(item.id),
    rank,
    title: item.name_cn?.trim() || item.name,
    nameCn: item.name_cn?.trim() || null,
    year: parseYear(item.air_date),
    rating: item.rating?.score ?? null,
    airWeekday: weekday,
    coverUrl: coverOf(item.images),
    raw: item,
  }
}

/**
 * 分页拉取 search 派生合集（trending/ranking），累积 rank。
 * 任一页 searchSubjectsSorted 返回 null（抓取失败）→ 整轮失败返回 null（不以部分替换，保全量语义 + 失败信号）。
 */
async function collectSearchItems(
  entry: BangumiCollectionEntry & { sort: 'date' | 'rank' },
): Promise<BangumiCollectionItemInput[] | null> {
  const rows: BangumiCollectionItemInput[] = []
  let offset = 0
  // 近期新番（sort=date）限当年，避免拉到远期未定档；高分排行（sort=rank）全量
  const year = entry.sort === 'date' ? new Date().getFullYear() : undefined
  while (rows.length < SEARCH_MAX_ITEMS) {
    const items = await browseSubjects(
      { sort: entry.sort, type: 2, ...(year ? { year } : {}), limit: SEARCH_PAGE_SIZE, offset },
      undefined,
      'collections_worker',
    )
    if (items === null) return null // 抓取失败 → 整轮失败
    if (items.length === 0) break
    for (const item of items) {
      if (rows.length >= SEARCH_MAX_ITEMS) break
      rows.push(mapSearchItem(item, rows.length))
    }
    if (items.length < SEARCH_PAGE_SIZE) break // 末页
    offset += SEARCH_PAGE_SIZE
    if (rows.length < SEARCH_MAX_ITEMS) await delay(SEARCH_PAGE_DELAY_MS)
  }
  return rows
}

/** empty_guard 判定：空 / 相对上轮骤降（上轮 ≥ baseline 才启用）。 */
function isGuardTriggered(count: number, prevCount: number, baseline: number): boolean {
  return count === 0 || (prevCount >= baseline && count < prevCount * GUARD_DROP_RATIO)
}

/** 刷新单个 browse 合集（trending/ranking）：抓取 → 失败/empty_guard → 全量替换。 */
export async function refreshSearchCollection(
  db: Pool,
  entry: BangumiCollectionEntry & { sort: 'date' | 'rank' },
): Promise<BangumiRefreshResult> {
  const prev = await getBangumiCollectionSyncState(db, entry.key)
  const rows = await collectSearchItems(entry)

  if (rows === null) {
    await recordBangumiCollectionSyncState(db, entry.key, 'failed', 'fetch failed')
    log.warn({ collection: entry.key }, 'refresh failed (fetch)')
    return { collection: entry.key, status: 'failed', count: 0 }
  }

  const prevCount = prev?.itemCount ?? 0
  if (isGuardTriggered(rows.length, prevCount, GUARD_MIN_BASELINE)) {
    await recordBangumiCollectionSyncState(db, entry.key, 'empty_guard', `count ${rows.length} vs prev ${prevCount}`)
    log.warn({ collection: entry.key, count: rows.length, prevCount }, 'refresh empty_guard')
    return { collection: entry.key, status: 'empty_guard', count: rows.length }
  }

  await replaceBangumiCollectionItems(db, entry.key, entry.category, rows)
  log.info({ collection: entry.key, count: rows.length }, 'refresh ok')
  return { collection: entry.key, status: 'ok', count: rows.length }
}

/**
 * 刷新每日放送（calendar，一拉七写，D-189-2）：getCalendar 一次 → 7 weekday 分组。
 * - 抓取失败（null）→ 7 key 统一标 failed，全不替换。
 * - 7 天总量 empty_guard（对比上轮 7 calendar 合集总 item_count）→ 7 key 标 empty_guard，全不替换。
 * - 正常 → replaceBangumiCollectionGroupsAtomic 单事务全替换（要么全替换、要么全保留）。
 * 返回 7 个 weekday 的结果（状态一致）。
 */
export async function refreshCalendar(db: Pool): Promise<BangumiRefreshResult[]> {
  const calendarKeys = BANGUMI_CALENDAR_COLLECTIONS.map((c) => c.key)
  const days = await getCalendar(undefined, 'collections_worker')

  if (days === null) {
    for (const key of calendarKeys) {
      await recordBangumiCollectionSyncState(db, key, 'failed', 'calendar fetch failed')
    }
    log.warn({ collections: calendarKeys.length }, 'calendar refresh failed (fetch)')
    return calendarKeys.map((collection) => ({ collection, status: 'failed' as const, count: 0 }))
  }

  // weekday.id → 分组行（一次 calendar 拆 7 组）
  const groupRows = new Map<string, BangumiCollectionItemInput[]>()
  for (const key of calendarKeys) groupRows.set(key, [])
  for (const day of days) {
    const weekday = day.weekday?.id
    const key = typeof weekday === 'number' ? calendarKeyForWeekday(weekday) : null
    if (!key) continue // 越界 weekday 防御性跳过
    const items = Array.isArray(day.items) ? day.items : []
    const rows = items.map((item, i) => mapCalendarItem(item, weekday, i))
    groupRows.set(key, rows)
  }

  const total = [...groupRows.values()].reduce((n, r) => n + r.length, 0)

  // 7 天总量 empty_guard（上轮总量 = 7 calendar 合集 item_count 之和）
  const syncStates = await listAllBangumiCollectionSyncState(db)
  const prevTotal = syncStates
    .filter((s) => calendarKeys.includes(s.collection))
    .reduce((n, s) => n + s.itemCount, 0)
  if (isGuardTriggered(total, prevTotal, CALENDAR_GUARD_MIN_BASELINE)) {
    for (const key of calendarKeys) {
      await recordBangumiCollectionSyncState(db, key, 'empty_guard', `calendar total ${total} vs prev ${prevTotal}`)
    }
    log.warn({ total, prevTotal }, 'calendar refresh empty_guard')
    return calendarKeys.map((collection) => ({ collection, status: 'empty_guard' as const, count: groupRows.get(collection)?.length ?? 0 }))
  }

  // 一拉七写：单事务原子全量替换
  const groups: BangumiCollectionGroup[] = calendarKeys.map((collection) => ({
    collection,
    category: 'calendar' as const,
    rows: groupRows.get(collection) ?? [],
  }))
  await replaceBangumiCollectionGroupsAtomic(db, groups)
  log.info({ total }, 'calendar refresh ok (atomic 7-day)')
  return groups.map((g) => ({ collection: g.collection, status: 'ok' as const, count: g.rows.length }))
}

/** 遍历刷新全部 Bangumi 派生合集（search 各自 + calendar 一拉七写；单合集异常隔离记 failed）。 */
export async function refreshAllBangumiCollections(db: Pool): Promise<BangumiRefreshResult[]> {
  const results: BangumiRefreshResult[] = []

  // trending / ranking（各自独立替换，合集间礼貌延时）
  for (let i = 0; i < BANGUMI_SEARCH_COLLECTIONS.length; i++) {
    const entry = BANGUMI_SEARCH_COLLECTIONS[i]!
    try {
      results.push(await refreshSearchCollection(db, entry))
    } catch (err) {
      await recordBangumiCollectionSyncState(db, entry.key, 'failed', String(err)).catch(() => undefined)
      log.warn({ collection: entry.key, err }, 'refresh threw')
      results.push({ collection: entry.key, status: 'failed', count: 0 })
    }
    await delay(COLLECTION_DELAY_MS)
  }

  // calendar（一拉七写）
  try {
    results.push(...(await refreshCalendar(db)))
  } catch (err) {
    for (const c of BANGUMI_CALENDAR_COLLECTIONS) {
      await recordBangumiCollectionSyncState(db, c.key, 'failed', String(err)).catch(() => undefined)
      results.push({ collection: c.key, status: 'failed', count: 0 })
    }
    log.warn({ err }, 'calendar refresh threw')
  }

  return results
}
