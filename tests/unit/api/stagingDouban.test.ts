/**
 * tests/unit/api/stagingDouban.test.ts
 * CHG-386: DoubanService 暂存队列豆瓣操作
 * 覆盖：batchEnqueueEnrich / searchByKeyword / confirmSubject
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn(),
  updateVideoEnrichStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogById: vi.fn(),
}))

vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({
    safeUpdate: vi.fn().mockResolvedValue(true),
  })),
}))

vi.mock('@/api/lib/douban', () => ({
  searchDouban: vi.fn(),
}))

vi.mock('@/api/lib/doubanAdapter', () => ({
  getDoubanDetailRich: vi.fn(),
}))

vi.mock('@/api/lib/genreMapper', () => ({
  mapDoubanGenres: vi.fn((genres: string[]) => genres),
}))

vi.mock('@/api/lib/queue', () => ({
  enrichmentQueue: {
    add: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}))

vi.mock('@/api/db/queries/externalData', () => ({
  upsertVideoExternalRef: vi.fn().mockResolvedValue({ id: 'ref-1', videoId: 'v1', provider: 'douban', externalId: 'db123' }),
  listVideoExternalRefs: vi.fn().mockResolvedValue([]),
  findDoubanEntryById: vi.fn().mockResolvedValue(null),
  findDoubanByTitleNorm: vi.fn().mockResolvedValue(null),
  findPrimaryVideoExternalRef: vi.fn().mockResolvedValue(null),
  updateExternalRefMatchStatus: vi.fn().mockResolvedValue(undefined),
}))

// ── Import after mocks ────────────────────────────────────────────

import { DoubanService } from '@/api/services/DoubanService'
import * as videoQueries from '@/api/db/queries/videos'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import { searchDouban } from '@/api/lib/douban'
import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
import { enrichmentQueue } from '@/api/lib/queue'

// ── Helpers ───────────────────────────────────────────────────────

function makeVideo(overrides: Partial<{ id: string; catalog_id: string; title: string; year: number | null; type: string }> = {}) {
  return {
    id: 'v1', catalog_id: 'c1', title: '进击的巨人', year: 2013, type: 'anime',
    ...overrides,
  }
}

function makeCatalog(overrides: Partial<{
  id: string; title: string; coverUrl: string | null; description: string | null
  genres: string[]; year: number | null; type: string
}> = {}) {
  return {
    id: 'c1', title: '进击的巨人', coverUrl: 'https://img.example.com/cover.jpg',
    description: '关于巨人', genres: ['动作'], year: 2013, type: 'anime',
    ...overrides,
  }
}

function makeDetail() {
  return {
    id: 'db123', title: '进击的巨人', year: '2013', rate: '9.5',
    plotSummary: '关于巨人的故事', poster: 'https://img.example.com/p.jpg',
    directors: ['荒木哲郎'], cast: ['梶裕贵'], screenwriters: [],
    genres: ['动作'], countries: ['日本'], languages: ['日语'],
  }
}

// ── 测试 ──────────────────────────────────────────────────────────

describe('DoubanService.batchEnqueueEnrich()', () => {
  let service: DoubanService
  const mockPool = {} as import('pg').Pool

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DoubanService(mockPool)
  })

  it('为每个有效视频入队一个 enrich job', async () => {
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue(makeVideo() as never)

    const result = await service.batchEnqueueEnrich(['v1', 'v2'])

    expect(videoQueries.findAdminVideoById).toHaveBeenCalledTimes(2)
    expect(enrichmentQueue.add).toHaveBeenCalledTimes(2)
    expect(enrichmentQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'v1', catalogId: 'c1' }),
      expect.objectContaining({ jobId: 'enrich-v1', delay: 0 })
    )
    expect(result).toEqual({ queued: 2, skipped: 0 })
  })

  it('视频不存在时跳过，不入队', async () => {
    vi.mocked(videoQueries.findAdminVideoById)
      .mockResolvedValueOnce(makeVideo() as never)
      .mockResolvedValueOnce(null)

    const result = await service.batchEnqueueEnrich(['v1', 'v_missing'])

    expect(enrichmentQueue.add).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ queued: 1, skipped: 1 })
  })

  it('空数组返回 queued=0, skipped=0', async () => {
    const result = await service.batchEnqueueEnrich([])
    expect(result).toEqual({ queued: 0, skipped: 0 })
    expect(enrichmentQueue.add).not.toHaveBeenCalled()
  })
})

describe('DoubanService.searchByKeyword()', () => {
  let service: DoubanService
  const mockPool = {} as import('pg').Pool

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DoubanService(mockPool)
  })

  it('透传 searchDouban 返回结果', async () => {
    const mockResults = [{ id: 'db1', title: '进击的巨人', year: '2013', sub_title: '' }]
    vi.mocked(searchDouban).mockResolvedValue(mockResults)

    const result = await service.searchByKeyword('进击的巨人')

    expect(searchDouban).toHaveBeenCalledWith('进击的巨人')
    expect(result).toEqual(mockResults)
  })

  it('无结果时返回空数组', async () => {
    vi.mocked(searchDouban).mockResolvedValue([])
    const result = await service.searchByKeyword('不存在的作品')
    expect(result).toEqual([])
  })
})

describe('DoubanService.confirmSubject()', () => {
  let service: DoubanService
  const mockPool = {} as import('pg').Pool

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DoubanService(mockPool)
  })

  it('成功写入豆瓣信息并更新 douban_status=matched', async () => {
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue(makeVideo() as never)
    vi.mocked(getDoubanDetailRich).mockResolvedValue(makeDetail() as never)
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(makeCatalog() as never)

    const result = await service.confirmSubject('v1', 'db123')

    // 获取本次调用产生的 safeUpdate mock
    const mockSafeUpdate = (MediaCatalogService as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value.safeUpdate
    expect(result.updated).toBe(true)
    expect(getDoubanDetailRich).toHaveBeenCalledWith('db123')
    expect(mockSafeUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({ doubanId: 'db123' }), 'douban', expect.objectContaining({ sourceRef: 'db123' }))
    expect(videoQueries.updateVideoEnrichStatus).toHaveBeenCalledWith(
      mockPool, 'v1', expect.objectContaining({ doubanStatus: 'matched' })
    )
  })

  it('meta_score 正确计算（所有字段齐全 → 100）', async () => {
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue(makeVideo() as never)
    vi.mocked(getDoubanDetailRich).mockResolvedValue(makeDetail() as never)
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue(makeCatalog() as never)

    await service.confirmSubject('v1', 'db123')

    const call = vi.mocked(videoQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2].metaScore).toBe(100)
  })

  it('视频不存在 → updated=false, reason=video_not_found', async () => {
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue(null)

    const result = await service.confirmSubject('v_missing', 'db123')

    expect(result).toEqual({ updated: false, reason: 'video_not_found' })
    expect(getDoubanDetailRich).not.toHaveBeenCalled()
  })

  it('豆瓣详情抓取失败 → updated=false, reason=fetch_failed', async () => {
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue(makeVideo() as never)
    vi.mocked(getDoubanDetailRich).mockResolvedValue(null)

    const result = await service.confirmSubject('v1', 'db_bad')

    expect(result).toEqual({ updated: false, reason: 'fetch_failed' })
    // MediaCatalogService 在抓取失败前不应被实例化
    expect(MediaCatalogService).not.toHaveBeenCalled()
  })

  it('catalog safeUpdate 被拒绝（locked）→ updated=false', async () => {
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue(makeVideo() as never)
    vi.mocked(getDoubanDetailRich).mockResolvedValue(makeDetail() as never)
    // 让本次实例化的 safeUpdate 返回 false
    vi.mocked(MediaCatalogService).mockImplementationOnce(() => ({
      safeUpdate: vi.fn().mockResolvedValue(false),
    }))

    const result = await service.confirmSubject('v1', 'db123')

    expect(result).toEqual({ updated: false, reason: 'catalog_update_rejected' })
    expect(videoQueries.updateVideoEnrichStatus).not.toHaveBeenCalled()
  })
})
