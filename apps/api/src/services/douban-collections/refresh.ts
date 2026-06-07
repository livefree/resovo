/**
 * refresh.ts — 豆瓣合集采集编排（ADR-187 D-187-3/4）
 *
 * 注册表驱动遍历 16 合集：分页全量拉取（累积 rank）→ 失败/empty_guard 判定
 * → 事务全量替换（queries 层）。worker 消费（maintenanceQueue refresh-douban-collections）。
 * 网络 I/O 在本编排层；候选生成（home autofill）仍纯 DB（ADR-183 边界不变）。
 */

import type { Pool } from 'pg'
import { getDoubanCollectionItems } from '@/api/lib/doubanAdapter'
import {
  replaceCollectionItems,
  recordCollectionSyncState,
  getCollectionSyncState,
  type CollectionItemInput,
} from '@/api/db/queries/douban-collections'
import {
  DOUBAN_COLLECTIONS,
  PAGE_SIZE,
  GLOBAL_MAX_ITEMS,
  PAGE_DELAY_MS,
  COLLECTION_DELAY_MS,
  GUARD_MIN_BASELINE,
  GUARD_DROP_RATIO,
  type DoubanCollectionEntry,
} from './registry'
import { baseLogger } from '@/api/lib/logger'

const log = baseLogger.child({ service: 'douban-collections-refresh' })

export type CollectionRefreshStatus = 'ok' | 'failed' | 'empty_guard'

export interface CollectionRefreshResult {
  collection: string
  status: CollectionRefreshStatus
  count: number
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * 分页全量拉取某合集；累积 rank（全局序位）。
 * 中途任一页抓取失败（getDoubanCollectionItems → null）返回 null = 整轮失败，
 * 不以部分列表替换（保全量替换语义）。空页正常终止。
 */
async function collectAllItems(
  entry: DoubanCollectionEntry,
): Promise<CollectionItemInput[] | null> {
  const cap = entry.maxItems ?? GLOBAL_MAX_ITEMS
  const rows: CollectionItemInput[] = []
  let start = 0
  let total = Number.POSITIVE_INFINITY
  while (rows.length < cap && start < total) {
    const page = await getDoubanCollectionItems(entry.key, start, PAGE_SIZE)
    if (page === null) return null
    total = page.total
    if (page.items.length === 0) break
    for (const item of page.items) {
      if (rows.length >= cap) break
      rows.push({ item, domain: entry.domain, category: entry.category, rank: rows.length })
    }
    start += PAGE_SIZE
    if (rows.length < cap && start < total) await delay(PAGE_DELAY_MS)
  }
  return rows
}

/** 刷新单合集：抓取 → 失败/empty_guard 判定 → 全量替换（D-187-3/4） */
export async function refreshCollection(
  db: Pool,
  entry: DoubanCollectionEntry,
): Promise<CollectionRefreshResult> {
  const prev = await getCollectionSyncState(db, entry.key)
  const rows = await collectAllItems(entry)

  if (rows === null) {
    await recordCollectionSyncState(db, entry.key, 'failed', 'fetch failed')
    log.warn({ collection: entry.key }, 'refresh failed (fetch)')
    return { collection: entry.key, status: 'failed', count: 0 }
  }

  // empty_guard：空 / 相对上轮骤降 → 不替换，保留旧数据（防 key 失效静默清空）
  const prevCount = prev?.itemCount ?? 0
  const guardTriggered =
    rows.length === 0 ||
    (prevCount >= GUARD_MIN_BASELINE && rows.length < prevCount * GUARD_DROP_RATIO)
  if (guardTriggered) {
    await recordCollectionSyncState(
      db, entry.key, 'empty_guard', `count ${rows.length} vs prev ${prevCount}`,
    )
    log.warn({ collection: entry.key, count: rows.length, prevCount }, 'refresh empty_guard')
    return { collection: entry.key, status: 'empty_guard', count: rows.length }
  }

  await replaceCollectionItems(db, entry.key, rows)
  log.info({ collection: entry.key, count: rows.length }, 'refresh ok')
  return { collection: entry.key, status: 'ok', count: rows.length }
}

/** 遍历注册表刷新全部合集（合集间礼貌延时；单合集异常隔离记 failed） */
export async function refreshAllCollections(db: Pool): Promise<CollectionRefreshResult[]> {
  const results: CollectionRefreshResult[] = []
  for (let i = 0; i < DOUBAN_COLLECTIONS.length; i++) {
    const entry = DOUBAN_COLLECTIONS[i]!
    try {
      results.push(await refreshCollection(db, entry))
    } catch (err) {
      await recordCollectionSyncState(db, entry.key, 'failed', String(err)).catch(() => undefined)
      log.warn({ collection: entry.key, err }, 'refresh threw')
      results.push({ collection: entry.key, status: 'failed', count: 0 })
    }
    if (i < DOUBAN_COLLECTIONS.length - 1) await delay(COLLECTION_DELAY_MS)
  }
  return results
}
