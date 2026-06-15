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
}))
vi.mock('@/api/services/tmdb-config', () => ({ loadTmdbClientConfig: vi.fn(async () => ({ readAccessToken: 'x' })) }))
vi.mock('@/api/db/queries/catalogExternalRefs', () => ({ resolveAndWriteExactRef: vi.fn(), insertCandidateRef: vi.fn(async () => true) }))
vi.mock('@/api/db/queries/externalData', () => ({ upsertVideoExternalRef: vi.fn(async () => undefined) }))
const safeUpdateMock = vi.fn(async () => ({ updated: true, skippedFields: [] as string[] }))
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
})

describe('reject', () => {
  it('video_external_refs → rejected', async () => {
    const r = await svc.reject('vid', 129)
    expect(r).toEqual({ rejected: true })
    expect(externalData.upsertVideoExternalRef).toHaveBeenCalledWith(db, expect.objectContaining({ provider: 'tmdb', externalId: '129', matchStatus: 'rejected', isPrimary: false }))
  })
})
