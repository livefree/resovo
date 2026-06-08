/**
 * types.ts — 外部资源治理 provider 无关 DTO + adapter 契约（ADR-189 D-189-4 / arch H1）
 *
 * 去 douban-ism 泄漏（dataScale 硬绑 DoubanDataScale / item doubanId）→ provider 无关中性 DTO，
 * 跨 api-service / route / server-next UI 三消费方统一。每 provider adapter 把自身 query 行 map 到这些中性形状。
 */

import type { FetchAggregate, FetchLogFilter, FetchLogPage } from '@/api/db/queries/external-fetch-log'
import type { ExternalRefMatchStats } from '@/api/db/queries/external-resources-stats'
import type { CollectionSyncState } from '@/api/db/queries/douban-collections'

/** provider 无关数据规模指标（UI 按数组渲染 KPI，接新 provider 仅产自身指标项）。 */
export interface ProviderDataMetric {
  readonly key: string
  readonly label: string
  readonly value: number
}

/** provider 无关治理合集条目（externalId 取代 doubanId；subtitle = douban originalTitle / bangumi nameCn）。 */
export interface GovCollectionItem {
  readonly collection: string
  readonly category: string
  /** douban movie/tv/show；bangumi 无 domain → null */
  readonly domain: string | null
  readonly externalId: string
  readonly rank: number
  readonly title: string
  readonly subtitle: string | null
  readonly year: number | null
  readonly rating: number | null
  readonly coverUrl: string | null
  /** bangumi calendar 专属（1-7）；douban null */
  readonly airWeekday: number | null
}

export interface GovCollectionSummaryItem {
  readonly collection: string
  readonly category: string
  readonly domain: string | null
  readonly count: number
}

/** 统一搜索结果项：offline=dump / online=adapter resolver 实时。 */
export interface GovSearchHit {
  readonly source: 'offline' | 'online'
  readonly externalId: string
  readonly title: string
  readonly year: number | null
  readonly rating: number | null
}

export interface OverviewData {
  readonly fetchStats: FetchAggregate
  readonly enrichStats: ExternalRefMatchStats
  readonly collectionFreshness: CollectionSyncState[]
  readonly dataScale: ProviderDataMetric[]
}

export interface CollectionsResult {
  readonly items: GovCollectionItem[]
  readonly total: number
  readonly summary: GovCollectionSummaryItem[]
}

export interface SearchResult {
  readonly rows: GovSearchHit[]
  readonly total: number
  /** live 限流（'busy'：已有在线搜索进行中，本次跳过在线，仅返回 dump） */
  readonly liveError?: string
}

/**
 * provider 资源治理 adapter（ADR-189 D-189-4）：去 isActiveDouban 硬编码，按 provider 选实现。
 * 接 imdb/tmdb = 加一个 adapter 类，Service 分派零改。
 */
export interface ProviderResourceAdapter {
  getDataScale(): Promise<ProviderDataMetric[]>
  getOverview(since: string): Promise<OverviewData>
  getActivity(filter: Omit<FetchLogFilter, 'provider'>): Promise<FetchLogPage>
  getCollections(opts: { collection?: string; limit: number; offset: number }): Promise<CollectionsResult>
  unifiedSearch(opts: { q: string; live: boolean; limit: number; offset: number }): Promise<SearchResult>
}
