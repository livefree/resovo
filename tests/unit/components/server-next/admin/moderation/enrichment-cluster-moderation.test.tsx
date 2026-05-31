/**
 * enrichment-cluster-moderation.test.tsx — META-12-B / feature-2 Face 3 前端接入单测
 *
 * 覆盖审核台 2 接入点：
 *   ModListRow（行内簇 density='row'）
 *   RightPane/TabDetail（详情簇 density='header'）
 *
 * 数据源：VideoQueueRow.enrichmentSummary（META-12-A 后端注入）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import type { EnrichmentSummary } from '@resovo/types'

// useToast stub（TabDetail 依赖）；保留真实 EnrichmentBadgeCluster
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: vi.fn(() => 'tid'), dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})
vi.mock('@/lib/videos/api', () => ({ listVideoSources: vi.fn(), getVideo: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/sources/api', () => ({ reprobeRoute: vi.fn() }))

import { ModListRow } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/ModListRow'
import { TabDetail } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail'

afterEach(() => cleanup())

function makeSummary(over: Partial<EnrichmentSummary> = {}): EnrichmentSummary {
  return {
    doubanStatus: 'matched', bangumiStatus: 'matched', sourceCheckStatus: 'ok',
    metaScore: 88, enrichedAt: '2026-05-30T12:00:00Z', titleEnIsPinyin: false,
    doubanConfidence: 0.9, bangumiSubjectId: 8,
    doubanId: '1292052', tmdbId: 27205, imdbId: 'tt1375666', ...over,
  }
}

type QueueRow = Parameters<typeof TabDetail>[0]['v']

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

// ── TabDetail（详情簇 density='header'）───────────────────────────

describe('META-12-B TabDetail — 详情富集簇', () => {
  it('有 enrichmentSummary → 渲染 density=header 簇 + 富集时间', () => {
    const { container } = render(<TabDetail v={makeRow({ type: 'anime' })} />)
    const wrap = container.querySelector('[data-right-detail-enrichment]')
    expect(wrap).toBeTruthy()
    const cluster = wrap!.querySelector('[data-enrichment-badge-cluster][data-density="header"]')
    expect(cluster).toBeTruthy()
    expect(cluster!.querySelector('[data-source="bangumi"]')).toBeTruthy()
    expect(container.querySelector('[data-enrichment-cluster-time]')?.textContent).toContain('2026-05-30')
  })

  it('无 enrichmentSummary → 无富集 section', () => {
    const { container } = render(<TabDetail v={makeRow({ enrichmentSummary: undefined })} />)
    expect(container.querySelector('[data-right-detail-enrichment]')).toBeNull()
    // 既有 meta_score / douban_status DetailRow 仍在
    expect(container.textContent).toContain('meta_score')
  })
})
