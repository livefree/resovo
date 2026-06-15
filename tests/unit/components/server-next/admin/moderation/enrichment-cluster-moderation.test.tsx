/**
 * enrichment-cluster-moderation.test.tsx — META-12-B / feature-2 Face 3 前端接入单测
 *
 * 覆盖审核台 ModListRow 行内富集簇（density='row'）。
 *   ⚠ TabDetail 详情富集簇接入点已由 META-34 / ADR-201 退役——TabDetail 改用统一「元数据状态」
 *     section + MetadataStatusPanel（见 TabDetailMetadataStatus.test.tsx）；EnrichmentBadgeCluster
 *     在审核台仅余 ModListRow 一个消费点。
 *
 * 数据源：VideoQueueRow.enrichmentSummary（META-12-A 后端注入）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { EnrichmentSummary } from '@resovo/types'

// 保留真实 EnrichmentBadgeCluster（ModListRow 消费）；ModListRow 不依赖 useToast / api 模块。
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return { ...actual }
})

import { ModListRow } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/ModListRow'

afterEach(() => cleanup())

function makeSummary(over: Partial<EnrichmentSummary> = {}): EnrichmentSummary {
  return {
    doubanStatus: 'matched', bangumiStatus: 'matched', sourceCheckStatus: 'ok',
    metaScore: 88, enrichedAt: '2026-05-30T12:00:00Z', titleEnIsPinyin: false,
    doubanConfidence: 0.9, bangumiSubjectId: 8,
    doubanId: '1292052', tmdbId: 27205, imdbId: 'tt1375666', ...over,
  }
}

type QueueRow = Parameters<typeof ModListRow>[0]['it']

function makeRow(over: Record<string, unknown> = {}): QueueRow {
  return {
    id: 'v1', slug: null, shortId: 'abc', title: '某番', type: 'anime', year: 2024, country: 'JP',
    episodeCount: 12, totalEpisodes: 12, currentEpisodes: 12, coverUrl: null, rating: null,
    category: null, isPublished: false, visibilityStatus: 'internal', reviewStatus: 'pending_review',
    reviewReason: null, reviewedBy: null, reviewedAt: null, probe: 'ok', render: 'ok',
    probeAggregate: { total: 2, ok: 2, state: 'ok' }, renderAggregate: { total: 2, ok: 1, state: 'partial' },
    sourceCheckStatus: 'ok', metaScore: 88, needsManualReview: false, badges: [],
    staffNote: null, reviewLabelKey: null, doubanStatus: 'matched', reviewSource: 'manual',
    trendingTag: null, createdAt: '2026-05-30T00:00:00Z', updatedAt: '2026-05-30T00:00:00Z',
    enrichmentSummary: makeSummary(),
    ...over,
  } as unknown as QueueRow
}

// ── ModListRow（行内簇 density='row'）─────────────────────────────

describe('META-12-B ModListRow — 行内富集簇', () => {
  const noop = () => {}

  it('anime 行 → 渲染簇 density=row + 含 bangumi 徽标', () => {
    const { container } = render(<ModListRow it={makeRow({ type: 'anime' })} active={false} onClick={noop} />)
    const cluster = container.querySelector('[data-enrichment-badge-cluster][data-density="row"]')
    expect(cluster).toBeTruthy()
    expect(cluster!.querySelector('[data-source="bangumi"]')).toBeTruthy()
  })

  it('movie 行 → 簇不含 bangumi（anime-only 门控）', () => {
    const { container } = render(<ModListRow it={makeRow({ type: 'movie' })} active={false} onClick={noop} />)
    expect(container.querySelector('[data-enrichment-badge-cluster]')).toBeTruthy()
    expect(container.querySelector('[data-source="bangumi"]')).toBeNull()
  })

  it('行无 enrichmentSummary → 不渲染簇', () => {
    const { container } = render(<ModListRow it={makeRow({ enrichmentSummary: undefined })} active={false} onClick={noop} />)
    expect(container.querySelector('[data-enrichment-badge-cluster]')).toBeNull()
  })
})
