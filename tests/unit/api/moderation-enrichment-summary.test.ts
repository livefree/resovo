/**
 * moderation-enrichment-summary.test.ts — META-12-A / ADR-170 AMENDMENT
 *
 * 验证 listPendingQueue mapper 经 buildEnrichmentSummary（admin 同源投影）注入 enrichmentSummary，
 * 且 raw 输入源（meta_quality JSON / bangumiStatus / bangumiSubjectId）不泄漏进 VideoQueueRow 响应。
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import type { VideoQueueRow } from '@resovo/types'
import { listPendingQueue, type PendingQueueFilters } from '@/api/db/queries/moderation'

// ── 原始 SQL 行（DbPendingQueueRow camelCase 别名形态）──────────────

function makeRawRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'v1', slug: null, shortId: 'abc', title: '某番', type: 'anime', year: 2024, country: 'JP',
    episodeCount: 12, totalEpisodes: 12, currentEpisodes: 12, coverUrl: null, rating: null,
    category: null, isPublished: false, visibilityStatus: 'internal', reviewStatus: 'pending_review',
    reviewReason: null, reviewedBy: null, reviewedAt: null, probe: 'ok', render: 'ok',
    probeAggregateTotal: 2, probeAggregateOk: 2, renderAggregateTotal: 2, renderAggregateOk: 1,
    sourceCheckStatus: 'partial', metaScore: 72, needsManualReview: false, badges: [],
    staffNote: null, reviewLabelKey: null, doubanStatus: 'matched', reviewSource: 'manual',
    trendingTag: null, createdAt: '2026-05-30T00:00:00Z', updatedAt: '2026-05-30T00:00:00Z',
    // META-12-A enrichmentSummary 输入源
    bangumiStatus: 'candidate',
    metaQuality: { enriched_at: '2026-05-30T01:00:00Z', title_en_is_pinyin: true, douban_confidence: 0.8 },
    bangumiSubjectId: 8,
    ...over,
  }
}

/** mock Pool：Promise.all 顺序 = [pending rows, count, today stats] */
function mockDb(rows: Record<string, unknown>[]): Pool {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({ rows: [{ count: String(rows.length) }] })
    .mockResolvedValueOnce({ rows: [{ reviewed: '0', approved: '0' }] })
  return { query } as unknown as Pool
}

const FILTERS: PendingQueueFilters = { limit: 30 }

describe('listPendingQueue — enrichmentSummary 注入（META-12-A）', () => {
  it('mapper 经 buildEnrichmentSummary 注入完整 enrichmentSummary', async () => {
    const result = await listPendingQueue(mockDb([makeRawRow()]), FILTERS, 'actor-1')
    const row = result.data[0] as unknown as VideoQueueRow
    expect(row.enrichmentSummary).toEqual({
      doubanStatus: 'matched',
      bangumiStatus: 'candidate',
      sourceCheckStatus: 'partial',
      metaScore: 72,
      enrichedAt: '2026-05-30T01:00:00Z',
      titleEnIsPinyin: true,
      doubanConfidence: 0.8,
      bangumiSubjectId: 8,
    })
  })

  it('raw 输入源（metaQuality / bangumiStatus / bangumiSubjectId）不泄漏进响应行', async () => {
    const result = await listPendingQueue(mockDb([makeRawRow()]), FILTERS, 'actor-1')
    const row = result.data[0] as Record<string, unknown>
    expect(row.metaQuality).toBeUndefined()
    expect(row.bangumiStatus).toBeUndefined()
    expect(row.bangumiSubjectId).toBeUndefined()
    // 既有平铺字段保留（doubanStatus / sourceCheckStatus / metaScore 仍在）
    expect(row.doubanStatus).toBe('matched')
    expect(row.metaScore).toBe(72)
  })

  it('meta_quality=null / bangumi_subject_id=null → 缺省派生（pending/false/null）', async () => {
    const result = await listPendingQueue(
      mockDb([makeRawRow({ metaQuality: null, bangumiSubjectId: null, bangumiStatus: 'pending' })]),
      FILTERS,
      'actor-1',
    )
    const row = result.data[0] as unknown as VideoQueueRow
    expect(row.enrichmentSummary).toMatchObject({
      bangumiStatus: 'pending',
      enrichedAt: null,
      titleEnIsPinyin: false,
      doubanConfidence: null,
      bangumiSubjectId: null,
    })
  })
})
