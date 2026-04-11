/**
 * tests/unit/api/crawler-service-es.test.ts
 * CHG-161: upsertVideo 对新视频和已存在视频均触发 ES 索引
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CrawlerService } from '@/api/services/CrawlerService'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  METADATA_SOURCE_PRIORITY: { tmdb: 4, douban: 3, manual: 2, crawler: 1 },
  findVideoByNormalizedKey: vi.fn(),
  insertCrawledVideo: vi.fn(),
  upsertVideoAliases: vi.fn(),
  transitionVideoState: vi.fn(),
  bumpEpisodeCountIfHigher: vi.fn(),
}))
// MediaCatalogService 内部使用 db.connect，直接 mock 整个 class 避免复杂 DB 依赖
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: class {
    findOrCreate = vi.fn().mockResolvedValue({ id: 'cat-uuid-1', title: '测试视频' })
  },
}))
vi.mock('@/api/db/queries/sources', () => ({
  upsertSources: vi.fn(),
}))
vi.mock('@/api/db/queries/crawlerSites', () => ({
  listEnabledCrawlerSites: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/services/TitleNormalizer', () => ({
  normalizeTitle: vi.fn((t: string) => t.toLowerCase()),
}))
vi.mock('@/api/lib/config', () => ({
  config: { AUTO_PUBLISH_CRAWLED: 'false' },
}))

import * as videosQueries from '@/api/db/queries/videos'
import * as sourcesQueries from '@/api/db/queries/sources'

const mockFindByKey = videosQueries.findVideoByNormalizedKey as ReturnType<typeof vi.fn>
const mockInsert = videosQueries.insertCrawledVideo as ReturnType<typeof vi.fn>
const mockUpsertAliases = videosQueries.upsertVideoAliases as ReturnType<typeof vi.fn>
const mockUpsertSources = sourcesQueries.upsertSources as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────

const DB_ROW = {
  id: 'vid-new',
  short_id: 'abCD1234',
  slug: null,
  title: '进击的巨人',
  title_en: 'Attack on Titan',
  cover_url: null,
  type: 'anime',
  category: null,
  year: 2013,
  country: 'JP',
  episode_count: 25,
  rating: null,
  status: 'completed',
  is_published: false,
}

function makeDb() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [DB_ROW] }),
    release: vi.fn(),
  }
  return {
    query: vi.fn().mockResolvedValue({ rows: [DB_ROW] }),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as import('pg').Pool
}

function makeEs() {
  return { index: vi.fn().mockResolvedValue({}) } as unknown as import('@elastic/elasticsearch').Client
}

const PARSED_ITEM = {
  video: {
    title: '进击的巨人',
    titleEn: 'Attack on Titan',
    coverUrl: null,
    type: 'anime' as const,
    category: null,
    year: 2013,
    country: 'JP',
    cast: [],
    director: [],
    writers: [],
    description: null,
    status: 'completed' as const,
  },
  sources: [
    { episodeNumber: 1, sourceUrl: 'https://cdn.example.com/ep1.m3u8', sourceName: 'site-a', type: 'hls' as const },
  ],
}

// ── Tests ─────────────────────────────────────────────────────────

describe('CrawlerService.upsertVideo — ES 同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsertAliases.mockResolvedValue(undefined)
    mockUpsertSources.mockResolvedValue(1)
  })

  it('新视频：insertCrawledVideo 后触发 ES 索引', async () => {
    mockFindByKey.mockResolvedValue(null)
    mockInsert.mockResolvedValue({ id: 'vid-new' })

    const db = makeDb()
    const es = makeEs()
    const svc = new CrawlerService(db, es)
    await svc.upsertVideo(PARSED_ITEM)

    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    const call = (es.index as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.id).toBe('vid-new')
    expect(call.index).toBe('resovo_videos')
  })

  it('已存在视频：upsertVideo 后同样触发 ES 索引（补偿历史数据）', async () => {
    mockFindByKey.mockResolvedValue({
      id: 'vid-existing',
      metadataSource: 'crawler',
    })

    // DB query 内部会用 vid-existing 查询，返回对应行
    const db = {
      query: vi.fn().mockResolvedValue({
        rows: [{ ...DB_ROW, id: 'vid-existing' }],
      }),
    } as unknown as import('pg').Pool
    const es = makeEs()
    const svc = new CrawlerService(db, es)
    await svc.upsertVideo(PARSED_ITEM)

    await vi.waitFor(() => expect(es.index).toHaveBeenCalledTimes(1))
    expect((es.index as ReturnType<typeof vi.fn>).mock.calls[0][0].id).toBe('vid-existing')
  })

  it('无 ES 客户端时不抛出错误', async () => {
    mockFindByKey.mockResolvedValue(null)
    mockInsert.mockResolvedValue({ id: 'vid-new' })

    // CrawlerService 要求 es 参数（非可选），传入一个空对象绕过
    const db = makeDb()
    const es = { index: vi.fn().mockRejectedValue(new Error('no connection')) } as unknown as import('@elastic/elasticsearch').Client
    const svc = new CrawlerService(db, es)

    await expect(svc.upsertVideo(PARSED_ITEM)).resolves.not.toThrow()
  })
})
