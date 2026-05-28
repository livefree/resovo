/**
 * video-detail-fetch-sources.test.ts — CHG-361-E2 / ADR-160 AMENDMENT 2 D-160-AMD2-2
 *
 * 覆盖 fetchVideoSources 派发逻辑：
 * - 无 preview header → public path（URL 无 preview query / cache revalidate 60）
 * - preview header + refresh OK → admin preview path（URL 含 `&preview=admin` + Authorization Bearer + cache no-store / Y-AMD2-3）
 * - preview header + refresh 失败 → 自动降级 public path
 * - fetch 404 / 网络异常 → 返回空数组（VideoDetailClient 渲染"暂无可用播放源"占位）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// next/headers mock（server-only API）
vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}))

// admin-access-token mock — 独立单测 getAdminAccessToken（admin-access-token.test.ts 已覆盖）
vi.mock('../../../../apps/web-next/src/lib/admin-access-token', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../apps/web-next/src/lib/admin-access-token')>()
  return {
    ...original,
    getAdminAccessToken: vi.fn(),
  }
})

import { fetchVideoSources } from '../../../../apps/web-next/src/lib/video-detail'
import { headers, cookies } from 'next/headers'
import { getAdminAccessToken } from '../../../../apps/web-next/src/lib/admin-access-token'

const mockHeaders = headers as unknown as ReturnType<typeof vi.fn>
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>
const mockGetAdminAccessToken = getAdminAccessToken as unknown as ReturnType<typeof vi.fn>

function setupHeaders(adminPreview: boolean): void {
  const h = new Headers()
  if (adminPreview) h.set('x-admin-preview', '1')
  mockHeaders.mockResolvedValue(h)
}

function setupCookies(refreshToken: string | null): void {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'refresh_token' && refreshToken ? { name, value: refreshToken } : undefined),
  })
}

describe('fetchVideoSources — D-160-AMD2-2 派发', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    mockHeaders.mockReset()
    mockCookies.mockReset()
    mockGetAdminAccessToken.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('无 preview header → public path（URL 无 preview query / revalidate 60）', async () => {
    setupHeaders(false)
    setupCookies(null)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 's1', isActive: true }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const sources = await fetchVideoSources('test-slug-aB3kR9x1', 1)

    expect(sources).toHaveLength(1)
    expect(mockGetAdminAccessToken).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toMatch(/\/videos\/aB3kR9x1\/sources\?episode=1$/)
    expect(url).not.toContain('preview')
    expect(init).toMatchObject({ next: { revalidate: 60 } })
  })

  it('preview header + refresh OK → admin preview path（&preview=admin + Authorization Bearer + cache: no-store / Y-AMD2-3）', async () => {
    setupHeaders(true)
    setupCookies('rt-abc')
    mockGetAdminAccessToken.mockResolvedValueOnce('access-token-xyz')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 's2', isActive: true }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const sources = await fetchVideoSources('foo-aB3kR9x1', 1)

    expect(sources).toHaveLength(1)
    expect(mockGetAdminAccessToken).toHaveBeenCalledWith('rt-abc')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toMatch(/\/videos\/aB3kR9x1\/sources\?episode=1&preview=admin$/)
    expect(init).toMatchObject({
      cache: 'no-store',
      headers: { authorization: 'Bearer access-token-xyz' },
    })
  })

  it('preview header + refresh 失败 → 自动降级 public path', async () => {
    setupHeaders(true)
    setupCookies('rt-expired')
    mockGetAdminAccessToken.mockResolvedValueOnce(null)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    )

    const sources = await fetchVideoSources('foo-aB3kR9x1', 1)

    expect(sources).toHaveLength(0)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).not.toContain('preview')
    expect(init).toMatchObject({ next: { revalidate: 60 } })
  })

  it('fetch 404 → 返回空数组', async () => {
    setupHeaders(false)
    setupCookies(null)
    fetchMock.mockResolvedValueOnce(new Response('not-found', { status: 404 }))

    const sources = await fetchVideoSources('foo-aB3kR9x1', 1)
    expect(sources).toHaveLength(0)
  })

  it('fetch 抛错 → 返回空数组', async () => {
    setupHeaders(false)
    setupCookies(null)
    fetchMock.mockRejectedValueOnce(new Error('econnreset'))

    const sources = await fetchVideoSources('foo-aB3kR9x1', 1)
    expect(sources).toHaveLength(0)
  })
})
