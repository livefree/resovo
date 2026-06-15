/**
 * tests/unit/api/tmdb.test.ts — TMDb v3 client 单测（ADR-201 §TMDB 接入 / META-38）
 *
 * 覆盖：search movie/tv（query + year + 鉴权 + 埋点）/ detail + append_to_response /
 *       detail 404 valid-negative 返 null / configuration / 429 退避重试（Retry-After）/
 *       429 耗尽抛错 / 鉴权双路（Bearer header vs api_key query）/ 无凭证 none /
 *       超时分类。recordFetch 旁路被 mock 以断言埋点（不触真实 DB）。
 *
 * testConnection 的鉴权双路/429 断言见 integration-credential-testers.test.ts（META-37），此处不重复。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  searchMovie,
  searchTv,
  getMovieDetail,
  getTvDetail,
  getConfiguration,
  TmdbHttpError,
  type TmdbClientConfig,
} from '@/api/lib/tmdb'
import { recordFetch } from '@/api/lib/external-fetch-recorder'

vi.mock('@/api/lib/external-fetch-recorder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/lib/external-fetch-recorder')>()
  return { ...actual, recordFetch: vi.fn(async () => undefined) }
})

const recordFetchMock = vi.mocked(recordFetch)
const fetchMock = vi.fn()

/** 构造一个 fetch Response 替身（含 json + headers.get('retry-after')）。 */
function fakeRes(body: unknown, opts?: { status?: number; retryAfter?: string }) {
  const status = opts?.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (k: string) => (k.toLowerCase() === 'retry-after' ? (opts?.retryAfter ?? null) : null) },
  }
}

/** 测试用 cfg：Bearer 鉴权 + 关闭节流（minRequestIntervalMs=0）避免测试延时。 */
const CFG: TmdbClientConfig = { readAccessToken: 'rat', minRequestIntervalMs: 0 }

function calledUrl(idx = 0): URL {
  return new URL(String(fetchMock.mock.calls[idx][0]))
}
function calledHeaders(idx = 0): Record<string, string> {
  return fetchMock.mock.calls[idx][1].headers as Record<string, string>
}

beforeEach(() => {
  fetchMock.mockReset()
  recordFetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchMovie / searchTv', () => {
  it('searchMovie：命中 /search/movie，带 query + primary_release_year + Bearer，埋点 search/ok', async () => {
    const payload = { page: 1, results: [{ id: 1 }, { id: 2 }], total_pages: 1, total_results: 2 }
    fetchMock.mockResolvedValueOnce(fakeRes(payload))

    const r = await searchMovie('naruto', { year: 2002, language: 'zh-CN' }, CFG, 'admin_search')

    expect(r.results).toHaveLength(2)
    const url = calledUrl()
    expect(url.pathname).toBe('/3/search/movie')
    expect(url.searchParams.get('query')).toBe('naruto')
    expect(url.searchParams.get('primary_release_year')).toBe('2002')
    expect(url.searchParams.get('language')).toBe('zh-CN')
    expect(calledHeaders().Authorization).toBe('Bearer rat')
    expect(recordFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'tmdb', operation: 'search', method: 'api', status: 'ok', source: 'admin_search', target: 'naruto', itemCount: 2 }),
    )
  })

  it('searchTv：命中 /search/tv，带 first_air_date_year', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({ page: 1, results: [], total_pages: 0, total_results: 0 }))
    await searchTv('bleach', { year: 2004 }, CFG)
    const url = calledUrl()
    expect(url.pathname).toBe('/3/search/tv')
    expect(url.searchParams.get('first_air_date_year')).toBe('2004')
  })

  it('searchMovie 非 2xx：抛 TmdbHttpError + 埋点 search/fail', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({}, { status: 500 }))
    await expect(searchMovie('x', undefined, CFG)).rejects.toBeInstanceOf(TmdbHttpError)
    expect(recordFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'search', status: 'fail' }),
    )
  })
})

