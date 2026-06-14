/**
 * _fixtures.ts — MetadataStatusSummary 测试夹具（META-33-A）
 *
 * 构造统一元数据状态 DTO，供 tooltip 构造器 / 图标 / 簇 单测复用。默认全 missing，按需 override。
 */
import type {
  MetadataProvider,
  MetadataProviderStatus,
  MetadataStatusSummary,
} from '@resovo/types'

export function makeProviderStatus(
  provider: MetadataProvider,
  overrides: Partial<MetadataProviderStatus> = {},
): MetadataProviderStatus {
  return {
    provider,
    state: 'missing',
    issueLevel: 'none',
    externalId: null,
    label: null,
    confidence: null,
    matchMethod: null,
    appliedAt: null,
    fetchedAt: null,
    reasonCodes: [],
    tooltipLines: [],
    ...overrides,
  }
}

export function makeSummary(
  providerOverrides: Partial<Record<MetadataProvider, Partial<MetadataProviderStatus>>> = {},
  summaryOverrides: Partial<MetadataStatusSummary> = {},
): MetadataStatusSummary {
  const providers: Record<MetadataProvider, MetadataProviderStatus> = {
    douban: makeProviderStatus('douban', providerOverrides.douban),
    bangumi: makeProviderStatus('bangumi', providerOverrides.bangumi),
    tmdb: makeProviderStatus('tmdb', providerOverrides.tmdb),
    imdb: makeProviderStatus('imdb', providerOverrides.imdb),
  }
  return {
    overall: 'missing',
    issueLevel: 'none',
    score: null,
    enrichedAt: null,
    primaryProvider: null,
    providers,
    issues: [],
    nextAction: 'none',
    sort: { statusRank: 3, issueRank: 0, scoreRank: null, updatedAt: null },
    ...summaryOverrides,
  }
}
