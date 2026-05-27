/**
 * tests/unit/api/video-preview-query.test.ts
 * CHG-361-B2 / ADR-160 D-160-4a / Y2
 *
 * GET /v1/videos/:id?preview=admin 路径测试（5 case）：
 *   ① preview=admin + admin token → 走 admin preview path / findVideoByShortIdAdminPreview 被调
 *   ② preview=admin + 无 token → 401 UNAUTHORIZED
 *   ③ preview=admin + user role → 403 FORBIDDEN
 *   ④ preview=admin + admin + 软删 (mock 返回 null) → 404 NOT_FOUND
 *   ⑤ 无 preview query / public path → findVideoByShortId 被调（向后兼容）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/db/queries/videos', () => ({
  listVideos: vi.fn(),
  findVideoByShortId: vi.fn(),
  findVideoByShortIdAdminPreview: vi.fn(),
  listTrendingVideos: vi.fn(),
  countVideosByType: vi.fn(),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as videoQueries from '@/api/db/queries/videos'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockQ = videoQueries as unknown as {
  findVideoByShortId: ReturnType<typeof vi.fn>
  findVideoByShortIdAdminPreview: ReturnType<typeof vi.fn>
}

const MOCK_VIDEO = {
  id: 'uuid-1',
  shortId: 'abCD1234',
  slug: 'test-video',
  title: '测试电影',
  titleEn: 'Test',
  coverUrl: null,
  type: 'movie' as const,
  rating: 8.5,
  year: 2024,
  status: 'completed' as const,
  episodeCount: 1,
  sourceCount: 2,
  description: '描述',
  category: 'action' as const,
  country: 'CN',
  director: [],
  cast: [],
  writers: [],
  subtitleLangs: [],
  createdAt: '2024-01-01T00:00:00.000Z',
}

async function buildApp() {
  const { videoRoutes } = await import('@/api/routes/videos')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(videoRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'u-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('GET /v1/videos/:id?preview=admin (ADR-160 D-160-4a)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('① preview=admin + admin token → 走 admin preview path（findVideoByShortIdAdminPreview 被调 / 返回 internal 视频）', async () => {
    mockQ.findVideoByShortIdAdminPreview.mockResolvedValue(MOCK_VIDEO)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234?preview=admin',
      headers: authHeader('admin'),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.shortId).toBe('abCD1234')
    expect(mockQ.findVideoByShortIdAdminPreview).toHaveBeenCalledWith(expect.anything(), 'abCD1234')
    expect(mockQ.findVideoByShortId).not.toHaveBeenCalled()
  })

  it('② preview=admin + 无 token → 401 UNAUTHORIZED（不调任何 query）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234?preview=admin',
    })

    expect(res.statusCode).toBe(401)
    expect(mockQ.findVideoByShortIdAdminPreview).not.toHaveBeenCalled()
    expect(mockQ.findVideoByShortId).not.toHaveBeenCalled()
  })

  it('③ preview=admin + user role → 403 FORBIDDEN（不调任何 query）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234?preview=admin',
      headers: authHeader('user'),
    })

    expect(res.statusCode).toBe(403)
    expect(mockQ.findVideoByShortIdAdminPreview).not.toHaveBeenCalled()
    expect(mockQ.findVideoByShortId).not.toHaveBeenCalled()
  })

  it('④ preview=admin + admin token + soft-deleted（mock 返回 null）→ 404 NOT_FOUND', async () => {
    mockQ.findVideoByShortIdAdminPreview.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234?preview=admin',
      headers: authHeader('admin'),
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
    expect(mockQ.findVideoByShortIdAdminPreview).toHaveBeenCalled()
  })

  it('⑤ 无 preview query → 走 public path（findVideoByShortId 被调 / 向后兼容）', async () => {
    mockQ.findVideoByShortId.mockResolvedValue(MOCK_VIDEO)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234',
    })

    expect(res.statusCode).toBe(200)
    expect(mockQ.findVideoByShortId).toHaveBeenCalledWith(expect.anything(), 'abCD1234')
    expect(mockQ.findVideoByShortIdAdminPreview).not.toHaveBeenCalled()
  })
})
