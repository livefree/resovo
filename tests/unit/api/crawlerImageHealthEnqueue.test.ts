/**
 * tests/unit/api/crawlerImageHealthEnqueue.test.ts — CHORE-09
 *
 * 验证 CrawlerService 新建 video 时对 poster 的 health-check / blurhash-extract 入队
 * 修复 M6 QA 发现的"采集视频自带 poster 始终 pending_review"问题
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks 必须在 import CrawlerService 之前 ───────────────────────

const mockQueueAdd = vi.fn()
vi.mock('@/api/lib/queue', () => ({
  imageHealthQueue: { add: (...args: unknown[]) => mockQueueAdd(...args) },
  enrichmentQueue:  { add: vi.fn().mockResolvedValue({ id: 'enrich-1' }) },
}))

const mockFindOrCreate = vi.fn()
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({
    findOrCreate: mockFindOrCreate,
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

function makeParsed(coverUrl: string | null) {
  return {
    video: {
      title: 'Test',
      titleEn: null,
      type: 'movie' as const,
      coverUrl,
      year: 2026,
      country: 'CN',
      description: null,
      category: 'movie',
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

describe('CrawlerService — CHORE-09 poster health-check 入队', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOrCreate.mockResolvedValue({ id: 'cat-1' })
    // 默认 add 返回 resolved Promise（Bull job），允许 void + .catch 链
    mockQueueAdd.mockResolvedValue({ id: 'job-1' })
  })

  it('新建 video 且 coverUrl 非空 → 入队 2 个 job（health-check + blurhash-extract）', async () => {
    const svc = new CrawlerService(mockDb, mockEs)
    // 私有方法通过访问内部 API；用 type assertion 调 persistParsedVideo
    const persist = (svc as unknown as {
      upsertVideo: (parsed: ReturnType<typeof makeParsed>, ingestPolicy?: unknown, siteKey?: string) => Promise<{ videoId: string }>
    }).upsertVideo.bind(svc)

    const parsed = makeParsed('https://cdn.example/poster.jpg')
    await persist(parsed, undefined, 'site-a')

    // 至少 health-check 与 blurhash-extract 各入一次
    const healthCheckCalls = mockQueueAdd.mock.calls.filter(([name]) => name === 'health-check')
    const blurhashCalls = mockQueueAdd.mock.calls.filter(([name]) => name === 'blurhash-extract')
    expect(healthCheckCalls.length).toBe(1)
    expect(blurhashCalls.length).toBe(1)

    // data 包含 catalogId / videoId / kind='poster' / url
    const [, healthData] = healthCheckCalls[0]
    expect(healthData).toMatchObject({
      type: 'health-check',
      catalogId: 'cat-1',
      videoId: 'vid-new',
      kind: 'poster',
      url: 'https://cdn.example/poster.jpg',
    })
  })

  it('新建 video 但 coverUrl 为空 → 不入队', async () => {
    const svc = new CrawlerService(mockDb, mockEs)
    const persist = (svc as unknown as {
      upsertVideo: (parsed: ReturnType<typeof makeParsed>, ingestPolicy?: unknown, siteKey?: string) => Promise<{ videoId: string }>
    }).upsertVideo.bind(svc)

    const parsed = makeParsed(null)
    await persist(parsed, undefined, 'site-a')

    const imageJobCalls = mockQueueAdd.mock.calls.filter(
      ([name]) => name === 'health-check' || name === 'blurhash-extract',
    )
    expect(imageJobCalls.length).toBe(0)
  })

  it('已存在 video（catalog 已建）→ 不重复入队（假设历史已入）', async () => {
    // 模拟 existingVideoResult 查到已有 video
    const dbWithExisting = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'vid-existing' }] }),
    } as unknown as import('pg').Pool
    const svc = new CrawlerService(dbWithExisting, mockEs)
    const persist = (svc as unknown as {
      upsertVideo: (parsed: ReturnType<typeof makeParsed>, ingestPolicy?: unknown, siteKey?: string) => Promise<{ videoId: string }>
    }).upsertVideo.bind(svc)

    await persist(makeParsed('https://cdn.example/poster.jpg'), undefined, 'site-a')

    const imageJobCalls = mockQueueAdd.mock.calls.filter(
      ([name]) => name === 'health-check' || name === 'blurhash-extract',
    )
    expect(imageJobCalls.length).toBe(0)
  })

  it('队列入队失败 → stderr warn，不阻断主流程', async () => {
    mockQueueAdd.mockRejectedValueOnce(new Error('redis down'))
    const svc = new CrawlerService(mockDb, mockEs)
    const persist = (svc as unknown as {
      upsertVideo: (parsed: ReturnType<typeof makeParsed>, ingestPolicy?: unknown, siteKey?: string) => Promise<{ videoId: string }>
    }).upsertVideo.bind(svc)

    // 不应抛错（主流程返回正常结构）
    const result = await persist(makeParsed('https://cdn.example/poster.jpg'), undefined, 'site-a')
    expect(result).toHaveProperty('videoId')
  })
})
