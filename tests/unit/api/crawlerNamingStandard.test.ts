import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  findOrCreateWithMatchMock,
  insertCrawledVideoMock,
  upsertVideoAliasesMock,
  upsertSourcesMock,
  syncVideoMock,
} = vi.hoisted(() => ({
  findOrCreateWithMatchMock: vi.fn(),
  insertCrawledVideoMock: vi.fn(),
  upsertVideoAliasesMock: vi.fn(),
  upsertSourcesMock: vi.fn(),
  syncVideoMock: vi.fn(),
}))

vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: class {
    findOrCreateWithMatch = findOrCreateWithMatchMock
  },
}))

vi.mock('@/api/services/VideoIndexSyncService', () => ({
  VideoIndexSyncService: class {
    syncVideo = syncVideoMock
  },
}))

vi.mock('@/api/db/queries/videos', () => ({
  insertCrawledVideo: insertCrawledVideoMock,
  bumpEpisodeCountIfHigher: vi.fn().mockResolvedValue(undefined),
  upsertVideoAliases: upsertVideoAliasesMock,
}))

vi.mock('@/api/db/queries/sources', () => ({
  upsertSources: upsertSourcesMock,
  replaceSourcesForSite: vi.fn().mockResolvedValue({ sourcesAdded: 0, sourcesKept: 0, sourcesRemoved: 0 }),
}))

vi.mock('@/api/db/queries/titleObservations', () => ({
  recordTitleObservation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/services/identity/ingestShadow', () => ({
  runIngestShadowScoring: vi.fn().mockResolvedValue({
    outcome: 'no-counterpart',
    counterparts: 0,
    candidatesUpserted: 0,
    shadowCatalogId: null,
    durationMs: 0,
  }),
}))

vi.mock('@/api/lib/queue', () => ({
  enrichmentQueue: { add: vi.fn().mockResolvedValue({ id: 'enrich-1' }) },
  imageHealthQueue: { add: vi.fn().mockResolvedValue({ id: 'image-1' }) },
}))

vi.mock('@/api/lib/config', () => ({
  config: { AUTO_PUBLISH_CRAWLED: 'false' },
}))

import { CrawlerService } from '@/api/services/CrawlerService'

function makeDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as import('pg').Pool
}

function makeParsed(title: string, overrides?: { vodLang?: string | null; sourceName?: string }) {
  return {
    video: {
      title,
      titleEn: null,
      coverUrl: null,
      type: 'anime' as const,
      sourceContentType: null,
      normalizedType: null,
      category: null,
      genre: null,
      contentRating: 'general' as const,
      year: 2024,
      country: 'JP',
      vodLang: overrides?.vodLang ?? null,
      cast: [],
      director: [],
      writers: [],
      description: null,
      status: 'completed' as const,
      sourceVodId: 'vod-1',
    },
    sources: [
      {
        episodeNumber: 1,
        sourceUrl: 'https://cdn.example.com/ep1.m3u8',
        sourceName: overrides?.sourceName ?? 'line-a',
        type: 'hls' as const,
      },
    ],
  }
}

describe('CrawlerService.upsertVideo — 标准标题入库', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findOrCreateWithMatchMock.mockResolvedValue({ catalog: { id: 'cat-1' }, matchedStep: 'created' })
    insertCrawledVideoMock.mockResolvedValue({ id: 'vid-1' })
    upsertVideoAliasesMock.mockResolvedValue(undefined)
    upsertSourcesMock.mockResolvedValue(1)
    syncVideoMock.mockResolvedValue(undefined)
  })

  it('第N季 + 国语/画质/更新态：catalog 按季匹配，显示标题不含噪声', async () => {
    const service = new CrawlerService(makeDb(), {} as import('@elastic/elasticsearch').Client)
    await service.upsertVideo(makeParsed('斗罗大陆 第2季 国语 1080p 更新至30集'))

    expect(findOrCreateWithMatchMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '斗罗大陆 第2季',
      titleNormalized: '斗罗大陆',
      seasonNumber: 2,
    }))
    expect(insertCrawledVideoMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      title: '斗罗大陆 第2季',
    }))
    expect(upsertVideoAliasesMock).toHaveBeenCalledWith(
      expect.anything(),
      'vid-1',
      ['斗罗大陆 第2季', '斗罗大陆 第2季 国语 1080p 更新至30集'],
    )
  })

  it('剧场版保留发布形态，国语不进入显示标题', async () => {
    const service = new CrawlerService(makeDb(), {} as import('@elastic/elasticsearch').Client)
    await service.upsertVideo(makeParsed('某番 剧场版 国语'))

    expect(findOrCreateWithMatchMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '某番 剧场版',
      titleNormalized: '某番 剧场版',
      seasonNumber: null,
    }))
    expect(insertCrawledVideoMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      title: '某番 剧场版',
    }))
  })

  // ── ADR-199 D-199-3：语言双维度五级推断链写入 ──────────────────────────────

  it('标题含国语 → source 行 audioLanguage=国语 / title_token（剥出标题后沉淀 source 层）', async () => {
    const service = new CrawlerService(makeDb(), {} as import('@elastic/elasticsearch').Client)
    await service.upsertVideo(makeParsed('斗罗大陆 第2季 国语 1080p 更新至30集'))

    expect(upsertSourcesMock).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({
      audioLanguage: '国语',
      audioLanguageSource: 'title_token',
      subtitleLanguages: null,
      subtitleLanguageSource: 'unknown',
    })])
  })

  it('vod_lang 优先于地区推断；汉语普通话归一为国语', async () => {
    const service = new CrawlerService(makeDb(), {} as import('@elastic/elasticsearch').Client)
    await service.upsertVideo(makeParsed('某番', { vodLang: '汉语普通话' }))

    expect(upsertSourcesMock).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({
      audioLanguage: '国语',
      audioLanguageSource: 'vod_lang',
    })])
  })

  it('无语言信号 → country=JP 地区推断 日语 / region_inferred', async () => {
    const service = new CrawlerService(makeDb(), {} as import('@elastic/elasticsearch').Client)
    await service.upsertVideo(makeParsed('某番'))

    expect(upsertSourcesMock).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({
      audioLanguage: '日语',
      audioLanguageSource: 'region_inferred',
    })])
  })

  it('线路名行级 token 最高优先级（粤语线路盖过 vod_lang 国语）', async () => {
    const service = new CrawlerService(makeDb(), {} as import('@elastic/elasticsearch').Client)
    await service.upsertVideo(makeParsed('某剧', { vodLang: '国语', sourceName: '粤语线路' }))

    expect(upsertSourcesMock).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({
      audioLanguage: '粤语',
      audioLanguageSource: 'source_name_token',
    })])
  })
})
