/**
 * tests/unit/api/crawlerTitleEnPinyinGate.test.ts — CHG-VIR-11-D
 *
 * 验证 catalog 写入边界的拼音门禁（CrawlerService.upsertVideo）：
 * 苹果CMS `vod_en`（英文名）约定填中文标题全拼（slug，如 "tabiqiannanyouzhire"），
 * 拼音冒充英文官方名会污染 catalog.title_en → knownNames（official/en/conf=1.0）→ 误导
 * TMDB 搜索/打分。门禁只在写 catalog 字段处过滤：
 *   - 写 media_catalog.title_en（findOrCreateWithMatch）：拼音 → null，真英文保留
 *   - 写 video_aliases（Step 5 upsertVideoAliases）：保留原始拼音，跨站归并召回不丢
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks 必须在 import CrawlerService 之前 ───────────────────────

vi.mock('@/api/lib/queue', () => ({
  imageHealthQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
  enrichmentQueue: { add: vi.fn().mockResolvedValue({ id: 'enrich-1' }) },
}))

const mockFindOrCreate = vi.fn()
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({
    findOrCreate: mockFindOrCreate,
    findOrCreateWithMatch: vi.fn(async (input: unknown) => ({
      catalog: await mockFindOrCreate(input), matchedStep: 'title_triple',
    })),
    safeUpdate: vi.fn().mockResolvedValue({ updated: {}, skippedFields: [] }),
  })),
}))

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

const mockUpsertVideoAliases = vi.fn().mockResolvedValue(undefined)
vi.mock('@/api/db/queries/videos', () => ({
  insertCrawledVideo: vi.fn().mockResolvedValue({ id: 'vid-new' }),
  bumpEpisodeCountIfHigher: vi.fn().mockResolvedValue(undefined),
  upsertVideoAliases: (...args: unknown[]) => mockUpsertVideoAliases(...args),
}))

vi.mock('@/api/db/queries/sources', () => ({
  upsertSources: vi.fn().mockResolvedValue(0),
  replaceSourcesForSite: vi.fn().mockResolvedValue({ sourcesAdded: 0, sourcesKept: 0, sourcesRemoved: 0 }),
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  insertCrawlerTaskLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/lib/config', () => ({
  config: { AUTO_PUBLISH_CRAWLED: 'false' },
}))

import { CrawlerService } from '@/api/services/CrawlerService'

const mockDb = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
} as unknown as import('pg').Pool
const mockEs = {} as unknown as import('@elastic/elasticsearch').Client

/** 最小 parsed（中文 title + 待测 titleEn）。 */
function makeParsed(titleEn: string | null) {
  return {
    video: {
      title: '他比前男友炙热',
      titleEn,
      type: 'series' as const,
      coverUrl: null,
      year: 2026,
      country: 'CN',
      description: null,
      category: 'series',
      genre: null,
      contentRating: 'general' as const,
      director: [],
      cast: [],
      writers: [],
      status: 'completed' as const,
      sourceVodId: 'vod-1',
      sourceContentType: null,
      normalizedType: null,
    },
    sources: [],
  }
}

type UpsertVideoFn = (
  parsed: ReturnType<typeof makeParsed>,
  ingestPolicy?: unknown,
  siteKey?: string,
) => Promise<{ videoId: string }>

function bindUpsert(db: import('pg').Pool = mockDb): UpsertVideoFn {
  const svc = new CrawlerService(db, mockEs)
  return (svc as unknown as { upsertVideo: UpsertVideoFn }).upsertVideo.bind(svc)
}

describe('CrawlerService — CHG-VIR-11-D catalog 写入边界拼音门禁', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOrCreate.mockResolvedValue({ id: 'cat-1' })
    mockUpsertVideoAliases.mockResolvedValue(undefined)
  })

  it('拼音 vod_en → catalog.title_en 置 null（不污染 knownNames）', async () => {
    await bindUpsert()(makeParsed('tabiqiannanyouzhire'), undefined, 'site-a')
    expect(mockFindOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ titleEn: null }),
    )
  })

  it('拼音 vod_en → 仍原样写入 video_aliases（跨站召回不丢）', async () => {
    await bindUpsert()(makeParsed('tabiqiannanyouzhire'), undefined, 'site-a')
    const [, , aliases] = mockUpsertVideoAliases.mock.calls[0] as [unknown, unknown, string[]]
    expect(aliases).toContain('tabiqiannanyouzhire')
  })

  it('真英文 vod_en → catalog.title_en 与 video_aliases 均保留', async () => {
    await bindUpsert()(makeParsed('The Avengers'), undefined, 'site-a')
    expect(mockFindOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ titleEn: 'The Avengers' }),
    )
    const [, , aliases] = mockUpsertVideoAliases.mock.calls[0] as [unknown, unknown, string[]]
    expect(aliases).toContain('The Avengers')
  })

  it('vod_en 为 null → catalog.title_en 为 null（既有行为不变）', async () => {
    await bindUpsert()(makeParsed(null), undefined, 'site-a')
    expect(mockFindOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ titleEn: null }),
    )
  })
})
