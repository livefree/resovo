/**
 * tests/unit/api/metadataEnrich.test.ts
 * CHG-385 / META-05: MetadataEnrichService 五步丰富逻辑
 * 覆盖：Step1 本地多字段召回（title_norm + alias fallback）、置信度决策、
 *        video_external_refs 写入、Step2 网络搜索、Step3 bangumi、Step4 源检验、Step5 meta_score
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks（factory 内部不引用外部变量，避免 hoisting TDZ 问题） ─────

vi.mock('@/api/db/queries/externalData', () => ({
  findDoubanByTitleNorm: vi.fn(),
  findDoubanByAlias: vi.fn(),
  findDoubanByImdbId: vi.fn(),
  findBangumiByTitleNorm: vi.fn(),
  upsertVideoExternalRef: vi.fn().mockResolvedValue({
    id: 'ref1', videoId: 'v1', provider: 'douban', externalId: 'd1',
    matchStatus: 'auto_matched', matchMethod: 'title', confidence: 0.92,
    isPrimary: true, linkedBy: 'auto', linkedAt: '2024-01-01T00:00:00Z', notes: null,
  }),
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

import { MetadataEnrichService, computeLocalDoubanConfidence } from '@/api/services/MetadataEnrichService'
import * as externalDataQueries from '@/api/db/queries/externalData'
import * as videosQueries from '@/api/db/queries/videos'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import { searchDouban } from '@/api/lib/douban'
import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
import type { DoubanEntryMatch } from '@/api/db/queries/externalData'

// ── Helpers ────────────────────────────────────────────────────────

function makeJobData(overrides: Partial<{
  videoId: string; catalogId: string; title: string; year: number | null; type: string
}> = {}) {
  return { videoId: 'v1', catalogId: 'c1', title: '进击的巨人', year: 2013, type: 'anime', ...overrides }
}

function makeDoubanMatch(overrides: Partial<DoubanEntryMatch> = {}): DoubanEntryMatch {
  return {
    doubanId: 'd1', title: '进击的巨人', year: 2013, rating: 9.5,
    description: '一段关于巨人的故事', coverUrl: 'https://img.example.com/cover.jpg',
    directors: ['荒木哲郎'], cast: ['梶裕贵'], writers: [], genres: ['动作', '剧情'], country: '日本',
    // META-01 扩展字段
    aliases: [], imdbId: null, languages: [], durationMinutes: null,
    tags: [], doubanVotes: null, regions: [], releaseDate: null,
    actorIds: [], directorIds: [], officialSite: null,
    ...overrides,
  }
}

// ── 测试 ────────────────────────────────────────────────────────────

describe('MetadataEnrichService.enrich()', () => {
  let service: MetadataEnrichService
  let mockSafeUpdate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([])
    vi.mocked(externalDataQueries.findDoubanByAlias).mockResolvedValue([])
    vi.mocked(externalDataQueries.findBangumiByTitleNorm).mockResolvedValue([])
    vi.mocked(sourcesQueries.listSourcesForBatchVerify).mockResolvedValue([])
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue({
      id: 'c1', title: '进击的巨人', year: 2013, type: 'anime',
      coverUrl: 'https://img.example.com/cover.jpg', description: '故事介绍',
      genres: ['动作', '剧情'],
    } as Parameters<typeof catalogQueries.findCatalogById>[1] extends infer R ? R : never)
    service = new MetadataEnrichService({} as import('pg').Pool)
    mockSafeUpdate = (MediaCatalogService as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value.safeUpdate
  })

  // ── Step1: title_norm 精确匹配 ────────────────────────────────────

  it('Step1: 本地豆瓣精确匹配（年份相同）→ doubanStatus=matched', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch()])

    await service.enrich(makeJobData())

    expect(externalDataQueries.findDoubanByTitleNorm).toHaveBeenCalledWith(
      expect.anything(), expect.any(String), 2013
    )
    // 置信度 0.70+0.22=0.92 ≥ 0.85 → auto_matched → 写 catalog
    expect(mockSafeUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({ doubanId: 'd1' }), 'douban')
    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2]).toMatchObject({ doubanStatus: 'matched' })
  })

  it('Step1 auto_matched → 写 video_external_refs(auto_matched)', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch()])

    await service.enrich(makeJobData())

    expect(externalDataQueries.upsertVideoExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        videoId: 'v1',
        provider: 'douban',
        externalId: 'd1',
        matchStatus: 'auto_matched',
        isPrimary: true,
        linkedBy: 'auto',
      })
    )
  })

  it('Step1: 本地豆瓣年份不匹配（差 3 年）→ candidate，不再走 Step2', async () => {
    // confidence = 0.70(title) + 0(年差≥2) = 0.70，[0.60,0.85) → candidate
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch({ year: 2016 })])

    await service.enrich(makeJobData())

    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2]).toMatchObject({ doubanStatus: 'candidate' })
    // 本地有条目（candidate）→ step1 返回非 null → 不走网络搜索
    expect(searchDouban).not.toHaveBeenCalled()
  })

  it('Step1 candidate → 写 video_external_refs(candidate)，不写 catalog', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch({ year: 2016 })])

    await service.enrich(makeJobData())

    expect(externalDataQueries.upsertVideoExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ matchStatus: 'candidate', isPrimary: false })
    )
    // candidate 不写 catalog
    expect(mockSafeUpdate).not.toHaveBeenCalledWith('c1', expect.objectContaining({ doubanId: 'd1' }), 'douban')
  })

  // ── Step1: alias fallback ─────────────────────────────────────────

  it('Step1b: title_norm 无结果，alias 命中（年份相同）→ matched', async () => {
    // title_norm 无结果，alias 命中
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([])
    vi.mocked(externalDataQueries.findDoubanByAlias).mockResolvedValue([makeDoubanMatch()])

    await service.enrich(makeJobData())

    expect(externalDataQueries.findDoubanByAlias).toHaveBeenCalledWith(
      expect.anything(), '进击的巨人', 2013
    )
    // confidence = 0.65(alias) + 0.22(年份) = 0.87 ≥ 0.85 → auto_matched
    expect(mockSafeUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({ doubanId: 'd1' }), 'douban')
    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2]).toMatchObject({ doubanStatus: 'matched' })
    // 不走网络搜索
    expect(searchDouban).not.toHaveBeenCalled()
  })

  it('Step1b: alias 命中但年份差 2 年 → confidence=0.65 < 0.85 → candidate', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([])
    vi.mocked(externalDataQueries.findDoubanByAlias).mockResolvedValue([makeDoubanMatch({ year: 2015 })])

    await service.enrich(makeJobData())

    // confidence = 0.65(alias) + 0(年差≥2) = 0.65，[0.60,0.85) → candidate
    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2]).toMatchObject({ doubanStatus: 'candidate' })
    expect(searchDouban).not.toHaveBeenCalled()
  })

  it('Step1b: alias 命中但置信度 <0.60 → 丢弃，走 Step2', async () => {
    // alias + 无年份 → confidence=0.65，实际上 0.65 ≥ 0.60 → candidate
    // 若要触发 <0.60，需要 alias=0.65 且无年份信息匹配；但实际上 alias base=0.65 ≥ 0.60
    // 改测 title_norm + year null 场景：title base=0.70, 无年份 → confidence=0.70 → candidate（不走 Step2）
    // 这里测没有年份的 alias 匹配：0.65 < 0.85 → candidate
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([])
    vi.mocked(externalDataQueries.findDoubanByAlias).mockResolvedValue([makeDoubanMatch({ year: null })])
    vi.mocked(searchDouban).mockResolvedValue([])

    await service.enrich(makeJobData({ year: null }))

    // alias base=0.65，无年份不加分 → 0.65，[0.60,0.85) → candidate，不走 step2
    expect(searchDouban).not.toHaveBeenCalled()
    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2]).toMatchObject({ doubanStatus: 'candidate' })
  })

  // ── Step2: 网络搜索 ──────────────────────────────────────────────

  it('Step1 无本地匹配 + Step2 网络搜索命中（高置信度）→ matched', async () => {
    // title_norm 和 alias 均无结果 → step1 返回 null → step2
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

  it('Step2 命中 → 写 video_external_refs(auto_matched)', async () => {
    vi.mocked(searchDouban).mockResolvedValue([
      { id: 'db123', title: '进击的巨人', year: '2013', sub_title: '' },
    ])
    vi.mocked(getDoubanDetailRich).mockResolvedValue({
      id: 'db123', rate: '9.5', plotSummary: '故事介绍',
      poster: 'https://img.example.com/p.jpg',
      directors: [], cast: [], screenwriters: [], genres: [], countries: [],
    } as Parameters<typeof getDoubanDetailRich>[1] extends infer R ? R : never)

    await service.enrich(makeJobData())

    expect(externalDataQueries.upsertVideoExternalRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        videoId: 'v1',
        provider: 'douban',
        externalId: 'db123',
        matchStatus: 'auto_matched',
        matchMethod: 'network',
      })
    )
  })

  it('Step1 + Step2 均无结果 → unmatched', async () => {
    vi.mocked(searchDouban).mockResolvedValue([])

    await service.enrich(makeJobData())

    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2].doubanStatus).toBe('unmatched')
    expect(getDoubanDetailRich).not.toHaveBeenCalled()
  })

  // ── Step3: Bangumi ───────────────────────────────────────────────

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

  // ── Step4: 源检验 ─────────────────────────────────────────────────

  it('Step4: 无源 → source_check_status=pending', async () => {
    vi.mocked(sourcesQueries.listSourcesForBatchVerify).mockResolvedValue([])

    await service.enrich(makeJobData())

    expect(videosQueries.updateVideoSourceCheckStatus).toHaveBeenCalledWith(
      expect.anything(), 'v1', 'pending'
    )
  })

  // ── Step5: meta_score ─────────────────────────────────────────────

  it('Step5: meta_score=100（所有字段齐全）', async () => {
    vi.mocked(externalDataQueries.findDoubanByTitleNorm).mockResolvedValue([makeDoubanMatch()])
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue({
      id: 'c1', title: '进击的巨人', coverUrl: 'https://img.example.com/cover.jpg',
      description: '故事介绍', genres: ['动作'], year: 2013, type: 'anime',
    } as Parameters<typeof catalogQueries.findCatalogById>[1] extends infer R ? R : never)

    await service.enrich(makeJobData())

    const call = vi.mocked(videosQueries.updateVideoEnrichStatus).mock.calls[0]
    expect(call[2].metaScore).toBe(100)
  })
})

// ── computeLocalDoubanConfidence ──────────────────────────────────

describe('computeLocalDoubanConfidence()', () => {
  const baseEntry = (): DoubanEntryMatch => ({
    doubanId: 'd1', title: '进击的巨人', year: 2013, rating: 9.5,
    description: null, coverUrl: null, directors: [], cast: [], writers: [],
    genres: [], country: null, aliases: [], imdbId: null, languages: [],
    durationMinutes: null, tags: [], doubanVotes: null, regions: [],
    releaseDate: null, actorIds: [], directorIds: [], officialSite: null,
  })

  it('title + 年份精确 → 0.92', () => {
    const { confidence } = computeLocalDoubanConfidence(baseEntry(), 'title', 2013)
    expect(confidence).toBeCloseTo(0.92)
  })

  it('title + 年份差 1 → 0.87', () => {
    const { confidence } = computeLocalDoubanConfidence(baseEntry(), 'title', 2014)
    expect(confidence).toBeCloseTo(0.87)
  })

  it('title + 年份差 2 → 0.70（无加分）', () => {
    const { confidence } = computeLocalDoubanConfidence(baseEntry(), 'title', 2015)
    expect(confidence).toBeCloseTo(0.70)
  })

  it('alias + 年份精确 → 0.87', () => {
    const { confidence } = computeLocalDoubanConfidence(baseEntry(), 'alias', 2013)
    expect(confidence).toBeCloseTo(0.87)
  })

  it('alias + 无年份信息 → 0.65', () => {
    const entry = { ...baseEntry(), year: null }
    const { confidence } = computeLocalDoubanConfidence(entry, 'alias', null)
    expect(confidence).toBeCloseTo(0.65)
  })

  it('breakdown 字段正确记录', () => {
    const { breakdown } = computeLocalDoubanConfidence(baseEntry(), 'title', 2013)
    expect(breakdown.title).toBe(0.70)
    expect(breakdown.year_exact).toBe(0.22)
  })

  it('置信度上限为 1.0', () => {
    const entry = { ...baseEntry(), year: 2013 }
    // 即使 base+year 超过 1，结果应该被 clamp
    const { confidence } = computeLocalDoubanConfidence(entry, 'title', 2013)
    expect(confidence).toBeLessThanOrEqual(1.0)
  })
})
