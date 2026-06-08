/**
 * DoubanResourceAdapter.ts — 豆瓣资源治理 adapter（ADR-189 D-189-4）
 *
 * ADR-188 既有 ExternalResourcesService 的 douban 逻辑整搬至此（map 到中性 DTO），**零行为变更**。
 * Service 退化为 adapter 分派。
 */

import type { Pool } from 'pg'
import {
  aggregateFetchLog,
  queryFetchLog,
  type FetchLogFilter,
  type FetchLogPage,
} from '@/api/db/queries/external-fetch-log'
import {
  getDoubanDataScale,
  aggregateExternalRefMatch,
} from '@/api/db/queries/external-resources-stats'
import {
  listAllCollectionSyncState,
  listCollectionItemsPaged,
  listCollectionsSummary,
} from '@/api/db/queries/douban-collections'
import { searchDoubanEntries } from '@/api/db/queries/externalData'
import { searchDoubanRich } from '@/api/lib/doubanAdapter'
import type {
  ProviderResourceAdapter,
  ProviderDataMetric,
  OverviewData,
  CollectionsResult,
  SearchResult,
  GovSearchHit,
} from './types'

/** live 在线搜索全局并发 1 限流（ADR-188 D-188-5 ③：防管理员连点打爆豆瓣污染 worker 采集）。 */
let liveSearchInFlight = false

export class DoubanResourceAdapter implements ProviderResourceAdapter {
  constructor(private readonly db: Pool) {}

  async getDataScale(): Promise<ProviderDataMetric[]> {
    const s = await getDoubanDataScale(this.db)
    return [
      { key: 'collectionItems', label: '热门合集条目', value: s.collectionItems },
      { key: 'doubanEntries', label: '离线 dump 条目', value: s.doubanEntries },
    ]
  }

  async getOverview(since: string): Promise<OverviewData> {
    const [fetchStats, enrichStats, collectionFreshness, dataScale] = await Promise.all([
      aggregateFetchLog(this.db, 'douban', since),
      aggregateExternalRefMatch(this.db, 'douban'),
      listAllCollectionSyncState(this.db),
      this.getDataScale(),
    ])
    return { fetchStats, enrichStats, collectionFreshness, dataScale }
  }

  async getActivity(filter: Omit<FetchLogFilter, 'provider'>): Promise<FetchLogPage> {
    return queryFetchLog(this.db, { ...filter, provider: 'douban' })
  }

  async getCollections(opts: { collection?: string; limit: number; offset: number }): Promise<CollectionsResult> {
    const [page, summary] = await Promise.all([
      listCollectionItemsPaged(this.db, opts),
      listCollectionsSummary(this.db),
    ])
    return {
      items: page.rows.map((r) => ({
        collection: r.collection,
        category: r.category,
        domain: r.domain,
        externalId: r.doubanId,
        rank: r.rank,
        title: r.title,
        subtitle: r.originalTitle,
        year: r.year,
        rating: r.ratingValue,
        coverUrl: r.coverUrl,
        airWeekday: null,
      })),
      total: page.total,
      summary: summary.map((s) => ({ collection: s.collection, category: s.category, domain: s.domain, count: s.count })),
    }
  }

  /**
   * 统一搜索：dump 分页（offline）+ 可选 live（online，adapter resolver，source=admin_search）。
   * live 受全局并发 1 限流——已有在线搜索进行中则跳过在线（liveError='busy'），仅返回 dump。
   */
  async unifiedSearch(opts: { q: string; live: boolean; limit: number; offset: number }): Promise<SearchResult> {
    const dump = await searchDoubanEntries(this.db, opts.q, opts.limit, opts.offset)
    const rows: GovSearchHit[] = dump.rows.map((r) => ({
      source: 'offline',
      externalId: r.doubanId,
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
      const candidates = await searchDoubanRich(opts.q, undefined, 'admin_search')
      const seen = new Set(rows.map((r) => r.externalId))
      for (const c of candidates) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        rows.push({
          source: 'online',
          externalId: c.id,
          title: c.title,
          year: c.year ? Number.parseInt(c.year, 10) || null : null,
          rating: null,
        })
      }
    } finally {
      liveSearchInFlight = false
    }
    return { rows, total: dump.total }
  }
}
