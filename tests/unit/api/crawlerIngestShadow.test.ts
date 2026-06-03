/**
 * tests/unit/api/crawlerIngestShadow.test.ts — CHG-VIR-10（Phase 3 / ADR-105a D-105a-16）
 *
 * 验证 CrawlerService.upsertVideo 的 ingest shadow 旁路接线（仿 crawlerTitleObservation 范式）：
 *  - 入库后以正确入参调用 runIngestShadowScoring（videoId / catalogId / matchedStep / title）。
 *  - 容错：shadow 失败 fire-and-forget，不阻断采集入库主流程（R9 性能边界：写失败不影响主路径）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks 必须在 import CrawlerService 之前 ───────────────────────

vi.mock('@/api/lib/queue', () => ({
  imageHealthQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
  enrichmentQueue: { add: vi.fn().mockResolvedValue({ id: 'enrich-1' }) },
}))

const mockFindOrCreateWithMatch = vi.fn()
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({
    findOrCreateWithMatch: mockFindOrCreateWithMatch,
    safeUpdate: vi.fn().mockResolvedValue({ updated: {}, skippedFields: [] }),
  })),
}))

vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: vi.fn().mockImplementation(() => ({
    syncVideo: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/api/db/queries/videos', () => ({
  insertCrawledVideo: vi.fn().mockResolvedValue({ id: 'vid-new' }),
  bumpEpisodeCountIfHigher: vi.fn().mockResolvedValue(undefined),
  upsertVideoAliases: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/sources', () => ({
  upsertSources: vi.fn().mockResolvedValue(0),
  replaceSourcesForSite: vi.fn().mockResolvedValue({ sourcesAdded: 0, sourcesKept: 0, sourcesRemoved: 0 }),
}))

vi.mock('@/api/lib/config', () => ({ config: { AUTO_PUBLISH_CRAWLED: 'false' } }))

vi.mock('@/api/db/queries/titleObservations', () => ({
  recordTitleObservation: vi.fn().mockResolvedValue(undefined),
}))

const mockRunShadow = vi.fn()
vi.mock('@/api/services/identity/ingestShadow', () => ({
  runIngestShadowScoring: (...args: unknown[]) => mockRunShadow(...args),
}))

import { CrawlerService } from '@/api/services/CrawlerService'

const mockDb = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as import('pg').Pool
const mockEs = {} as unknown as import('@elastic/elasticsearch').Client

function makeParsed(title: string) {
  return {
    video: {
      title, titleEn: null, type: 'anime' as const, coverUrl: null,
      year: 2026, country: 'CN', description: null, category: 'anime',
      genre: null, contentRating: 'general' as const, director: [], cast: [],
      writers: [], status: 'completed' as const, sourceVodId: 'vod-1',
      sourceContentType: null, normalizedType: null,
    },
    sources: [],
  }
}

type UpsertFn = (
  parsed: ReturnType<typeof makeParsed>,
  ingestPolicy?: unknown,
  siteKey?: string,
) => Promise<{ videoId: string }>

function bindUpsert(svc: CrawlerService): UpsertFn {
  return (svc as unknown as { upsertVideo: UpsertFn }).upsertVideo.bind(svc)
}

/** fire-and-forget promise 落定窗口（microtask flush）。 */
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('CrawlerService — CHG-VIR-10 ingest shadow 旁路接线', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOrCreateWithMatch.mockResolvedValue({ catalog: { id: 'cat-1' }, matchedStep: 'created' })
    mockRunShadow.mockResolvedValue({
      outcome: 'no-counterpart', counterparts: 0, candidatesUpserted: 0, shadowCatalogId: null, durationMs: 0,
    })
  })

  it('入库后以 videoId/catalogId/matchedStep/title 调用 runIngestShadowScoring', async () => {
    const svc = new CrawlerService(mockDb, mockEs)
    await bindUpsert(svc)(makeParsed('某科幻动画'), undefined, 'site-a')
    await flush()

    expect(mockRunShadow).toHaveBeenCalledTimes(1)
    const [db, log, input] = mockRunShadow.mock.calls[0] as [unknown, unknown, Record<string, unknown>]
    expect(db).toBe(mockDb)
    expect(log).toBeDefined()
    expect(input).toEqual({
      videoId: 'vid-new',
      catalogId: 'cat-1',
      matchedStep: 'created',
      title: '某科幻动画',
    })
  })

  it('matchedStep 透传 findOrCreateWithMatch 命中步骤（exact ID 命中场景）', async () => {
    mockFindOrCreateWithMatch.mockResolvedValue({ catalog: { id: 'cat-9' }, matchedStep: 'bangumi_id' })
    const svc = new CrawlerService(mockDb, mockEs)
    await bindUpsert(svc)(makeParsed('某番'), undefined, 'site-a')
    await flush()
    const [, , input] = mockRunShadow.mock.calls[0] as [unknown, unknown, Record<string, unknown>]
    expect(input.matchedStep).toBe('bangumi_id')
    expect(input.catalogId).toBe('cat-9')
  })

  it('容错：shadow 失败 fire-and-forget，不阻断主流程（采集主路径零回归）', async () => {
    mockRunShadow.mockRejectedValueOnce(new Error('shadow down'))
    const svc = new CrawlerService(mockDb, mockEs)
    const result = await bindUpsert(svc)(makeParsed('某剧'), undefined, 'site-a')
    await flush()
    expect(result).toHaveProperty('videoId', 'vid-new')
  })
})
