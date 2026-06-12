/**
 * tests/unit/api/crawlerTitleObservation.test.ts — SEQ-20260602-03 / CHG-VIR-6（Phase 1b）
 *
 * 验证 CrawlerService.upsertVideo 的 title_observations shadow 写入：
 *  - 入库后以正确入参调用 recordTitleObservation（videoId / rawTitle / siteKey）。
 *  - **F3 容错**：observation 写失败 fire-and-forget，不阻断采集入库主流程（upsertVideo 正常返回）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks 必须在 import CrawlerService 之前 ───────────────────────

vi.mock('@/api/lib/queue', () => ({
  imageHealthQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
  enrichmentQueue: { add: vi.fn().mockResolvedValue({ id: 'enrich-1' }) },
}))

const mockFindOrCreate = vi.fn()
const mockFindOrCreateWithMatch = vi.fn()
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({
    findOrCreate: mockFindOrCreate,
    findOrCreateWithMatch: mockFindOrCreateWithMatch,
    safeUpdate: vi.fn().mockResolvedValue({ updated: {}, skippedFields: [] }),
  })),
}))

// CHG-VIR-10：ingest shadow 旁路与本测试正交，mock 掉避免真实召回/日志
vi.mock('@/api/services/identity/ingestShadow', () => ({
  runIngestShadowScoring: vi.fn().mockResolvedValue({
    outcome: 'no-counterpart', counterparts: 0, candidatesUpserted: 0, shadowCatalogId: null, durationMs: 0,
  }),
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

// recordTitleObservation 替换为 spy；入参由 CrawlerService.buildTitleObservation 真实组装（真 parseTitle + sha256）
const mockRecordObs = vi.fn().mockResolvedValue(undefined)
vi.mock('@/api/db/queries/titleObservations', () => ({
  recordTitleObservation: (...args: unknown[]) => mockRecordObs(...args),
}))

import { CrawlerService } from '@/api/services/CrawlerService'
import { TITLE_PARSER_VERSION } from '@/api/services/TitleIdentityParser'

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

describe('CrawlerService — CHG-VIR-6 title_observations shadow 写入', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOrCreate.mockResolvedValue({ id: 'cat-1' })
    mockFindOrCreateWithMatch.mockResolvedValue({ catalog: { id: 'cat-1' }, matchedStep: 'title_triple' })
    mockRecordObs.mockResolvedValue(undefined)
  })

  it('入库后以 videoId/rawTitle/siteKey 构造的入参调用 recordTitleObservation', async () => {
    const svc = new CrawlerService(mockDb, mockEs)
    await bindUpsert(svc)(makeParsed('斗罗大陆 第4季 更新至30集'), undefined, 'site-a')

    expect(mockRecordObs).toHaveBeenCalledTimes(1)
    const [, input] = mockRecordObs.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(input).toMatchObject({
      videoId: 'vid-new',
      sourceSiteKey: 'site-a',
      sourceName: null,
      rawTitle: '斗罗大陆 第4季 更新至30集',
      parserVersion: TITLE_PARSER_VERSION,
    })
    // raw_title_hash = sha256 hex（64 位）
    expect(input.rawTitleHash).toMatch(/^[0-9a-f]{64}$/)
    // 真实 buildTitleObservation → parseTitle 产出 facets 快照
    const facets = input.parsedFacets as Record<string, unknown>
    expect(facets.coreTitleKey).toBe('斗罗大陆')
    expect(facets.titleKind).toBe('crawler')
  })

  it('无 siteKey → sourceSiteKey 传 null', async () => {
    const svc = new CrawlerService(mockDb, mockEs)
    await bindUpsert(svc)(makeParsed('某番'), undefined, undefined)
    const [, input] = mockRecordObs.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(input.sourceSiteKey).toBeNull()
  })

  it('F3 容错：observation 写失败 fire-and-forget，不阻断主流程', async () => {
    mockRecordObs.mockRejectedValueOnce(new Error('db down'))
    const svc = new CrawlerService(mockDb, mockEs)
    // 不应抛错（主流程返回正常结构）
    const result = await bindUpsert(svc)(makeParsed('某剧'), undefined, 'site-a')
    expect(result).toHaveProperty('videoId', 'vid-new')
  })
})
