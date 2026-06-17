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
import { TmdbConfirmService, pickBestTmdbCandidate, type TmdbCandidate } from '@/api/services/TmdbConfirmService'
import { mapTmdbGenres } from '@/api/lib/genreMapper'
import * as tmdbLib from '@/api/lib/tmdb'
import * as catalogRefs from '@/api/db/queries/catalogExternalRefs'
import * as externalData from '@/api/db/queries/externalData'

vi.mock('@/api/lib/tmdb', () => ({
  searchMovie: vi.fn(), searchTv: vi.fn(), getMovieDetail: vi.fn(), getTvDetail: vi.fn(),
  // ADR-207 D-207-3：季级路径拉 /tv/{id}/season/{n}（逐集 + 季海报）
  getTvSeasonDetail: vi.fn(),
  // META-43：confirm 图片应用经 getImageBaseUrl 拉 configuration base（mock 返稳定 base）
  getImageBaseUrl: vi.fn(async () => 'https://image.tmdb.org/t/p/'),
  TMDB_IMAGE_BASE_FALLBACK: 'https://image.tmdb.org/t/p/',
}))
vi.mock('@/api/services/tmdb-config', () => ({ loadTmdbClientConfig: vi.fn(async () => ({ readAccessToken: 'x' })) }))
import { loadTmdbClientConfig } from '@/api/services/tmdb-config'
vi.mock('@/api/db/queries/catalogExternalRefs', () => ({ resolveAndWriteExactRef: vi.fn(), insertCandidateRef: vi.fn(async () => true) }))
vi.mock('@/api/db/queries/externalData', () => ({ upsertVideoExternalRef: vi.fn(async () => undefined) }))
// ADR-207 D-207-7：季级逐集 upsert（source='tmdb'）
vi.mock('@/api/db/queries/catalogEpisodes', () => ({ upsertCatalogEpisodes: vi.fn(async () => 0) }))
import * as catalogEpisodes from '@/api/db/queries/catalogEpisodes'
const safeUpdateMock = vi.fn(
  async (_catalogId: string, _fields: Record<string, unknown>, _source: string, _ctx: unknown) =>
    ({ updated: true, skippedFields: [] as string[] }),
)
// CATALOG_SOURCE_PRIORITY 真值同源（META-48 filterCrossValidation 消费）
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn(() => ({ safeUpdate: safeUpdateMock })),
  CATALOG_SOURCE_PRIORITY: { manual: 5, tmdb: 4, bangumi: 4, douban: 3, crawler: 1 },
}))
// META-44-B：confirm 在选中 genres 时读 catalog 现值做 type 富集修正（ADR-203）
vi.mock('@/api/db/queries/mediaCatalog', () => ({ findCatalogById: vi.fn(async () => ({ type: 'other' })) }))
import { findCatalogById } from '@/api/db/queries/mediaCatalog'
// META-50-1B：autoMatch 内 loadKnownNames → listCatalogAliases（默认空，多词测试按需覆盖 findCatalogById/别名）
vi.mock('@/api/db/queries/catalogAliases', () => ({ listCatalogAliases: vi.fn(async () => []) }))
import { listCatalogAliases } from '@/api/db/queries/catalogAliases'
// META-50-2A-2 前置：confirm 应用 title/title_original 后重算 blocking 键（mock 断言调用，不实跑）
vi.mock('@/api/services/metadata/catalogBlockingKeys', () => ({ recomputeCatalogBlockingKeys: vi.fn(async () => undefined) }))
import { recomputeCatalogBlockingKeys } from '@/api/services/metadata/catalogBlockingKeys'

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
  it('单值回归 + null 回归（结构改造不破坏单值/null 路径，ADR-204 D-204-1）', () => {
    expect(mapTmdbGenres([35])).toEqual(['comedy'])
    expect(mapTmdbGenres([18, 16, 99])).toEqual([]) // drama/animation/documentary 仍 null
  })
  // ADR-204 D-204-1：组合类目拆双 genre
  it('10759 Action&Adventure → [action, adventure]（拆双）', () => {
    expect(mapTmdbGenres([10759])).toEqual(['action', 'adventure'])
  })
  it('10765 Sci-Fi&Fantasy → [sci_fi, fantasy]（拆双）', () => {
    expect(mapTmdbGenres([10765])).toEqual(['sci_fi', 'fantasy'])
  })
  it('10768 War&Politics → [war]（politics 无 genre，保单值）', () => {
    expect(mapTmdbGenres([10768])).toEqual(['war'])
  })
  it('拆双后 Set 去重：28(action)+10759 不重复 action / 10759+12(adventure) 不重复 adventure', () => {
    expect(mapTmdbGenres([28, 10759])).toEqual(['action', 'adventure'])
    expect(mapTmdbGenres([10759, 12])).toEqual(['action', 'adventure'])
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
    // META-50-2A-2 前置：title 应用 → COMMIT 后重算 blocking 键（fire-and-forget）
    await Promise.resolve()
    expect(recomputeCatalogBlockingKeys).toHaveBeenCalledWith(db, 'cat')
  })

  it('META-50-2A-2：fields 不含 title/title_original（仅 genres）→ 不触发 blocking 键重算', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['genres'] })
    await Promise.resolve()
    expect(recomputeCatalogBlockingKeys).not.toHaveBeenCalled()
  })

  it('tv + seasonNumber + seasons[] 命中 → season exact external_id=季自身 id（D-207-2）+ 不写 cache（D-207-6）+ video ref 季 id', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({
      id: 1429, name: '进击的巨人', original_name: '進撃の巨人', original_language: 'ja', overview: 'x', genres: [], external_ids: { imdb_id: 'tt1' },
      seasons: [{ id: 60001, season_number: 1, name: 'Season 1', overview: '', poster_path: null, air_date: '2013-04-07', episode_count: 25, vote_average: 8 }],
    } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: [] })
    // external_id = 季自身 id 60001（绝非 show id 1429，D-207-2）
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalId: '60001', externalKind: 'season', seasonNumber: 1 }))
    // D-207-6：季 catalog 不写 tmdb_id/imdb_id cache（无裸 UPDATE media_catalog SET tmdb_id）
    const cacheCall = clientQuery.mock.calls.find((c) => typeof c[0] === 'string' && c[0].includes('SET tmdb_id'))
    expect(cacheCall).toBeUndefined()
    // video ref 写季 id 60001（不同季 video 不跨季过并）
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalId: '60001', matchStatus: 'manual_confirmed' }))
  })

  it('tv + seasonNumber 但 seasons[] 未命中季 → 降级 show candidate（D-207-10 level ①），不升 exact', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({
      id: 1429, name: 'X', original_name: 'X', original_language: 'ja', overview: '', genres: [], external_ids: {},
      seasons: [{ id: 60002, season_number: 2, name: 'S2', overview: '', poster_path: null, air_date: null, episode_count: 12, vote_average: 0 }],
    } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: [] }) // 请求 S1，mock 仅 S2
    expect(catalogRefs.insertCandidateRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalKind: 'show', externalId: '1429' }))
    expect(catalogRefs.resolveAndWriteExactRef).not.toHaveBeenCalled()
  })

  it('季路径剔标题三件套（D-207-5）：选 title 也不写 title（季名噪声不覆盖 catalog 标题），description 仍写', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({
      id: 1429, name: 'Season 1', original_name: 'Season 1', original_language: 'ja', overview: 'x', genres: [], external_ids: {},
      seasons: [{ id: 60001, season_number: 1, name: 'Season 1', overview: '', poster_path: null, air_date: null, episode_count: 25, vote_average: 8 }],
    } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: ['title', 'description'] })
    const arg = safeUpdateMock.mock.calls[0]?.[1] as Record<string, unknown> | undefined
    expect(arg?.title).toBeUndefined() // title 被剔除（季路径）
    expect(arg?.description).toBe('x') // 非标题三件套，仍可写（季简介空 → 回退 show 简介）
  })

  // review P1-2：confirm 季级写**季级**字段（简介/海报来自季 summary，非整剧），尊重 moderator 选的 fields
  it('confirm 季级 description 取季简介（≠ 整剧简介）+ cover 取季海报（buildSeasonCatalogFields）', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({
      id: 1429, name: '进击的巨人', original_name: '進撃の巨人', original_language: 'ja', overview: '整剧简介', genres: [], external_ids: {}, poster_path: '/show.jpg',
      seasons: [{ id: 60001, season_number: 1, name: 'S1', overview: '第一季简介', poster_path: '/s1.jpg', air_date: null, episode_count: 25, vote_average: 8 }],
    } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: ['description', 'cover_url'] })
    const arg = safeUpdateMock.mock.calls[0]?.[1] as Record<string, unknown> | undefined
    expect(arg?.description).toBe('第一季简介') // 季简介（非「整剧简介」）
    expect(arg?.coverUrl).toBe('https://image.tmdb.org/t/p/w500/s1.jpg') // 季海报（非 show /show.jpg）
    expect(arg?.posterSource).toBe('tmdb')
    // review（Codex）：季级 provenance sourceRef 用 season id 60001（非 show id 1429）
    expect(safeUpdateMock.mock.calls[0]?.[3]).toMatchObject({ sourceRef: '60001' })
  })

  it('confirm 季级未选某字段 → 不写（尊重 moderator fields opt-in）', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({
      id: 1429, name: 'X', original_name: 'X', original_language: 'ja', overview: '整剧简介', genres: [{ id: 16, name: '动画' }], external_ids: {}, poster_path: '/show.jpg',
      seasons: [{ id: 60001, season_number: 1, name: 'S1', overview: '第一季简介', poster_path: '/s1.jpg', air_date: null, episode_count: 25, vote_average: 8 }],
    } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', seasonNumber: 1, fields: ['description'] }) // 仅选 description
    const arg = safeUpdateMock.mock.calls[0]?.[1] as Record<string, unknown> | undefined
    expect(arg?.description).toBe('第一季简介')
    expect(arg?.coverUrl).toBeUndefined() // 未选 cover_url → 不写
    expect(arg?.genres).toBeUndefined() // 未选 genres → 不写
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

  // META-44-B：type 富集修正（ADR-203，随 genres opt-in；fill-if-default 仅 other→具体）
  it("genres 选中 + catalog type='other' + tv anime genre → updateFields.type='anime'", async () => {
    vi.mocked(findCatalogById).mockResolvedValue({ type: 'other' } as never)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 1, name: 'X', original_name: 'X', original_language: 'ja', overview: '', genres: [{ id: 16, name: '动画' }], external_ids: {} } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1, mediaType: 'tv', seasonNumber: 1, fields: ['genres'] })
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ type: 'anime' }), 'tmdb', expect.anything())
  })

  it('catalog type 为具体值（series）→ 不写 type（绝不覆盖具体 type）', async () => {
    vi.mocked(findCatalogById).mockResolvedValue({ type: 'series' } as never)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 1, name: 'X', original_name: 'X', original_language: 'ja', overview: '', genres: [{ id: 16, name: '动画' }], external_ids: {} } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1, mediaType: 'tv', seasonNumber: 1, fields: ['genres'] })
    const arg = safeUpdateMock.mock.calls[0][1]
    expect(arg.type).toBeUndefined()
  })

  it('未选 genres → 不读 catalog、不写 type（尊重 opt-in / fields=[] 仅绑 ID）', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title'] })
    expect(findCatalogById).not.toHaveBeenCalled()
  })
})

