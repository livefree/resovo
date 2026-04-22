/**
 * tests/unit/api/sourceRefetch.test.ts
 * CRAWLER-04: 单视频补源采集测试
 * 覆盖：标题匹配成功写入、相似度低跳过、notFound 追踪、siteKeys 过滤、视频不存在抛错
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CrawlerSource } from '@/api/services/CrawlerService'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/lib/config', () => ({
  config: { DATABASE_URL: 'postgres://test', AUTO_PUBLISH_CRAWLED: 'false' },
}))

const mockFindAdminVideoById = vi.fn()
vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: (...args: unknown[]) => mockFindAdminVideoById(...args),
}))

const mockReplaceSourcesForSite = vi.fn()
vi.mock('@/api/db/queries/sources', () => ({
  replaceSourcesForSite: (...args: unknown[]) => mockReplaceSourcesForSite(...args),
  upsertSources: vi.fn().mockResolvedValue(0),
}))

const mockGetEnabledSources = vi.fn()
vi.mock('@/api/workers/crawlerWorker', () => ({
  getEnabledSources: (...args: unknown[]) => mockGetEnabledSources(...args),
  enqueueFullCrawl: vi.fn(),
  enqueueIncrementalCrawl: vi.fn(),
}))

// ── 测试数据 ────────────────────────────────────────────────────────

const MOCK_VIDEO = {
  id: 'video-uuid-1234',
  title: '星际穿越',
}

const MOCK_SOURCE_A: CrawlerSource = {
  name: 'site-a',
  base: 'https://a.example.com',
  format: 'json',
}

const MOCK_SOURCE_B: CrawlerSource = {
  name: 'site-b',
  base: 'https://b.example.com',
  format: 'json',
}

const makeParsedItem = (title: string) => ({
  video: { title, year: 2014, type: 'movie', titleEn: null },
  sources: [
    { episodeNumber: 1, sourceUrl: 'https://cdn.a.com/ep1.mp4', sourceName: 'site-a', type: 'mp4' },
  ],
})

// ── Tests ──────────────────────────────────────────────────────────

describe('CrawlerRefetchService.refetchSourcesForVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue(MOCK_VIDEO)
    mockGetEnabledSources.mockResolvedValue([MOCK_SOURCE_A])
    mockReplaceSourcesForSite.mockResolvedValue({ sourcesAdded: 2, sourcesKept: 0, sourcesRemoved: 0 })
  })

  it('标题完全匹配时写入并返回 sourcesAdded', async () => {
    const { CrawlerRefetchService } = await import('@/api/services/CrawlerRefetchService')
    const svc = new CrawlerRefetchService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([makeParsedItem('星际穿越')])

    const result = await svc.refetchSourcesForVideo('video-uuid-1234')

    expect(result.sourcesAdded).toBe(2)
    expect(result.notFound).toHaveLength(0)
    expect(mockReplaceSourcesForSite).toHaveBeenCalledWith(
      expect.anything(),
      'video-uuid-1234',
      'site-a',
      expect.arrayContaining([
        expect.objectContaining({
          videoId: 'video-uuid-1234',
          episodeNumber: 1,
          // CRAWLER-06: 必须带行级站点 key，避免写入行 source_site_key=NULL
          sourceSiteKey: 'site-a',
        }),
      ])
    )
  })

  it('相似度 < 0.8 的结果不写入，站点计入 notFound', async () => {
    const { CrawlerRefetchService } = await import('@/api/services/CrawlerRefetchService')
    const svc = new CrawlerRefetchService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    // 完全无关的标题
    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([makeParsedItem('复仇者联盟终局之战')])

    const result = await svc.refetchSourcesForVideo('video-uuid-1234')

    expect(result.sourcesAdded).toBe(0)
    expect(result.notFound).toContain('site-a')
    expect(mockReplaceSourcesForSite).not.toHaveBeenCalled()
  })

  it('站点返回空列表时计入 notFound', async () => {
    const { CrawlerRefetchService } = await import('@/api/services/CrawlerRefetchService')
    const svc = new CrawlerRefetchService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([])

    const result = await svc.refetchSourcesForVideo('video-uuid-1234')

    expect(result.notFound).toContain('site-a')
    expect(result.sourcesAdded).toBe(0)
  })

  it('站点请求失败时计入 notFound 而非抛出异常', async () => {
    const { CrawlerRefetchService } = await import('@/api/services/CrawlerRefetchService')
    const svc = new CrawlerRefetchService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockRejectedValue(new Error('HTTP 503'))

    const result = await svc.refetchSourcesForVideo('video-uuid-1234')

    expect(result.notFound).toContain('site-a')
    expect(result.sourcesAdded).toBe(0)
  })

  it('siteKeys 过滤：只对指定站点执行补源', async () => {
    mockGetEnabledSources.mockResolvedValue([MOCK_SOURCE_A, MOCK_SOURCE_B])

    const { CrawlerRefetchService } = await import('@/api/services/CrawlerRefetchService')
    const svc = new CrawlerRefetchService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    const fetchPageSpy = vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([makeParsedItem('星际穿越')])

    await svc.refetchSourcesForVideo('video-uuid-1234', ['site-a'])

    // 只应调用 site-a
    expect(fetchPageSpy).toHaveBeenCalledTimes(1)
    expect(fetchPageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'site-a' }),
      expect.objectContaining({ keyword: '星际穿越' })
    )
  })

  it('视频不存在时抛出 VIDEO_NOT_FOUND 错误', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)

    const { CrawlerRefetchService } = await import('@/api/services/CrawlerRefetchService')
    const svc = new CrawlerRefetchService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    await expect(svc.refetchSourcesForVideo('non-existent-id')).rejects.toThrow('VIDEO_NOT_FOUND')
  })

  it('多站点：各站点独立处理，汇总 sourcesAdded', async () => {
    mockGetEnabledSources.mockResolvedValue([MOCK_SOURCE_A, MOCK_SOURCE_B])
    mockReplaceSourcesForSite
      .mockResolvedValueOnce({ sourcesAdded: 3, sourcesKept: 0, sourcesRemoved: 0 })
      .mockResolvedValueOnce({ sourcesAdded: 5, sourcesKept: 1, sourcesRemoved: 2 })

    const { CrawlerRefetchService } = await import('@/api/services/CrawlerRefetchService')
    const svc = new CrawlerRefetchService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([makeParsedItem('星际穿越')])

    const result = await svc.refetchSourcesForVideo('video-uuid-1234')

    expect(result.sourcesAdded).toBe(8)
    expect(result.notFound).toHaveLength(0)
  })
})
