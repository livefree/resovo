/**
 * tests/unit/api/ingestPolicy.test.ts
 * CHG-203: 采集入库路由接入 ingest_policy（allow_auto_publish）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  findVideoByNormalizedKey: vi.fn(),
  insertCrawledVideo: vi.fn(),
  upsertVideoAliases: vi.fn(),
  METADATA_SOURCE_PRIORITY: { crawler: 1, manual: 2, douban: 3, tmdb: 4 },
}))

vi.mock('@/api/db/queries/sources', () => ({
  upsertSources: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  createTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerSites', () => ({
  listEnabledCrawlerSites: vi.fn(),
  updateCrawlStatus: vi.fn(),
}))

vi.mock('@/api/lib/config', () => ({
  config: { AUTO_PUBLISH_CRAWLED: 'false' },
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'testid12'),
}))

import * as videosQueries from '@/api/db/queries/videos'
import * as sourcesQueries from '@/api/db/queries/sources'
import { CrawlerService } from '@/api/services/CrawlerService'

const mockFindByKey = videosQueries.findVideoByNormalizedKey as ReturnType<typeof vi.fn>
const mockInsert = videosQueries.insertCrawledVideo as ReturnType<typeof vi.fn>
const mockUpsertAliases = videosQueries.upsertVideoAliases as ReturnType<typeof vi.fn>
const mockUpsertSources = sourcesQueries.upsertSources as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────

function makeDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as import('pg').Pool
}

function makeEs() {
  return {
    index: vi.fn().mockResolvedValue({}),
  } as unknown as import('@elastic/elasticsearch').Client
}

function makeParsedVideo() {
  return {
    video: {
      title: '测试视频',
      titleEn: null,
      coverUrl: null,
      type: 'movie' as const,
      category: '剧情片',
      genre: null,
      contentRating: 'general' as const,
      year: 2024,
      country: null,
      cast: [],
      director: [],
      writers: [],
      description: null,
      status: 'completed' as const,
    },
    sources: [
      {
        episodeNumber: 1,
        sourceUrl: 'https://example.com/v.m3u8',
        sourceName: 'test',
        type: 'hls' as const,
      },
    ],
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('CrawlerService.upsertVideo — ingestPolicy 入库路由', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindByKey.mockResolvedValue(null) // 新视频
    mockInsert.mockResolvedValue({ id: 'vid-new' })
    mockUpsertAliases.mockResolvedValue(undefined)
    mockUpsertSources.mockResolvedValue(1)
  })

  it('allow_auto_publish=true — 入库为 approved/public', async () => {
    const svc = new CrawlerService(makeDb(), makeEs())

    await svc.upsertVideo(makeParsedVideo(), { allow_auto_publish: true })

    const insertCall = mockInsert.mock.calls[0][1]
    expect(insertCall.isPublished).toBe(true)
    expect(insertCall.reviewStatus).toBe('approved')
    expect(insertCall.visibilityStatus).toBe('public')
  })

  it('allow_auto_publish=false — 入库为 pending_review/internal', async () => {
    const svc = new CrawlerService(makeDb(), makeEs())

    await svc.upsertVideo(makeParsedVideo(), { allow_auto_publish: false })

    const insertCall = mockInsert.mock.calls[0][1]
    expect(insertCall.isPublished).toBe(false)
    expect(insertCall.reviewStatus).toBe('pending_review')
    expect(insertCall.visibilityStatus).toBe('internal')
  })

  it('无 ingestPolicy — 降级到全局 AUTO_PUBLISH_CRAWLED (false)', async () => {
    const svc = new CrawlerService(makeDb(), makeEs())

    await svc.upsertVideo(makeParsedVideo()) // 不传 ingestPolicy

    const insertCall = mockInsert.mock.calls[0][1]
    expect(insertCall.isPublished).toBe(false)
    expect(insertCall.reviewStatus).toBe('pending_review')
    expect(insertCall.visibilityStatus).toBe('internal')
  })

  it('已存在的视频 — 不调用 insertCrawledVideo，不受 ingestPolicy 影响', async () => {
    mockFindByKey.mockResolvedValue({ id: 'vid-existing', metadataSource: 'crawler' })

    const svc = new CrawlerService(makeDb(), makeEs())
    await svc.upsertVideo(makeParsedVideo(), { allow_auto_publish: true })

    expect(mockInsert).not.toHaveBeenCalled()
  })
})
