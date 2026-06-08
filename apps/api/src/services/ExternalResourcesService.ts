/**
 * ExternalResourcesService.ts — 外部资源治理聚合服务（ADR-188 D-188-5）
 *
 * Route → Service → DB queries。聚合多个 queries 模块（fetch_log / external_refs /
 * collection sync_state / data scale）产出概览与活动流水。本卡（API-A）含
 * providers / overview / activity；搜索与合集（API-B）另卡。
 * active provider 仅 douban；planned（bangumi/imdb/tmdb）返回 { status:'planned' } 占位。
 */

import type { Pool } from 'pg'
import {
  EXTERNAL_PROVIDERS,
  getExternalProvider,
  type ProviderKey,
  type ExternalProvider,
} from '@resovo/types'
import {
  aggregateFetchLog,
  queryFetchLog,
  type FetchAggregate,
  type FetchLogFilter,
  type FetchLogPage,
} from '@/api/db/queries/external-fetch-log'
import {
  getDoubanDataScale,
  aggregateExternalRefMatch,
  type DoubanDataScale,
  type ExternalRefMatchStats,
} from '@/api/db/queries/external-resources-stats'
import {
  listAllCollectionSyncState,
  listCollectionItemsPaged,
  listCollectionsSummary,
  type CollectionSyncState,
  type CollectionBrowseRow,
  type CollectionSummaryRow,
} from '@/api/db/queries/douban-collections'
import { searchDoubanEntries } from '@/api/db/queries/externalData'
import { searchDoubanRich } from '@/api/lib/doubanAdapter'

export interface ExternalProviderSummary extends ExternalProvider {
  /** active provider 数据规模（planned 为 null） */
  readonly dataScale: DoubanDataScale | null
}

export interface OverviewData {
  readonly fetchStats: FetchAggregate
  readonly enrichStats: ExternalRefMatchStats
  readonly collectionFreshness: CollectionSyncState[]
  readonly dataScale: DoubanDataScale
}

export interface CollectionsResult {
  readonly items: CollectionBrowseRow[]
  readonly total: number
  readonly summary: CollectionSummaryRow[]
}

/** 统一搜索结果项：offline=dump / online=adapter resolver 实时（ADR-188 D-188-5） */
export interface ResourceSearchHit {
  readonly source: 'offline' | 'online'
  readonly doubanId: string
  readonly title: string
  readonly year: number | null
  readonly rating: number | null
}

export interface SearchResult {
  readonly rows: ResourceSearchHit[]
  readonly total: number
  /** live 限流（'busy'：已有在线搜索进行中，本次跳过在线，仅返回 dump） */
  readonly liveError?: string
}

/** planned provider 占位返回（route 据此返回 200 + status:'planned'） */
export const PLANNED_MARKER = { status: 'planned' as const }
export type PlannedMarker = typeof PLANNED_MARKER

/** live 在线搜索全局并发 1 限流（ADR-188 D-188-5 ③：防管理员连点打爆豆瓣污染 worker 采集）。 */
let liveSearchInFlight = false

export class ExternalResourcesService {
  constructor(private readonly db: Pool) {}

  /** provider registry + 各自数据规模摘要（active 含 dataScale）。 */
  async getProviders(): Promise<ExternalProviderSummary[]> {
    const out: ExternalProviderSummary[] = []
    for (const p of EXTERNAL_PROVIDERS) {
      const dataScale = p.key === 'douban' ? await getDoubanDataScale(this.db) : null
      out.push({ ...p, dataScale })
    }
    return out
  }

  /** 概览：采集用量+成功率 / 富集匹配分布 / 合集新鲜度 / 数据规模（planned → marker）。 */
  async getOverview(provider: ProviderKey, since: string): Promise<OverviewData | PlannedMarker> {
    if (!this.isActiveDouban(provider)) return PLANNED_MARKER
    const [fetchStats, enrichStats, collectionFreshness, dataScale] = await Promise.all([
      aggregateFetchLog(this.db, provider, since),
      aggregateExternalRefMatch(this.db, provider),
      listAllCollectionSyncState(this.db),
      getDoubanDataScale(this.db),
    ])
    return { fetchStats, enrichStats, collectionFreshness, dataScale }
  }

  /** 采集操作流水（fetch_log 过滤分页；planned → marker）。 */
  async getActivity(
    provider: ProviderKey,
    filter: Omit<FetchLogFilter, 'provider'>,
  ): Promise<FetchLogPage | PlannedMarker> {
    if (!this.isActiveDouban(provider)) return PLANNED_MARKER
    return queryFetchLog(this.db, { ...filter, provider })
  }

  /** 热门合集分类条目（可选 collection 过滤）+ 分类摘要（planned → marker）。 */
  async getCollections(
    provider: ProviderKey,
    opts: { collection?: string; limit: number; offset: number },
  ): Promise<CollectionsResult | PlannedMarker> {
    if (!this.isActiveDouban(provider)) return PLANNED_MARKER
    const [page, summary] = await Promise.all([
      listCollectionItemsPaged(this.db, opts),
      listCollectionsSummary(this.db),
    ])
    return { items: page.rows, total: page.total, summary }
  }

  /**
   * 统一搜索：dump 分页（offline）+ 可选 live（online，adapter resolver，source=admin_search）。
   * live 受全局并发 1 限流——已有在线搜索进行中则跳过在线（liveError='busy'），仅返回 dump。
   * live 抓取失败由 searchDoubanRich 内部降级 []（埋点记 status，活动 Tab 可观测），dump 结果不受影响。
   */
  async unifiedSearch(
    provider: ProviderKey,
    opts: { q: string; live: boolean; limit: number; offset: number },
  ): Promise<SearchResult | PlannedMarker> {
    if (!this.isActiveDouban(provider)) return PLANNED_MARKER

    const dump = await searchDoubanEntries(this.db, opts.q, opts.limit, opts.offset)
    const rows: ResourceSearchHit[] = dump.rows.map((r) => ({
      source: 'offline',
      doubanId: r.doubanId,
      title: r.title,
      year: r.year,
      rating: r.rating,
    }))

    if (!opts.live) return { rows, total: dump.total }

    if (liveSearchInFlight) {
      // 并发 1 限流：跳过在线，仅返回 dump + busy 标记
      return { rows, total: dump.total, liveError: 'busy' }
    }
    liveSearchInFlight = true
    try {
      const candidates = await searchDoubanRich(opts.q, undefined, 'admin_search')
      const seen = new Set(rows.map((r) => r.doubanId))
      for (const c of candidates) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        rows.push({
          source: 'online',
          doubanId: c.id,
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

  /** 当前仅 douban 为 active 实装；其余（planned）走占位。 */
  private isActiveDouban(provider: ProviderKey): boolean {
    return getExternalProvider(provider)?.status === 'active' && provider === 'douban'
  }
}
