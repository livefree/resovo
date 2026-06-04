/**
 * split-suggestions-service.test.ts — SplitSuggestionsService 编排测试
 * （ADR-105 AMENDMENT 2026-06-03 D-105-1 / CHG-VIR-11-B）
 *
 * 覆盖：404 / 409 校验（与 split 端点同语义）+ 数据源编排（getVideoMatrix 线路真源 R-105-S9
 * + site 观测 + 外部 ID 冲突）→ 纯函数结果透传。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SplitSuggestionsService } from '@/api/services/SplitSuggestionsService'

vi.mock('@/api/db/queries/video-matrix', () => ({ getVideoMatrix: vi.fn() }))
vi.mock('@/api/db/queries/titleObservations', () => ({
  recordTitleObservation: vi.fn(),
  listObservationsByVideoId: vi.fn(),
}))
vi.mock('@/api/db/queries/split-suggestions', () => ({
  listExternalIdConflictProviders: vi.fn(),
}))
vi.mock('@/api/db/queries/video-merge-mutations', () => ({ fetchVideosByIds: vi.fn() }))

import { getVideoMatrix } from '@/api/db/queries/video-matrix'
import { listObservationsByVideoId } from '@/api/db/queries/titleObservations'
import { listExternalIdConflictProviders } from '@/api/db/queries/split-suggestions'
import { fetchVideosByIds } from '@/api/db/queries/video-merge-mutations'

const VIDEO_ID = '00000000-0000-0000-0000-000000000001'
const db = {} as import('pg').Pool

function makeVideoRow(deletedAt: string | null = null) {
  return { id: VIDEO_ID, type: 'anime', deleted_at: deletedAt } as Awaited<
    ReturnType<typeof fetchVideosByIds>
  >[number]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SplitSuggestionsService.getSuggestions', () => {
  it('NOT_FOUND：video 不存在', async () => {
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce([])
    const svc = new SplitSuggestionsService(db)
    await expect(svc.getSuggestions(VIDEO_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND', httpStatus: 404,
    })
  })

  it('STATE_CONFLICT：video 已软删（与 split 端点同语义）', async () => {
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce([makeVideoRow('2026-05-01T00:00:00Z')])
    const svc = new SplitSuggestionsService(db)
    await expect(svc.getSuggestions(VIDEO_ID)).rejects.toMatchObject({
      code: 'STATE_CONFLICT', httpStatus: 409,
    })
  })

  it('编排：三数据源并行取数 → 纯函数结果（videoType 继承 + 线路真源 = getVideoMatrix）', async () => {
    vi.mocked(fetchVideosByIds).mockResolvedValueOnce([makeVideoRow()])
    vi.mocked(getVideoMatrix).mockResolvedValueOnce([
      {
        sourceSiteKey: 'site-a',
        sourceName: '线路1',
        displayName: null,
        episodes: [{ episodeNumber: 1, sourceId: 's1', sourceUrl: 'u', probeStatus: 'unknown', renderStatus: 'unknown', isActive: true }],
      },
      {
        sourceSiteKey: 'site-b',
        sourceName: '线路1',
        displayName: null,
        episodes: [{ episodeNumber: 1, sourceId: 's2', sourceUrl: 'u', probeStatus: 'unknown', renderStatus: 'unknown', isActive: true }],
      },
    ] as Awaited<ReturnType<typeof getVideoMatrix>>)
    vi.mocked(listObservationsByVideoId).mockResolvedValueOnce([
      {
        siteKey: 'site-a', rawTitle: '作品A', rawTitleHash: 'h1', observedCount: 3,
        lastSeenAt: '2026-06-01T00:00:00Z',
        parsedFacets: { coreTitleKey: 'a', titleKind: 'original', confidence: 1, facets: { seasonNumber: null, edition: null, languageVariant: null, releaseMarker: null, qualityNoise: [], sourceNoise: [], bracketTokens: [] } },
      },
      {
        siteKey: 'site-b', rawTitle: '作品B', rawTitleHash: 'h2', observedCount: 2,
        lastSeenAt: '2026-06-01T00:00:00Z',
        parsedFacets: { coreTitleKey: 'b', titleKind: 'original', confidence: 1, facets: { seasonNumber: null, edition: null, languageVariant: null, releaseMarker: null, qualityNoise: [], sourceNoise: [], bracketTokens: [] } },
      },
    ])
    vi.mocked(listExternalIdConflictProviders).mockResolvedValueOnce(['douban'])

    const svc = new SplitSuggestionsService(db)
    const result = await svc.getSuggestions(VIDEO_ID)

    expect(result.videoId).toBe(VIDEO_ID)
    expect(result.suggestible).toBe(true)
    expect(result.dimension).toBe('core_title_key')
    expect(result.groups).toHaveLength(2)
    // videoType 继承原 video（D-105-1）
    expect(result.groups[0]!.suggestedMeta.type).toBe('anime')
    // 线路键来自 getVideoMatrix（R-105-S9）
    expect(result.groups.flatMap((g) => g.lines.map((l) => l.sourceSiteKey)).sort()).toEqual(['site-a', 'site-b'])
    // 外部 ID 冲突信号透传
    expect(result.signals).toContainEqual({ kind: 'external_id_conflict', providers: ['douban'] })
    // 三数据源各取一次
    expect(getVideoMatrix).toHaveBeenCalledWith(db, VIDEO_ID)
    expect(listObservationsByVideoId).toHaveBeenCalledWith(db, VIDEO_ID)
    expect(listExternalIdConflictProviders).toHaveBeenCalledWith(db, VIDEO_ID)
  })
})
