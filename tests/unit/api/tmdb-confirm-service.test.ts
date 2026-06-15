/**
 * tests/unit/api/tmdb-confirm-service.test.ts — TmdbConfirmService + mapTmdbGenres（ADR-202 / META-39-A）
 *
 * 覆盖：mapTmdbGenres（id 映射 / 去重 / null 跳过）/ search（候选映射 / 空 query）/
 *       confirm（movie→exact / tv-season→exact / tv-show→candidate / exact·kind 冲突 ROLLBACK /
 *       detail null / fields=[] 仅绑 ID / imdb fill-if-empty / 多语言核心标量映射）/ reject。
 * mock lib/tmdb + 写侧原语 + safeUpdate + db.connect，断言事务编排与字段映射。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import { TmdbConfirmService } from '@/api/services/TmdbConfirmService'
import { mapTmdbGenres } from '@/api/lib/genreMapper'
import * as tmdbLib from '@/api/lib/tmdb'
import * as catalogRefs from '@/api/db/queries/catalogExternalRefs'
import * as externalData from '@/api/db/queries/externalData'

vi.mock('@/api/lib/tmdb', () => ({
  searchMovie: vi.fn(), searchTv: vi.fn(), getMovieDetail: vi.fn(), getTvDetail: vi.fn(),
  // META-43：confirm 图片应用经 getImageBaseUrl 拉 configuration base（mock 返稳定 base）
  getImageBaseUrl: vi.fn(async () => 'https://image.tmdb.org/t/p/'),
  TMDB_IMAGE_BASE_FALLBACK: 'https://image.tmdb.org/t/p/',
}))
vi.mock('@/api/services/tmdb-config', () => ({ loadTmdbClientConfig: vi.fn(async () => ({ readAccessToken: 'x' })) }))
vi.mock('@/api/db/queries/catalogExternalRefs', () => ({ resolveAndWriteExactRef: vi.fn(), insertCandidateRef: vi.fn(async () => true) }))
vi.mock('@/api/db/queries/externalData', () => ({ upsertVideoExternalRef: vi.fn(async () => undefined) }))
const safeUpdateMock = vi.fn(
  async (_catalogId: string, _fields: Record<string, unknown>, _source: string, _ctx: unknown) =>
    ({ updated: true, skippedFields: [] as string[] }),
)
vi.mock('@/api/services/MediaCatalogService', () => ({ MediaCatalogService: vi.fn(() => ({ safeUpdate: safeUpdateMock })) }))

const clientQuery = vi.fn(async () => ({ rows: [] }))
const client = { query: clientQuery, release: vi.fn() }
const db = { connect: vi.fn(async () => client) } as unknown as Pool
const svc = new TmdbConfirmService(db)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOVIE: any = {
  id: 129, title: '千与千寻', original_title: '千と千尋', original_language: 'ja',
  overview: '小女孩千寻被困在精灵世界', genres: [{ id: 16, name: '动画' }, { id: 14, name: '奇幻' }],
  vote_average: 8.5, poster_path: '/p.jpg', external_ids: { imdb_id: 'tt0245429' },
}

// META-43 图片 fixture：posters 含 en（高 vote）+ zh（低 vote）→ 验证语言优先级压过 vote
const IMAGES = {
  posters: [
    { file_path: '/en.jpg', width: 500, height: 750, aspect_ratio: 0.667, vote_average: 9.0, vote_count: 99, iso_639_1: 'en' },
    { file_path: '/zh.jpg', width: 600, height: 900, aspect_ratio: 0.667, vote_average: 4.0, vote_count: 8, iso_639_1: 'zh' },
  ],
  backdrops: [
    { file_path: '/bd.jpg', width: 1920, height: 1080, aspect_ratio: 1.778, vote_average: 7.0, vote_count: 20, iso_639_1: null },
  ],
  logos: [
    { file_path: '/logo.png', width: 800, height: 300, aspect_ratio: 2.667, vote_average: 6.0, vote_count: 5, iso_639_1: 'zh' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(catalogRefs.resolveAndWriteExactRef).mockResolvedValue({ outcome: 'exact_written' })
})

describe('mapTmdbGenres', () => {
  it('movie id 映射 + null 跳过（16 Animation / 18 Drama → 跳过）', () => {
    expect(mapTmdbGenres([28, 18, 878, 16])).toEqual(['action', 'sci_fi'])
  })
  it('tv 组合类目（10759→action / 10765→sci_fi）', () => {
    expect(mapTmdbGenres([10759, 10765, 16])).toEqual(['action', 'sci_fi'])
  })
  it('去重', () => {
    expect(mapTmdbGenres([28, 28, 12])).toEqual(['action', 'adventure'])
  })
})

describe('search', () => {
  it('movie：候选映射（title/year/posterUrl）', async () => {
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue({
      page: 1, total_pages: 1, total_results: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: [{ id: 129, title: '千与千寻', original_title: '千と千尋', original_language: 'ja', overview: 'x', release_date: '2001-07-20', poster_path: '/p.jpg' }] as any,
    })
    const r = await svc.search('fallback', { mediaType: 'movie' })
    expect(r.candidates[0]).toMatchObject({ tmdbId: 129, title: '千与千寻', year: '2001' })
    expect(r.candidates[0].posterUrl).toContain('/p.jpg')
  })
  it('空 query + 无 fallback → 空候选，不调 API', async () => {
    const r = await svc.search(null, { mediaType: 'movie' })
    expect(r.candidates).toEqual([])
    expect(tmdbLib.searchMovie).not.toHaveBeenCalled()
  })
})

describe('confirm', () => {
  it('movie → exact + 核心标量应用 + tmdb_id/imdb_id cache + manual_confirmed + COMMIT', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    const r = await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title', 'description', 'genres', 'original_language'] })

    expect(r).toMatchObject({ updated: true })
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalledWith(client, expect.objectContaining({ provider: 'tmdb', externalId: '129', externalKind: 'movie', source: 'manual' }))
    // 多语言核心标量：title 简中 / genres 用 id 映射（16→null,14→fantasy）/ originalLanguage 存 'ja'
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ title: '千与千寻', genres: ['fantasy'], genresRaw: ['动画', '奇幻'], originalLanguage: 'ja' }), 'tmdb', expect.objectContaining({ db: client }))
    expect(clientQuery).toHaveBeenCalledWith('UPDATE media_catalog SET tmdb_id = $1 WHERE id = $2', [129, 'cat'])
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('imdb_id IS NULL'), ['tt0245429', 'cat'])
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(client, expect.objectContaining({ provider: 'tmdb', matchStatus: 'manual_confirmed', isPrimary: true }))
    expect(clientQuery).toHaveBeenCalledWith('COMMIT')
  })

  it('tv + seasonNumber → externalKind=season', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 1429, name: '进击的巨人', original_name: '進撃の巨人', original_language: 'ja', overview: 'x', genres: [], external_ids: {} } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: [] })
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalKind: 'season', seasonNumber: 1 }))
  })

  it('tv 无 seasonNumber → externalKind=show 走 insertCandidateRef（不升 exact）', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 1429, name: 'X', original_name: 'X', original_language: 'ja', overview: '', genres: [], external_ids: {} } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', fields: [] })
    expect(catalogRefs.insertCandidateRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalKind: 'show' }))
    expect(catalogRefs.resolveAndWriteExactRef).not.toHaveBeenCalled()
  })

  it('exact_conflict → ROLLBACK + 422 reason + holderCatalogId', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    vi.mocked(catalogRefs.resolveAndWriteExactRef).mockResolvedValue({ outcome: 'conflict_candidate', holderCatalogId: 'other-cat' })
    const r = await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title'] })
    expect(r).toEqual({ updated: false, reason: 'tmdb_exact_conflict', holderCatalogId: 'other-cat' })
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK')
    expect(safeUpdateMock).not.toHaveBeenCalled()
  })

  it('kind_conflict → ROLLBACK + reason', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    vi.mocked(catalogRefs.resolveAndWriteExactRef).mockResolvedValue({ outcome: 'kind_conflict', existingKind: 'show' })
    const r = await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title'] })
    expect(r).toEqual({ updated: false, reason: 'tmdb_kind_conflict' })
  })

  it('detail null → tmdb_fetch_failed，不开事务', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(null)
    const r = await svc.confirm('vid', 'cat', { tmdbId: 99, mediaType: 'movie' })
    expect(r).toEqual({ updated: false, reason: 'tmdb_fetch_failed' })
    expect(db.connect).not.toHaveBeenCalled()
  })

  it('fields=[] → 仅绑 ID 不调 safeUpdate，仍写 cache + video ref', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    const r = await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: [] })
    expect(r).toMatchObject({ updated: true, applied: [] })
    expect(safeUpdateMock).not.toHaveBeenCalled()
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(client, expect.objectContaining({ matchStatus: 'manual_confirmed' }))
  })

  // META-42：country 应用（movie production_countries[0] / tv origin_country[0]，经 countryToIso 防御归一）
  it('movie + country 选中 → production_countries[0].iso_3166_1 经 countryToIso 写 ISO', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, production_countries: [{ iso_3166_1: 'jp', name: 'Japan' }] })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['country'] })
    // 防御性归一：小写 'jp' → 'JP'（实证 countryToIso 真被调用而非裸透传）
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ country: 'JP' }), 'tmdb', expect.objectContaining({ db: client }))
  })

  it('tv + country 选中 → origin_country[0] 经 countryToIso 写 ISO', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 1429, name: 'X', original_name: 'X', original_language: 'ja', overview: '', genres: [], origin_country: ['US'], external_ids: {} } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: ['country'] })
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ country: 'US' }), 'tmdb', expect.objectContaining({ db: client }))
  })

  it('country 选中但 production_countries 空 → 不写 country（updateFields 空 → 不调 safeUpdate，保列纯净）', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, production_countries: [] })
    const r = await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['country'] })
    expect(r).toMatchObject({ updated: true, applied: [] })
    expect(safeUpdateMock).not.toHaveBeenCalled()
  })

  // META-43：图片应用（poster/backdrop/logo 经 images append 选最佳 + 重置 status='pending_review' 触发治理 sweep）
  it('cover_url 选中 → images.posters 选 zh 海报（语言优先压过 en 高 vote）+ source=tmdb + status + 尺寸', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, images: IMAGES })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['cover_url'] })
    expect(tmdbLib.getImageBaseUrl).toHaveBeenCalled()
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({
      coverUrl: 'https://image.tmdb.org/t/p/w500/zh.jpg', // zh（vote 4）压过 en（vote 9）
      posterStatus: 'pending_review', posterSource: 'tmdb', posterWidth: 600, posterHeight: 900,
    }), 'tmdb', expect.objectContaining({ db: client }))
  })

  it('cover_url 选中但无 images → 回退 detail.poster_path（仍写 source=tmdb + status）', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE) // 无 images 字段
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['cover_url'] })
    const applied = safeUpdateMock.mock.calls[0][1] as Record<string, unknown>
    expect(applied.coverUrl).toBe('https://image.tmdb.org/t/p/w500/p.jpg')
    expect(applied.posterSource).toBe('tmdb')
    expect(applied.posterStatus).toBe('pending_review')
    expect(applied.posterWidth).toBeUndefined() // 回退路径无 best image → 不写尺寸
  })

  it('backdrop + logo 选中 → 各写 url（base+size+path）+ status，无 source 列', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 1429, name: 'X', original_name: 'X', original_language: 'ja', overview: '', genres: [], external_ids: {}, images: IMAGES } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: ['backdrop', 'logo'] })
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/bd.jpg', backdropStatus: 'pending_review',
      logoUrl: 'https://image.tmdb.org/t/p/w500/logo.png', logoStatus: 'pending_review',
    }), 'tmdb', expect.anything())
  })

  it('无图片字段选中 → 不拉 image base configuration（避免无谓请求）', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title'] })
    expect(tmdbLib.getImageBaseUrl).not.toHaveBeenCalled()
  })
})

describe('reject', () => {
  it('video_external_refs → rejected', async () => {
    const r = await svc.reject('vid', 129)
    expect(r).toEqual({ rejected: true })
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(db, expect.objectContaining({ provider: 'tmdb', externalId: '129', matchStatus: 'rejected', isPrimary: false }))
  })
})
