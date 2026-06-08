/**
 * ExternalResourcesService.ts — 外部资源治理聚合服务（ADR-188 D-188-5 / ADR-189 D-189-4）
 *
 * Route → Service → Adapter → DB queries。**provider-dispatch**（ADR-189 D-189-4 / arch H1）：
 * 去 isActiveDouban 硬编码，按 provider 选 ProviderResourceAdapter（active 才有 adapter）；
 * planned（无 adapter）返回 PLANNED_MARKER。接新 provider = 注册一个 adapter，分派零改。
 */

import type { Pool } from 'pg'
import {
  EXTERNAL_PROVIDERS,
  getExternalProvider,
  type ProviderKey,
  type ExternalProvider,
} from '@resovo/types'
import type { FetchLogFilter, FetchLogPage } from '@/api/db/queries/external-fetch-log'
import { DoubanResourceAdapter } from './external-resources/DoubanResourceAdapter'
import type {
  ProviderResourceAdapter,
  ProviderDataMetric,
  OverviewData,
  CollectionsResult,
  SearchResult,
} from './external-resources/types'

export type {
  ProviderDataMetric,
  OverviewData,
  CollectionsResult,
  SearchResult,
  GovCollectionItem,
  GovCollectionSummaryItem,
  GovSearchHit,
} from './external-resources/types'

export interface ExternalProviderSummary extends ExternalProvider {
  /** active provider 数据规模（planned 为 null）；provider 无关指标数组（ADR-189 D-189-4） */
  readonly dataScale: ProviderDataMetric[] | null
}

/** planned provider 占位返回（route 据此返回 200 + status:'planned'） */
export const PLANNED_MARKER = { status: 'planned' as const }
export type PlannedMarker = typeof PLANNED_MARKER

export class ExternalResourcesService {
  private readonly adapters: Partial<Record<ProviderKey, ProviderResourceAdapter>>

  constructor(db: Pool) {
    // active provider 注册 adapter；planned 无 adapter → 分派落 PLANNED_MARKER
    // （bangumi adapter 在 CHG-BNG-RES-API-3B 注册 + 同步 registry status='active'）
    this.adapters = {
      douban: new DoubanResourceAdapter(db),
    }
  }

  /** active provider 的 adapter（status=active 且已注册）；否则 null（planned）。 */
  private adapterFor(provider: ProviderKey): ProviderResourceAdapter | null {
    return getExternalProvider(provider)?.status === 'active' ? this.adapters[provider] ?? null : null
  }

  /** provider registry + 各自数据规模摘要（active 含 dataScale 指标数组）。 */
  async getProviders(): Promise<ExternalProviderSummary[]> {
    const out: ExternalProviderSummary[] = []
    for (const p of EXTERNAL_PROVIDERS) {
      const adapter = p.status === 'active' ? this.adapters[p.key] : undefined
      const dataScale = adapter ? await adapter.getDataScale() : null
      out.push({ ...p, dataScale })
    }
    return out
  }

  /** 概览（planned → marker）。 */
  async getOverview(provider: ProviderKey, since: string): Promise<OverviewData | PlannedMarker> {
    const adapter = this.adapterFor(provider)
    return adapter ? adapter.getOverview(since) : PLANNED_MARKER
  }

  /** 采集操作流水（planned → marker）。 */
  async getActivity(
    provider: ProviderKey,
    filter: Omit<FetchLogFilter, 'provider'>,
  ): Promise<FetchLogPage | PlannedMarker> {
    const adapter = this.adapterFor(provider)
    return adapter ? adapter.getActivity(filter) : PLANNED_MARKER
  }

  /** 热门合集分类条目 + 分类摘要（planned → marker）。 */
  async getCollections(
    provider: ProviderKey,
    opts: { collection?: string; limit: number; offset: number },
  ): Promise<CollectionsResult | PlannedMarker> {
    const adapter = this.adapterFor(provider)
    return adapter ? adapter.getCollections(opts) : PLANNED_MARKER
  }

  /** 统一搜索：dump + 可选 live（planned → marker）。 */
  async unifiedSearch(
    provider: ProviderKey,
    opts: { q: string; live: boolean; limit: number; offset: number },
  ): Promise<SearchResult | PlannedMarker> {
    const adapter = this.adapterFor(provider)
    return adapter ? adapter.unifiedSearch(opts) : PLANNED_MARKER
  }
}