describe('getMovieDetail / getTvDetail（append_to_response）', () => {
  it('getMovieDetail：命中 /movie/{id}，append_to_response 拼接，埋点 detail/ok', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({ id: 42, title: 'X', external_ids: { imdb_id: 'tt1' } }))

    const r = await getMovieDetail(42, { append: ['external_ids', 'images'] }, CFG)

    expect(r?.id).toBe(42)
    const url = calledUrl()
    expect(url.pathname).toBe('/3/movie/42')
    expect(url.searchParams.get('append_to_response')).toBe('external_ids,images')
    expect(recordFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'detail', status: 'ok', target: '42', itemCount: 1 }),
    )
  })

  it('getTvDetail：命中 /tv/{id}', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({ id: 7, name: 'Y' }))
    const r = await getTvDetail(7, undefined, CFG)
    expect(r?.id).toBe(7)
    expect(calledUrl().pathname).toBe('/3/tv/7')
  })

  it('getMovieDetail 404：valid-negative 返 null，埋点 detail/ok（无 error）', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({}, { status: 404 }))
    const r = await getMovieDetail(999, undefined, CFG)
    expect(r).toBeNull()
    expect(recordFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'detail', status: 'ok', itemCount: 0, error: undefined }),
    )
  })

  it('getMovieDetail 500：失败返 null，埋点 detail/fail（带 error）', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({}, { status: 500 }))
    const r = await getMovieDetail(5, undefined, CFG)
    expect(r).toBeNull()
    expect(recordFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'detail', status: 'fail', error: expect.any(String) }),
    )
  })
})

describe('getConfiguration', () => {
  it('命中 /configuration，埋点 detail/ok target=configuration', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({ images: { secure_base_url: 'https://image.tmdb.org/t/p/' }, change_keys: [] }))
    const r = await getConfiguration(CFG)
    expect(r?.images.secure_base_url).toContain('image.tmdb.org')
    expect(calledUrl().pathname).toBe('/3/configuration')
    expect(recordFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'detail', status: 'ok', target: 'configuration' }),
    )
  })
})

describe('限速 / 429', () => {
  it('429 带 Retry-After=0：退避后重试，第二次 200 成功（fetch 调 2 次）', async () => {
    fetchMock
      .mockResolvedValueOnce(fakeRes({}, { status: 429, retryAfter: '0' }))
      .mockResolvedValueOnce(fakeRes({ page: 1, results: [{ id: 1 }], total_pages: 1, total_results: 1 }))

    const r = await searchMovie('q', undefined, CFG)
    expect(r.results).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('429 重试耗尽：抛 TmdbHttpError(429)（maxRetries=1 → fetch 调 2 次）', async () => {
    fetchMock.mockResolvedValue(fakeRes({}, { status: 429, retryAfter: '0' }))
    await expect(
      searchMovie('q', undefined, { ...CFG, maxRetries: 1 }),
    ).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('鉴权双路 / 无凭证', () => {
  it('仅 api_key：走 query ?api_key=，不发 Authorization', async () => {
    fetchMock.mockResolvedValueOnce(fakeRes({ page: 1, results: [], total_pages: 0, total_results: 0 }))
    await searchMovie('q', undefined, { apiKey: 'k3', minRequestIntervalMs: 0 })
    expect(calledUrl().searchParams.get('api_key')).toBe('k3')
    expect(calledHeaders().Authorization).toBeUndefined()
  })

  it('无凭证：searchMovie 抛错且不发请求', async () => {
    await expect(searchMovie('q', undefined, { minRequestIntervalMs: 0 })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('无凭证：getMovieDetail 返 null（不发请求，埋点 detail/fail）', async () => {
    const r = await getMovieDetail(1, undefined, { minRequestIntervalMs: 0 })
    expect(r).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(recordFetchMock).toHaveBeenCalledWith(expect.objectContaining({ operation: 'detail', status: 'fail' }))
  })
})

describe('超时分类', () => {
  it('fetch 抛 TimeoutError：search 埋点 timeout 并 re-throw', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    await expect(searchMovie('q', undefined, CFG)).rejects.toThrow()
    expect(recordFetchMock).toHaveBeenCalledWith(expect.objectContaining({ operation: 'search', status: 'timeout' }))
  })
})