describe('reject', () => {
  it('video_external_refs → rejected', async () => {
    const r = await svc.reject('vid', 129)
    expect(r).toEqual({ rejected: true })
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(db, expect.objectContaining({ provider: 'tmdb', externalId: '129', matchStatus: 'rejected', isPrimary: false }))
  })
})

// ── META-47：auto 候选打分 + auto 专用方法（ADR-205 D-205-7）──────────────
// 打分用纯 ASCII 串精确控制 bigram Jaccard 分值：'abcdef'≡'abcdef'=1.0 / 'abcdef'~'abcdeg'=0.8（candidate
// 档）/ 'abcdefghij'~'abcdefxyzw'≈0.556（召回但<0.60）/ 'abcdef'~'zzzzzz'=0（<0.45 不召回）。

function cand(over: Partial<TmdbCandidate>): TmdbCandidate {
  return { tmdbId: 1, mediaType: 'movie', title: '', originalTitle: '', originalLanguage: 'en', year: null, overview: '', posterUrl: null, ...over }
}

describe('pickBestTmdbCandidate', () => {
  it('完全同名 + 同年 → score 1.0（标题 1 + 年份 +0.2 封顶）', () => {
    const r = pickBestTmdbCandidate('abcdef', 2023, [cand({ tmdbId: 7, title: 'abcdef', originalTitle: 'abcdef', year: '2023' })])
    expect(r).toMatchObject({ candidate: { tmdbId: 7 }, score: 1 })
  })
  it('多候选取最高分（abcdeg=0.8 胜出）', () => {
    const r = pickBestTmdbCandidate('abcdef', null, [
      cand({ tmdbId: 1, title: 'zzzzzz' }),
      cand({ tmdbId: 2, title: 'abcdeg' }),
      cand({ tmdbId: 3, title: 'abcxyz' }),
    ])
    expect(r?.candidate.tmdbId).toBe(2)
  })
  it('originalTitle 命中也算（title/originalTitle 取 max）', () => {
    const r = pickBestTmdbCandidate('abcdef', null, [cand({ tmdbId: 9, title: 'zzz', originalTitle: 'abcdef' })])
    expect(r?.score).toBe(1)
  })
  it('相邻年 +0.1 / 同年 +0.2（年份加权差异；base=0.8 来自 abcdef~abcdeg）', () => {
    const same = pickBestTmdbCandidate('abcdef', 2023, [cand({ title: 'abcdeg', year: '2023' })])
    const adj = pickBestTmdbCandidate('abcdef', 2023, [cand({ title: 'abcdeg', year: '2022' })])
    expect(same?.score).toBeCloseTo(1.0) // 0.8 + 0.2（封顶）
    expect(adj?.score).toBeCloseTo(0.9) // 0.8 + 0.1
  })
  it('最高分 < 0.45 → null（兜底阈值）', () => {
    expect(pickBestTmdbCandidate('abcdef', null, [cand({ title: 'zzzzzz' })])).toBeNull()
  })
  it('空候选 → null', () => {
    expect(pickBestTmdbCandidate('abcdef', 2023, [])).toBeNull()
  })
  // META-50-1B：多 target 数组入参（D-206-3）——跨 target 取 max
  it('多 target 数组：首 target 不匹配、次 target（原名）命中 → max 取高分', () => {
    const r = pickBestTmdbCandidate(['海贼王', 'ONE PIECE'], null, [
      cand({ tmdbId: 21, title: 'One Piece', originalTitle: 'ONE PIECE' }),
    ])
    expect(r).toMatchObject({ candidate: { tmdbId: 21 } })
    expect(r?.score).toBeCloseTo(1.0) // 'ONE PIECE' target ~ originalTitle 'ONE PIECE'
  })
  it('多 target 全不匹配 → null（兜底阈值不放宽）', () => {
    expect(pickBestTmdbCandidate(['海贼王', '航海王'], null, [cand({ title: 'zzzzzz', originalTitle: 'zzzzzz' })])).toBeNull()
  })
})

