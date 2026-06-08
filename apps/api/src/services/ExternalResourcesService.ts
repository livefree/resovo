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
  type CollectionSyncState,
} from '@/api/db/queries/douban-collections'

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

/** planned provider 占位返回（route 据此返回 200 + status:'planned'） */
export const PLANNED_MARKER = { status: 'planned' as const }
export type PlannedMarker = typeof PLANNED_MARKER

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

  /** 当前仅 douban 为 active 实装；其余（planned）走占位。 */
  private isActiveDouban(provider: ProviderKey): boolean {
    return getExternalProvider(provider)?.status === 'active' && provider === 'douban'
  }
}
