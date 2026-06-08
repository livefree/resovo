/**
 * BangumiResourceAdapter.ts — Bangumi 资源治理 adapter（ADR-189 D-189-4）
 *
 * overview（dataScale + fetch/enrich 聚合 provider=bangumi + 合集 freshness + dump 重导 freshness 行）
 * / collections（bangumi_collection_items map 中性 DTO）/ search（bangumi_entries dump + searchSubjects live）
 * / activity（fetch_log provider=bangumi）。
 */

import type { Pool } from 'pg'
import {
  aggregateFetchLog,
  queryFetchLog,
  type FetchLogFilter,
  type FetchLogPage,
} from '@/api/db/queries/external-fetch-log'
import {
  getBangumiDataScale,
  aggregateExternalRefMatch,
} from '@/api/db/queries/external-resources-stats'
import {
  listAllBangumiCollectionSyncState,
  listBangumiCollectionItemsPaged,
  listBangumiCollectionsSummary,
} from '@/api/db/queries/bangumi-collections'
import type { CollectionSyncState } from '@/api/db/queries/douban-collections'
import { searchBangumiEntries } from '@/api/db/queries/externalData'
import { searchSubjects } from '@/api/lib/bangumi'
import { loadBangumiClientConfig } from '../bangumi-config'
import type {
  ProviderResourceAdapter,
  ProviderDataMetric,
  OverviewData,
  CollectionsResult,
  SearchResult,
  GovSearchHit,
} from './types'

/** live 在线搜索全局并发 1 限流（独立于豆瓣——不同外部服务，ADR-189 沿用 D-188-5 ③ 范式）。 */
let liveSearchInFlight = false

function parseYear(date: string | null | undefined): number | null {
  if (!date) return null
  const m = date.match(/(\d{4})/)
  return m ? Number.parseInt(m[1], 10) : null
}

export class BangumiResourceAdapter implements ProviderResourceAdapter {
  constructor(private readonly db: Pool) {}

  async getDataScale(): Promise<ProviderDataMetric[]> {
    const s = await getBangumiDataScale(this.db)
    return [
      { key: 'collectionItems', label: '派生合集条目', value: s.collectionItems },
      { key: 'dumpEntries', label: '离线 dump 条目', value: s.dumpEntries },
    ]
  }

  async getOverview(since: string): Promise<OverviewData> {
    const [fetchStats, enrichStats, syncStates, scale] = await Promise.all([
      aggregateFetchLog(this.db, 'bangumi', since),
      aggregateExternalRefMatch(this.db, 'bangumi'),
      listAllBangumiCollectionSyncState(this.db),
      getBangumiDataScale(this.db),
    ])
    // 合集 freshness（9 派生合集）+ 离线 dump 重导 freshness 行（D-189-6：dump 不入 fetch_log，
    // 经 bangumi_entries MAX(updated_at)/COUNT 经此 freshness 渠道可观测，复用既有 freshness UI）。
    const collectionFreshness: CollectionSyncState[] = [...syncStates]
    if (scale.dumpRefreshedAt) {
      collectionFreshness.push({
        collection: '离线 dump 重导（bangumi_entries）',
        lastAttemptAt: scale.dumpRefreshedAt,
        lastSuccessAt: scale.dumpRefreshedAt,
        lastStatus: 'ok',
        lastError: null,
        itemCount: scale.dumpEntries,
      })
    }
    const dataScale: ProviderDataMetric[] = [
      { key: 'collectionItems', label: '派生合集条目', value: scale.collectionItems },
      { key: 'dumpEntries', label: '离线 dump 条目', value: scale.dumpEntries },
    ]
    return { fetchStats, enrichStats, collectionFreshness, dataScale }
  }

  async getActivity(filter: Omit<FetchLogFilter, 'provider'>): Promise<FetchLogPage> {
    return queryFetchLog(this.db, { ...filter, provider: 'bangumi' })
  }

  async getCollections(opts: { collection?: string; limit: number; offset: number }): Promise<CollectionsResult> {
    const [page, summary] = await Promise.all([
      listBangumiCollectionItemsPaged(this.db, opts),
      listBangumiCollectionsSummary(this.db),
    ])
    return {
      items: page.rows.map((r) => ({
        collection: r.collection,
        category: r.category,
        domain: null, // bangumi 无 domain 维度
        externalId: r.bangumiId,
        rank: r.rank,
        title: r.title,
        subtitle: r.nameCn,
        year: r.year,
        rating: r.rating,
        coverUrl: r.coverUrl,
        airWeekday: r.airWeekday,
      })),
      total: page.total,
      summary: summary.map((s) => ({ collection: s.collection, category: s.category, domain: null, count: s.count })),
    }
  }

  /**
   * 统一搜索：bangumi_entries dump（offline）+ 可选 live（searchSubjects，source=admin_search）。
   * live 受全局并发 1 限流——已有在线搜索进行中则跳过在线（liveError='busy'），仅返回 dump。
   * 凭证经 loadBangumiClientConfig（ADR-168 system_settings，回退 env）。
   */
  async unifiedSearch(opts: { q: string; live: boolean; limit: number; offset: number }): Promise<SearchResult> {
    const dump = await searchBangumiEntries(this.db, opts.q, opts.limit, opts.offset)
    const rows: GovSearchHit[] = dump.rows.map((r) => ({
      source: 'offline',
      externalId: r.bangumiId,
      title: r.title,
      year: r.year,
      rating: r.rating,
    }))

    if (!opts.live) return { rows, total: dump.total }

    if (liveSearchInFlight) {
      return { rows, total: dump.total, liveError: 'busy' }
    }
    liveSearchInFlight = true
    try {
      const cfg = await loadBangumiClientConfig(this.db)
      const items = await searchSubjects(opts.q, 10, cfg, 'admin_search')
      const seen = new Set(rows.map((r) => r.externalId))
      for (const it of items) {
        const id = String(it.id)
        if (seen.has(id)) continue
        seen.add(id)
        rows.push({
          source: 'online',
          externalId: id,
          title: it.name_cn?.trim() || it.name,
          year: parseYear(it.date),
          rating: it.rating?.score ?? null,
        })
      }
    } finally {
      liveSearchInFlight = false
    }
    return { rows, total: dump.total }
  }
}