describe('autoMatch', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = (items: any[]) => ({ page: 1, total_pages: 1, total_results: items.length, results: items })
  const movieItem = (over: Record<string, unknown> = {}) => ({
    id: 555, title: 'abcdef', original_title: 'abcdef', original_language: 'en', overview: 'x', release_date: '2023-01-01', poster_path: '/p.jpg', ...over,
  })

  it('auto_matched（score≥0.85）→ exact ref(auto) + safeUpdate(含 tmdbId/imdb) + video ref auto_matched + COMMIT', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem()]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, id: 555 } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    expect(r).toMatchObject({ matched: true, tier: 'auto_matched', tmdbId: 555, confidence: 1 })
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalledWith(client, expect.objectContaining({ provider: 'tmdb', externalId: '555', externalKind: 'movie', source: 'auto', linkedBy: 'auto' }))
    // M4：tmdbId/imdbId 经 safeUpdate（fill-if-empty 白名单），非裸 UPDATE（区别 confirm:259/260）
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ tmdbId: 555, imdbId: 'tt0245429' }), 'tmdb', expect.objectContaining({ db: client }))
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(client, expect.objectContaining({ matchStatus: 'auto_matched', matchMethod: 'auto', isPrimary: true, linkedBy: 'auto', confidence: 1 }))
    expect(clientQuery).toHaveBeenCalledWith('COMMIT')
  })

  it('candidate（0.60≤score<0.85）→ candidate ref(auto)，不拉 detail/不应用字段，video ref candidate', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem({ title: 'abcdeg', original_title: 'abcdeg', release_date: null })]) as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: null, mediaType: 'movie' })
    expect(r).toMatchObject({ matched: true, tier: 'candidate' })
    expect(catalogRefs.insertCandidateRef).toHaveBeenCalledWith(client, expect.objectContaining({ provider: 'tmdb', source: 'auto', linkedBy: 'auto' }))
    expect(catalogRefs.resolveAndWriteExactRef).not.toHaveBeenCalled()
    expect(tmdbLib.getMovieDetail).not.toHaveBeenCalled()
    expect(safeUpdateMock).not.toHaveBeenCalled()
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(client, expect.objectContaining({ matchStatus: 'candidate', isPrimary: false }))
  })

  it('召回但 score<0.60（≈0.556）→ no_candidate，不开事务', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem({ title: 'abcdefxyzw', original_title: 'abcdefxyzw', release_date: null })]) as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdefghij', year: null, mediaType: 'movie' })
    expect(r).toEqual({ matched: false, reason: 'no_candidate' })
    expect(db.connect).not.toHaveBeenCalled()
  })

  it('无合格候选（score<0.45）→ no_candidate', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem({ title: 'zzzzzz', original_title: 'zzzzzz', release_date: null })]) as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: null, mediaType: 'movie' })
    expect(r).toEqual({ matched: false, reason: 'no_candidate' })
  })

  it('凭证缺失（无 token/key）→ no_credentials，不调 search（graceful skip）', async () => {
    vi.mocked(loadTmdbClientConfig).mockResolvedValueOnce({})
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    expect(r).toEqual({ matched: false, reason: 'no_credentials' })
    expect(tmdbLib.searchMovie).not.toHaveBeenCalled()
  })

  it('search 抛错（限流/网络）→ tmdb_unavailable，不抛', async () => {
    vi.mocked(tmdbLib.searchMovie).mockRejectedValue(new Error('429'))
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    expect(r).toEqual({ matched: false, reason: 'tmdb_unavailable' })
  })

  it('auto_matched movie 但 exact 冲突 → ROLLBACK + tmdb_exact_conflict + holderCatalogId，不写 cache/safeUpdate', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem()]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, id: 555 } as any)
    vi.mocked(catalogRefs.resolveAndWriteExactRef).mockResolvedValue({ outcome: 'conflict_candidate', holderCatalogId: 'other' })
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    expect(r).toEqual({ matched: false, reason: 'tmdb_exact_conflict', holderCatalogId: 'other' })
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK')
    expect(safeUpdateMock).not.toHaveBeenCalled()
  })

  it('auto_matched tv 无 season → insertCandidateRef(show) 仍应用字段 + video ref auto_matched（D-202-1）', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchTv).mockResolvedValue(search([{ id: 99, name: 'abcdef', original_name: 'abcdef', original_language: 'ja', overview: 'x', first_air_date: '2023-01-01', poster_path: '/p.jpg' }]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 99, name: 'abcdef', original_name: 'abcdef', original_language: 'ja', overview: 'x', genres: [], external_ids: {} } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'tv' })
    expect(r).toMatchObject({ matched: true, tier: 'auto_matched' })
    expect(catalogRefs.insertCandidateRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalKind: 'show', source: 'auto' }))
    expect(catalogRefs.resolveAndWriteExactRef).not.toHaveBeenCalled()
    expect(safeUpdateMock).toHaveBeenCalled()
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(client, expect.objectContaining({ matchStatus: 'auto_matched', isPrimary: true }))
  })

  // ── META-49-B2：interim 交叉验证退场——autoMatch 不再按 current 源过滤内容，全量上抛交 reconcile 加权 ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catalogWith = (over: Record<string, unknown>): any => ({
    type: 'series', metadataSource: 'bangumi', title: null, titleOriginal: null, originalLanguage: null,
    description: null, genres: [], genresRaw: [], country: null, rating: null, coverUrl: null, backdropUrl: null, logoUrl: null, ...over,
  })

  it('current=bangumi(同级) 已有 title/genres → 内容仍全量进 proposedFields（不再 interim 过滤，交 reconcile）+ 身份 safeUpdate 固定 preserveMetadataSource=true', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(catalogWith({ metadataSource: 'bangumi', title: 'B 标题', genres: ['g'], description: null }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem()]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, id: 555 } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    expect(r).toMatchObject({ matched: true, tier: 'auto_matched' })
    // B2：filterCrossValidation 退场——内容字段不再按 current 源剔除，全量上抛 proposedFields（bangumi vs
    // tmdb winner 由 reconcile 加权裁决，不在 autoMatch 内提前过滤）。
    const proposed = (r.matched ? r.proposedFields : undefined) ?? {}
    expect(proposed.title).toBe('千与千寻') // 不再剔除（即便 current=bangumi 已有 title）
    expect(proposed.genres).toEqual(['fantasy']) // 不再剔除（16→null/14→fantasy）
    expect(proposed.description).toBe('小女孩千寻被困在精灵世界')
    // 身份 tmdbId/imdb 留 autoMatch 事务内写；preserveMetadataSource 固定 true（cache/type 不接管内容来源）
    const idArg = safeUpdateMock.mock.calls[0][1] as Record<string, unknown>
    expect(idArg.tmdbId).toBe(555) // ref/cache 身份仍写（留事务）
    expect(idArg.title).toBeUndefined() // 内容已剥离到 proposedFields
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalled()
    const ctx = safeUpdateMock.mock.calls[0][3] as Record<string, unknown>
    expect(ctx.preserveMetadataSource).toBe(true) // 身份/cache 写入固定不翻 metadata_source（reconcile winner 定来源）
    // B2：autoMatch 不再透传 preserveMetadataSource（reconcile winner 自裁 source）
    expect('preserveMetadataSource' in r).toBe(false)
  })

  it('current=douban(低于 tmdb) → 内容同样全量进 proposedFields（退场源无关）+ 身份 safeUpdate 固定 preserveMetadataSource=true', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(catalogWith({ metadataSource: 'douban', title: 'D 标题', genres: ['g'], description: 'D 简介' }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem()]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, id: 555 } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    const proposed = (r.matched ? r.proposedFields : undefined) ?? {}
    expect(proposed.title).toBe('千与千寻')
    expect(proposed.description).toBe('小女孩千寻被困在精灵世界')
    const ctx = safeUpdateMock.mock.calls[0][3] as Record<string, unknown>
    expect(ctx.preserveMetadataSource).toBe(true) // 退场后固定 true，与 current 源无关
    expect('preserveMetadataSource' in r).toBe(false)
  })

  it('B1 cache/type retained：身份(tmdbId/imdbId/type)留事务 safeUpdate、内容进 proposedFields（不丢 cache/type）', async () => {
    // type='other' → tmdb movie 信号可写 type（ADR-203 fill-if-default）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findCatalogById).mockResolvedValue({ type: 'other' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem()]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, id: 555 } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    expect(r.matched).toBe(true)
    // 身份 safeUpdate（留事务）含 tmdbId/imdbId/type，不含内容字段
    const idArg = safeUpdateMock.mock.calls[0][1] as Record<string, unknown>
    expect(idArg.tmdbId).toBe(555)
    expect(idArg.imdbId).toBe('tt0245429')
    expect(idArg.type).toBe('movie') // ADR-203 type 留 autoMatch 内写（retained）
    expect(idArg.title).toBeUndefined()
    // 内容进 proposedFields，不含身份/type（cache/type retained 在身份 safeUpdate）
    const proposed = (r.matched ? r.proposedFields : undefined) ?? {}
    expect(proposed.title).toBe('千与千寻')
    expect(proposed.tmdbId).toBeUndefined()
    expect(proposed.imdbId).toBeUndefined()
    expect(proposed.type).toBeUndefined()
  })

  // ── META-50-1B：knownNames 驱动多词检索（D-206-2/3）——海贼王/航海王 跨译名修复 ──
  it('多词检索：title_original 优先检索命中 + 逐词早停（searchTv 首发原名、仅 1 次、不发中文标题）', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(
      catalogWith({ title: '航海王', titleOriginal: 'ONE PIECE', originalLanguage: 'en', type: 'series' }),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchTv).mockResolvedValue(
      search([{ id: 7, name: 'One Piece', original_name: 'ONE PIECE', original_language: 'ja', overview: 'x', first_air_date: '1999-10-20', poster_path: '/p.jpg' }]) as any,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 7, name: 'One Piece', original_name: 'ONE PIECE', original_language: 'ja', overview: 'x', genres: [], external_ids: {} } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: '航海王', year: 1999, mediaType: 'tv' })
    expect(r).toMatchObject({ matched: true, tmdbId: 7 })
    // title_original='ONE PIECE' 作首词（D-206-2 优先级序）命中即早停 → searchTv 仅 1 次、未发中文 '航海王'
    expect(tmdbLib.searchTv).toHaveBeenCalledTimes(1)
    expect(vi.mocked(tmdbLib.searchTv).mock.calls[0][0]).toBe('ONE PIECE')
  })

  it('逐词早停不命中则发后续词 + 候选 by tmdbId 去重（首词分低续发、跨词合并选最佳 id=2）', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(
      catalogWith({ title: '航海王', titleOriginal: 'ONE PIECE', originalLanguage: 'en', type: 'series' }),
    )
    vi.mocked(tmdbLib.searchTv)
      // term1='ONE PIECE' → 无关候选 id=1（分低不早停）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(search([{ id: 1, name: 'Unrelated', original_name: 'Unrelated', original_language: 'en', overview: '', first_air_date: null, poster_path: null }]) as any)
      // term2='航海王' → 重复 id=1（去重保首条）+ 命中 id=2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(search([
        { id: 1, name: 'Dup', original_name: 'Dup', original_language: 'en', overview: '', first_air_date: null, poster_path: null },
        { id: 2, name: 'One Piece', original_name: 'ONE PIECE', original_language: 'ja', overview: 'x', first_air_date: null, poster_path: '/p.jpg' },
      ]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 2, name: 'One Piece', original_name: 'ONE PIECE', original_language: 'ja', overview: 'x', genres: [], external_ids: {} } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: '航海王', year: null, mediaType: 'tv' })
    expect(r).toMatchObject({ matched: true, tmdbId: 2 })
    expect(tmdbLib.searchTv).toHaveBeenCalledTimes(2) // term1 分低 → 未早停 → 发 term2
  })

  it('catalog 无别名/无 title_original → knownNames 仅视频标题兜底（行为等价 META-47 单词检索）', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(catalogWith({ title: null, titleOriginal: null }))
    vi.mocked(listCatalogAliases).mockResolvedValueOnce([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([movieItem()]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, id: 555 } as any)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2023, mediaType: 'movie' })
    expect(r).toMatchObject({ matched: true, tmdbId: 555 })
    expect(tmdbLib.searchMovie).toHaveBeenCalledTimes(1)
    expect(vi.mocked(tmdbLib.searchMovie).mock.calls[0][0]).toBe('abcdef') // 兜底视频标题
  })
})

