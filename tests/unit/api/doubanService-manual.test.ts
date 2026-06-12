/**
 * tests/unit/api/doubanService-manual.test.ts
 *
 * CHG-367-B-B / ADR-163 D-163-6：DoubanService.confirmSubject + confirmFields 手动写入路径
 *   - 验证 detail.episodes 触发 updateVideoEpisodes(manual)（同时写 total + current / 覆盖既有值）
 *   - 验证 confirmFields fields 含 'episodes' 时走 manual 路径（Y2 黄线扩展键）
 *   - 验证 episodes 缺失 / 本地 dump 路径（无 episodes 字段 / A3 advisory）→ 跳过写入
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks（外部依赖全部 mock；MediaCatalogService 通过 vi.mock 替身）─────

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn(),
  updateVideoEnrichStatus: vi.fn().mockResolvedValue(undefined),
  updateVideoEpisodes: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/api/db/queries/mediaCatalog', () => ({
  findCatalogById: vi.fn(),
}))

vi.mock('@/api/db/queries/externalData', () => ({
  upsertVideoExternalRef: vi.fn().mockResolvedValue(undefined),
  findDoubanEntryById: vi.fn(),
}))

vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({
    safeUpdate: vi.fn().mockResolvedValue({ updated: { id: 'c1' }, skippedFields: [] }),
  })),
}))

vi.mock('@/api/lib/doubanAdapter', () => ({
  getDoubanDetailRich: vi.fn(),
}))

vi.mock('@/api/lib/genreMapper', () => ({
  mapDoubanGenres: vi.fn((genres: string[]) => genres),
}))

vi.mock('@/api/lib/queue', () => ({
  enrichmentQueue: { add: vi.fn().mockResolvedValue(undefined) },
  // BUGFIX-IDENTITY-ENRICH-RESCORE：DoubanService 经 enqueueVideoRescore 引入
  identityCandidateQueue: { add: vi.fn().mockResolvedValue({ id: 'j1' }) },
}))

// ── 真实导入（mocks 完成后）──────────────────────────────────────────

import { DoubanService } from '@/api/services/DoubanService'
import * as videoQueries from '@/api/db/queries/videos'
import * as catalogQueries from '@/api/db/queries/mediaCatalog'
import * as externalDataQueries from '@/api/db/queries/externalData'
import { getDoubanDetailRich } from '@/api/lib/doubanAdapter'

const VIDEO_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const CATALOG_ID = 'cccccccc-dddd-eeee-ffff-111111111111'
const SUBJECT_ID = '26266893'

function makeDetail(overrides: Partial<{ episodes: number }> = {}) {
  return {
    id: SUBJECT_ID,
    title: '某剧集',
    rate: '8.0',
    year: '2024',
    poster: 'https://img.example.com/p.jpg',
    plotSummary: '某剧集简介',
    directors: ['某导演'],
    cast: ['某演员'],
    screenwriters: [],
    genres: ['剧情'],
    countries: ['中国大陆'],
    languages: ['普通话'],
    celebrities: [],
    recommendations: [],
    actors: [],
    ...overrides,
  }
}

describe('DoubanService.confirmSubject — manual episodes 写入', () => {
  let service: DoubanService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue({
      id: VIDEO_ID, catalog_id: CATALOG_ID, title: '某剧集', year: 2024, meta_quality: {},
    } as never)
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue({
      id: CATALOG_ID, title: '某剧集', year: 2024, doubanId: SUBJECT_ID,
      rating: 8.0, country: '中国大陆',
    } as never)
    service = new DoubanService({} as never)
  })

  it('detail.episodes=24 → updateVideoEpisodes(manual) 同时写 total + current', async () => {
    vi.mocked(getDoubanDetailRich).mockResolvedValue(makeDetail({ episodes: 24 }) as never)

    const result = await service.confirmSubject(VIDEO_ID, SUBJECT_ID)

    expect(result).toEqual({ updated: true })
    expect(videoQueries.updateVideoEpisodes).toHaveBeenCalledWith(
      expect.anything(), VIDEO_ID, { totalEpisodes: 24, currentEpisodes: 24 }, 'manual',
    )
  })

  it('detail.episodes 缺失 → 不调用 updateVideoEpisodes（防 NULL/0 写入）', async () => {
    vi.mocked(getDoubanDetailRich).mockResolvedValue(makeDetail() as never)

    await service.confirmSubject(VIDEO_ID, SUBJECT_ID)

    expect(videoQueries.updateVideoEpisodes).not.toHaveBeenCalled()
  })
})

describe('DoubanService.confirmFields — Y2 fields 含 episodes', () => {
  let service: DoubanService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValue({
      id: VIDEO_ID, catalog_id: CATALOG_ID, title: '某剧集', year: 2024, meta_quality: {},
    } as never)
    vi.mocked(catalogQueries.findCatalogById).mockResolvedValue({
      id: CATALOG_ID, title: '某剧集', year: 2024, doubanId: SUBJECT_ID,
    } as never)
    // confirmFields 走 localEntry=null → 触发网络 fallback (detail.episodes 可用)
    vi.mocked(externalDataQueries.findDoubanEntryById).mockResolvedValue(null)
    service = new DoubanService({} as never)
  })

  it('fields 含 "episodes" + detail.episodes=12 → updateVideoEpisodes(manual)', async () => {
    vi.mocked(getDoubanDetailRich).mockResolvedValue(makeDetail({ episodes: 12 }) as never)

    const result = await service.confirmFields(VIDEO_ID, SUBJECT_ID, ['title', 'episodes'])

    expect(result).toEqual({ updated: true })
    expect(videoQueries.updateVideoEpisodes).toHaveBeenCalledWith(
      expect.anything(), VIDEO_ID, { totalEpisodes: 12, currentEpisodes: 12 }, 'manual',
    )
  })

  it('fields 不含 "episodes" → 不调用 updateVideoEpisodes（仅写 catalog 字段）', async () => {
    vi.mocked(getDoubanDetailRich).mockResolvedValue(makeDetail({ episodes: 12 }) as never)

    await service.confirmFields(VIDEO_ID, SUBJECT_ID, ['title', 'rating'])

    expect(videoQueries.updateVideoEpisodes).not.toHaveBeenCalled()
  })

  it('localEntry 命中（本地 dump）+ fields 含 "episodes" → 跳过（A3 advisory：dump 无 episodes 真源）', async () => {
    vi.mocked(externalDataQueries.findDoubanEntryById).mockResolvedValue({
      doubanId: SUBJECT_ID, title: '某剧集', year: 2024, rating: 8.0,
      description: '...', coverUrl: 'p.jpg', directors: [], cast: [], writers: [],
      genres: [], country: '中国大陆', aliases: [], imdbId: null, languages: [],
      durationMinutes: null, tags: [], doubanVotes: null, regions: [],
      releaseDate: null, actorIds: [], directorIds: [], officialSite: null,
    } as never)

    await service.confirmFields(VIDEO_ID, SUBJECT_ID, ['title', 'episodes'])

    expect(videoQueries.updateVideoEpisodes).not.toHaveBeenCalled()
    // 网络 fallback 也不应被触发
    expect(getDoubanDetailRich).not.toHaveBeenCalled()
  })
})
