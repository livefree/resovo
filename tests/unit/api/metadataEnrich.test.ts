/**
 * tests/unit/api/metadataEnrich.test.ts
 * CHG-385: MetadataEnrichService 五步丰富逻辑
 * 覆盖：Step1 本地匹配、Step2 网络搜索、Step3 bangumi、Step4 源检验、Step5 meta_score
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks（factory 内部不引用外部变量，避免 hoisting TDZ 问题） ─────

vi.mock('@/api/db/queries/externalData', () => ({
  findDoubanByTitleNorm: vi.fn(),
  findBangumiByTitleNorm: vi.fn(),
}))

vi.mock('@/api/db/queries/videos', () => ({
  updateVideoEnrichStatus: vi.fn().mockResolvedValue(undefined),
  updateVideoSourceCheckStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/sources', () => ({
  listSourcesForBatchVerify: vi.fn(),
  updateSourceActiveStatus: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@/api/services/TitleNormalizer', () => ({
  normalizeTitle: vi.fn((t: string) => t.toLowerCase().replace(/\s/g, '')),
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}))

// ── Import after mocks ──────────────────────────────────────────────

import { MetadataEnrichService } from '@/api/services/MetadataEnrichService'
import * as externalDataQueries from '@/api/db/queries/externalData'
import * as videosQueries from '@/api/db/queries/videos'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import { searchDouban } from '@/api/lib/douban'
import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'

// ── Helpers ────────────────────────────────────────────────────────

function makeJobData(overrides: Partial<{ videoId: string; catalogId: string; title: string; year: number | null; type: string }> = {}) {
  return { videoId: 'v1', catalogId: 'c1', title: '进击的巨人', year: 2013, type: 'anime', ...overrides }
}

function makeDoubanMatch(overrides: Partial<{
  doubanId: string; title: string; year: number | null; rating: number | null
  description: string | null; coverUrl: string | null; directors: string[]; cast: string[]
  writers: string[]; genres: string[]; country: string | null
}> = {}) {
  return {
    doubanId: 'd1', title: '进击的巨人', year: 2013, rating: 9.5,
    description: '一段关于巨人的故事', coverUrl: 'https://img.example.com/cover.jpg',
    directors: ['荒木哲郎'], cast: ['梶裕贵'], writers: [], genres: ['动作', '剧情'], country: '日本',
    ...overrides,
  }
}

// ── 测试 ────────────────────────────────────────────────────────────

describe('MetadataEnrichService.enrich()', () => {
  let service: MetadataEnrichService
  let mockSafeUpdate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sourcesQueries.listSourcesForBatchVerify).mockResolvedValue([])
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue({
      id: 'c1', title: '进击的巨人', year: 2013, type: 'anime',
      coverUrl: 'https://img.example.com/cover.jpg', description: '故事介绍',
      genres: ['动作', '剧情'],
    } as Parameters<typeof catalogQueries.findCatalogById>[1] extends infer R ? R : never)
    service = new MetadataEnrichService({} as import('pg').Pool)
    mockSafeUpdate = (MediaCatalogService as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value.safeUpdate
  })

  it('Step1: 本地豆瓣精确匹配（年份相同）→ doubanStatus=matched', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch()])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([])

    await service.enrich(makeJobData())

    expect(externalDataQueries.findDoubanByTitleNorm).toHaveBeenCalledWith(expect.anything(), expect.any(String), 2013)
    expect(mockSafeUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({ doubanId: 'd1' }), 'douban')
    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2]).toMatchObject({ doubanStatus: 'matched' })
  })

  it('Step1: 本地豆瓣年份不匹配（差 3 年）→ candidate，不再走 Step2', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch({ year: 2016 })])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([])

    await service.enrich(makeJobData())

    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2]).toMatchObject({ doubanStatus: 'candidate' })
    // 本地有条目（candidate），不走网络搜索
    expect(searchDouban).not.toHaveBeenCalled()
  })

  it('Step1 无本地匹配 + Step2 网络搜索命中（高置信度）→ matched', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([])
    vi.mocked(searchDouban).mockResolvedValue([
      { id: 'db123', title: '进击的巨人', year: '2013', sub_title: '' },
    ])
    vi.mocked(getDoubanDetailRich).mockResolvedValue({
      id: 'db123', rate: '9.5', plotSummary: '故事介绍',
      poster: 'https://img.example.com/p.jpg',
      directors: ['荒木哲郎'], cast: ['梶裕贵'], screenwriters: [],
      genres: ['动作'], countries: ['日本'],
    } as Parameters<typeof getDoubanDetailRich>[1] extends infer R ? R : never)

    await service.enrich(makeJobData())

    expect(getDoubanDetailRich).toHaveBeenCalledWith('db123')
    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2].doubanStatus).toBe('matched')
  })

  it('Step1 + Step2 均无结果 → unmatched', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([])
    vi.mocked(searchDouban).mockResolvedValue([])

    await service.enrich(makeJobData())

    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2].doubanStatus).toBe('unmatched')
    expect(getDoubanDetailRich).not.toHaveBeenCalled()
  })

  it('Step3: type=anime 且有 bangumi 匹配 → safeUpdate source=bangumi', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch()])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([{
      bangumiId: 999, titleCn: '进击的巨人', titleJp: '進撃の巨人',
      year: 2013, rating: 9.0, summary: '关于巨人', airDate: '2013-04-06',
    }])

    await service.enrich(makeJobData({ type: 'anime' }))

    const bangumiCall = mockSafeUpdate.mock.calls.find((c: unknown[]) => c[2] === 'bangumi')
    expect(bangumiCall).toBeDefined()
    expect(bangumiCall[1]).toMatchObject({ bangumiSubjectId: 999 })
  })

  it('Step4: 无源 → source_check_status=pending', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([])
    vi.mocked(searchDouban).mockResolvedValue([])
    vi.mocked(sourcesQueries.listSourcesForBatchVerify).mockResolvedValue([])

    await service.enrich(makeJobData())

    expect(videosQueries.updateVideoSourceCheckStatus).toHaveBeenCalledWith(
      expect.anything(), 'v1', 'pending'
    )
  })

  it('Step5: meta_score=100（所有字段齐全）', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch()])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([])
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue({
      id: 'c1', title: '进击的巨人', coverUrl: 'https://img.example.com/cover.jpg',
      description: '故事介绍', genres: ['动作'], year: 2013, type: 'anime',
    } as Parameters<typeof catalogQueries.findCatalogById>[1] extends infer R ? R : never)

    await service.enrich(makeJobData())

    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2].metaScore).toBe(100)
  })
})