// ADR-207 D-207-2/3/4/5/6/7/10：autoMatch 季级路径（季解析 / season exact=季 id / 逐集 source=tmdb / 失败降级分层）
describe('autoMatch 季级路径（ADR-207）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = (items: any[]) => ({ page: 1, total_pages: 1, total_results: items.length, results: items })
  const tvItem = () => ({ id: 1399, name: 'abcdef', original_name: 'abcdef', original_language: 'en', overview: 'show overview', first_air_date: '2011-04-17', poster_path: '/show.jpg' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tvDetail = (over: Record<string, unknown> = {}): any => ({
    id: 1399, name: 'abcdef', original_name: 'abcdef', original_language: 'en', overview: 'show overview',
    genres: [{ id: 18, name: 'Drama' }], origin_country: ['US'], vote_average: 9, poster_path: '/show.jpg', external_ids: { imdb_id: 'tt0944947' },
    seasons: [
      { id: 3624, season_number: 1, name: 'Season 1', overview: 'S1 overview', poster_path: '/s1.jpg', air_date: '2011-04-17', episode_count: 10, vote_average: 8.3 },
      { id: 3625, season_number: 2, name: 'Season 2', overview: '', poster_path: '/s2.jpg', air_date: '2012-04-01', episode_count: 10, vote_average: 8.5 },
    ],
    ...over,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasonDetail = (over: Record<string, unknown> = {}): any => ({
    id: 3624, name: 'Season 1', overview: 'S1 detail overview', poster_path: '/s1.jpg', air_date: '2011-04-17', season_number: 1, vote_average: 8.3,
    episodes: [
      { id: 63056, episode_number: 1, name: 'Ep1', overview: 'e1', air_date: '2011-04-17', runtime: 62, still_path: '/e1.jpg', vote_average: 8 },
      { id: 63057, episode_number: 2, name: 'Ep2', overview: 'e2', air_date: '2011-04-24', runtime: 56, still_path: '/e2.jpg', vote_average: 8 },
    ],
    ...over,
  })

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchTv).mockResolvedValue(search([tvItem()]) as any)
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue(tvDetail())
    vi.mocked(tmdbLib.getTvSeasonDetail).mockResolvedValue(seasonDetail())
  })

  it('S1 命中 → season exact external_id=季 id 3624 + season_number=1（D-207-2）+ 不写 tmdbId/imdbId cache（D-207-6）+ video ref 季 id', async () => {
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 1 })
    expect(r).toMatchObject({ matched: true, tier: 'auto_matched', tmdbId: 1399 })
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalId: '3624', externalKind: 'season', seasonNumber: 1 }))
    const idArg = (safeUpdateMock.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>
    expect(idArg.tmdbId).toBeUndefined() // 季 catalog 不写 cache
    expect(idArg.imdbId).toBeUndefined()
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalId: '3624', matchStatus: 'auto_matched' }))
  })

  it('S1/S2 写出不同 season exact ref（external_id=各季 id，互不冲突，D-207-2）', async () => {
    await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 1 })
    vi.mocked(tmdbLib.getTvSeasonDetail).mockResolvedValue(seasonDetail({ id: 3625, season_number: 2, episodes: [] }))
    await svc.autoMatch('vid2', 'cat2', { title: 'abcdef', year: 2012, mediaType: 'tv', seasonNumber: 2 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = vi.mocked(catalogRefs.resolveAndWriteExactRef).mock.calls.map((c) => (c[1] as any).externalId)
    expect(ids).toContain('3624')
    expect(ids).toContain('3625')
  })

  it('逐集 upsert source=tmdb + ep_type=0 + externalEpisodeId=String(id) + runtime 分钟→秒（D-207-7）+ 返回 seasonEpisodeCount', async () => {
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 1 })
    expect(catalogEpisodes.upsertCatalogEpisodes).toHaveBeenCalledWith(client, 'cat', expect.arrayContaining([
      expect.objectContaining({ source: 'tmdb', externalEpisodeId: '63056', epType: 0, ep: 1, durationSeconds: 62 * 60 }),
    ]))
    expect(r.matched && r.seasonEpisodeCount).toBe(10)
  })

  it('季简介缺失（季 detail + 季摘要均空）→ description 回退 show 简介（D-207-4）', async () => {
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue(tvDetail({
      seasons: [{ id: 3624, season_number: 1, name: 'S1', overview: '', poster_path: null, air_date: '2011-04-17', episode_count: 10, vote_average: 0 }],
    }))
    vi.mocked(tmdbLib.getTvSeasonDetail).mockResolvedValue(seasonDetail({ overview: '', episodes: [] }))
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 1 })
    const proposed = (r.matched ? r.proposedFields : undefined) ?? {}
    expect(proposed.description).toBe('show overview')
  })

  it('getTvSeasonDetail 失败（null）→ 仍写 season exact，仅跳逐集（D-207-10 level ②）', async () => {
    vi.mocked(tmdbLib.getTvSeasonDetail).mockResolvedValue(null)
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 1 })
    expect(r.matched).toBe(true)
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalId: '3624', externalKind: 'season' }))
    expect(catalogEpisodes.upsertCatalogEpisodes).not.toHaveBeenCalled() // 季详情失败 → 无逐集
  })

  it('seasons[] 未命中季 → 降级 show candidate（D-207-10 level ①），不升 exact、不调 getTvSeasonDetail', async () => {
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 9 }) // 仅有 S1/S2
    expect(r.matched).toBe(true)
    expect(catalogRefs.insertCandidateRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalKind: 'show', externalId: '1399' }))
    expect(catalogRefs.resolveAndWriteExactRef).not.toHaveBeenCalled()
    expect(tmdbLib.getTvSeasonDetail).not.toHaveBeenCalled()
    // review F4：季 catalog 降级 show 也剔标题三件套（不让 show 名覆盖季 catalog 标题，与 resolved 季路径一致）
    const proposed = (r.matched ? r.proposedFields : undefined) ?? {}
    expect(proposed.title).toBeUndefined()
    expect(proposed.titleOriginal).toBeUndefined()
  })

  // review P1-1：季级搜剧不按季年份过滤（catalog.year 是季年份，非 show first_air_date_year）
  it('季级路径 searchTv 不带 year（year=2011 是季年份，传 first_air_date_year 会漏非首播季 show）', async () => {
    await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2013, mediaType: 'tv', seasonNumber: 2 })
    const opts = vi.mocked(tmdbLib.searchTv).mock.calls[0]?.[1] as Record<string, unknown> | undefined
    expect(opts?.year).toBeUndefined() // 季级路径不传 catalog 季年份
  })

  // review P2-3：provenance externalRefId 用 season id（非 show id）
  it('返回 externalRefId=season id 3624（季级 provenance 准确指向季，非 show 1399）', async () => {
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 1 })
    expect(r.matched && r.externalRefId).toBe('3624')
  })

  // review P2-4 / D-207-10：逐集 upsert 失败用 SAVEPOINT 隔离，不回滚已写 season exact，主事务仍 COMMIT
  it('逐集 upsert 失败 → ROLLBACK TO SAVEPOINT 保留 season exact + 主事务 COMMIT（D-207-10）', async () => {
    vi.mocked(catalogEpisodes.upsertCatalogEpisodes).mockRejectedValueOnce(new Error('episode db error'))
    const r = await svc.autoMatch('vid', 'cat', { title: 'abcdef', year: 2011, mediaType: 'tv', seasonNumber: 1 })
    expect(r.matched).toBe(true)
    expect(catalogRefs.resolveAndWriteExactRef).toHaveBeenCalledWith(client, expect.objectContaining({ externalId: '3624', externalKind: 'season' }))
    expect(clientQuery).toHaveBeenCalledWith('SAVEPOINT tmdb_episodes')
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT tmdb_episodes')
    expect(clientQuery).toHaveBeenCalledWith('COMMIT') // 主事务仍提交（季 exact 保留）
    expect(clientQuery).not.toHaveBeenCalledWith('ROLLBACK') // 不整事务回滚
  })
})

// ADR-207 D-207-11 / META-54-D：季级搜索词剥多语言季号后缀 + 排 romanization；movie/show 零回归
describe('autoMatch 季级搜索词剥季号（ADR-207 D-207-11）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catalogWith = (over: Record<string, unknown>): any => ({
    type: 'series', metadataSource: 'bangumi', title: null, titleOriginal: null, originalLanguage: null,
    description: null, genres: [], genresRaw: [], country: null, rating: null, coverUrl: null, backdropUrl: null, logoUrl: null, ...over,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = (items: any[]) => ({ page: 1, total_pages: 1, total_results: items.length, results: items })
  const tvItem = () => ({ id: 1399, name: 'abcdef', original_name: 'abcdef', original_language: 'en', overview: 'o', first_air_date: '2012-04-01', poster_path: '/s.jpg' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tvDetail = (): any => ({
    id: 1399, name: 'abcdef', original_name: 'abcdef', original_language: 'en', overview: 'o',
    genres: [{ id: 18, name: 'Drama' }], origin_country: ['US'], vote_average: 9, poster_path: '/s.jpg', external_ids: {},
    seasons: [{ id: 3625, season_number: 2, name: 'S2', overview: 's2', poster_path: '/s2.jpg', air_date: '2012-04-01', episode_count: 10, vote_average: 8 }],
  })

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchTv).mockResolvedValue(search([tvItem()]) as any)
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue(tvDetail())
    vi.mocked(tmdbLib.getTvSeasonDetail).mockResolvedValue(null) // 季 detail 失败仍写 season exact（不影响搜索词断言）
  })

  it('季级：title（中文第N季）+ title_original（日文第N期）后缀剥离后均用裸名搜', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(catalogWith({ title: 'abcdef 第二季', titleOriginal: 'abcdef 第2期', type: 'anime' }))
    await svc.autoMatch('vid', 'cat', { title: 'abcdef 第二季', year: 2012, mediaType: 'tv', seasonNumber: 2 })
    // 中文「第二季」+ 日文「第2期」+ fallback 均剥季号 → 归一为裸名 'abcdef'，所有 searchTv 实参 == 'abcdef'
    expect(tmdbLib.searchTv).toHaveBeenCalled()
    for (const c of vi.mocked(tmdbLib.searchTv).mock.calls) expect(c[0]).toBe('abcdef')
  })

  it('季级：排除 romanization kind（整句拼音不发 query）', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(catalogWith({ title: 'abcdef 第二季', type: 'anime' }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(listCatalogAliases).mockResolvedValueOnce([{ alias: 'abcdefdierji', kind: 'romanization', source: 'crawler', lang: null, confidence: 0.5 }] as any)
    await svc.autoMatch('vid', 'cat', { title: 'abcdef 第二季', year: 2012, mediaType: 'tv', seasonNumber: 2 })
    const args = vi.mocked(tmdbLib.searchTv).mock.calls.map((c) => c[0])
    expect(args).not.toContain('abcdefdierji') // romanization 季级排除
    expect(args).toContain('abcdef') // 裸名仍发
  })

  it('movie 路径零回归：季号后缀不剥（searchMovie 收到原始带后缀标题）', async () => {
    vi.mocked(findCatalogById).mockResolvedValue(catalogWith({ title: 'abcdef 第二季', titleOriginal: null, type: 'movie' }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.searchMovie).mockResolvedValue(search([{ id: 9, title: 'abcdef 第二季', original_title: 'abcdef 第二季', original_language: 'zh', overview: '', release_date: '2012-01-01', poster_path: null }]) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, id: 9 } as any)
    await svc.autoMatch('vid', 'cat', { title: 'abcdef 第二季', year: 2012, mediaType: 'movie' })
    // movie 路径 stripSeason=false → 搜索词保留季号后缀（逐字节零回归）
    expect(vi.mocked(tmdbLib.searchMovie).mock.calls[0][0]).toBe('abcdef 第二季')
  })
})

// META-51-A：TMDB → title_en 英文标题抽取（修拼音 title_en；仅真英文，CJK/中文回退不写）
describe('META-51-A: confirm fields 含 title_en → 英文标题抽取', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withTrans = (en: { title?: string; name?: string }): any => ({
    translations: { translations: [{ iso_3166_1: 'US', iso_639_1: 'en', name: 'English', english_name: 'English', data: { ...en, overview: '' } }] },
  })

  it('movie translations.en.data.title 为真英文 → safeUpdate 写 titleEn', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, ...withTrans({ title: 'Spirited Away' }) })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ titleEn: 'Spirited Away' }), 'tmdb', expect.anything())
  })

  it('tv translations.en.data.name 为真英文 → 写 titleEn', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getTvDetail).mockResolvedValue({ id: 1429, name: '进击的巨人', original_name: '進撃の巨人', original_language: 'ja', overview: '', genres: [], external_ids: {}, ...withTrans({ name: 'Attack on Titan' }) } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 1429, mediaType: 'tv', fields: ['title_en'] })
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ titleEn: 'Attack on Titan' }), 'tmdb', expect.anything())
  })

  it('en 翻译缺失回退中文（CJK 守卫）→ 不写 titleEn', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, ...withTrans({ title: '千与千寻' }) })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    expect(safeUpdateMock).not.toHaveBeenCalledWith('cat', expect.objectContaining({ titleEn: expect.anything() }), 'tmdb', expect.anything())
  })

  it('无 translations 但 original_language=en → 用 original_title 写 titleEn', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, original_language: 'en', original_title: 'The Matrix', translations: undefined } as any)
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ titleEn: 'The Matrix' }), 'tmdb', expect.anything())
  })

  it('confirm detail 拉取 append 含 translations', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue(MOVIE)
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    expect(vi.mocked(tmdbLib.getMovieDetail).mock.calls[0][1]).toMatchObject({ append: expect.arrayContaining(['translations']) })
  })

  // Codex stop-time review FIX：防再污染——TMDB en 译名本身是拼音/罗马音 → 不写 title_en
  it('en 译名为空格分词拼音（Qing Yu Nian）→ isPinyinTitle 拒绝，不写 titleEn', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, ...withTrans({ title: 'Qing Yu Nian' }) })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    expect(safeUpdateMock).not.toHaveBeenCalledWith('cat', expect.objectContaining({ titleEn: expect.anything() }), 'tmdb', expect.anything())
  })

  it('en 译名为无空格连写拼音（tabiqiannanyouzhire）→ 不写 titleEn', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, ...withTrans({ title: 'tabiqiannanyouzhire' }) })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    expect(safeUpdateMock).not.toHaveBeenCalledWith('cat', expect.objectContaining({ titleEn: expect.anything() }), 'tmdb', expect.anything())
  })

  // Codex stop-time review FIX：blocking 键 stale——confirm 应用 titleEn 须重算（titleEn 是 knownNames 成员）
  it('confirm 应用 titleEn → COMMIT 后重算 blocking 键', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, ...withTrans({ title: 'Spirited Away' }) })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    await Promise.resolve()
    expect(recomputeCatalogBlockingKeys).toHaveBeenCalledWith(db, 'cat')
  })

  it('confirm 仅 title_en 但译名是拼音被拒（applied 不含 titleEn）→ 不重算 blocking 键', async () => {
    vi.mocked(tmdbLib.getMovieDetail).mockResolvedValue({ ...MOVIE, ...withTrans({ title: 'Qing Yu Nian' }) })
    await svc.confirm('vid', 'cat', { tmdbId: 129, mediaType: 'movie', fields: ['title_en'] })
    await Promise.resolve()
    expect(recomputeCatalogBlockingKeys).not.toHaveBeenCalled()
  })
})
