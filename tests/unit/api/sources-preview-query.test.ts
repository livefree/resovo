/**
 * tests/unit/api/sources-preview-query.test.ts
 * CHG-361-E1 / ADR-160 AMENDMENT 2 D-160-AMD2-2
 *
 * GET /v1/videos/:id/sources?preview=admin 路径测试（5 case，镜像 B2 video-preview-query 范式）：
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
  findVideoByShortId: vi.fn(),
  findVideoByShortIdAdminPreview: vi.fn(),
}))

vi.mock('@/api/db/queries/sources', () => ({
  findActiveSourcesWithSignalsByVideoId: vi.fn(),
  mapSourceBase: vi.fn(),
}))

vi.mock('@/api/services/VerifyService', () => ({
  VerifyService: class {},
}))
vi.mock('@/api/workers/verifyWorker', () => ({
  enqueueVerifySingle: vi.fn(),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as videoQueries from '@/api/db/queries/videos'
import * as sourceQueries from '@/api/db/queries/sources'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockVQ = videoQueries as unknown as {
  findVideoByShortId: ReturnType<typeof vi.fn>
  findVideoByShortIdAdminPreview: ReturnType<typeof vi.fn>
}
const mockSQ = sourceQueries as unknown as {
  findActiveSourcesWithSignalsByVideoId: ReturnType<typeof vi.fn>
  mapSourceBase: ReturnType<typeof vi.fn>
}

const MOCK_VIDEO = {
  id: 'uuid-internal-1',
  shortId: 'abCD1234',
  slug: 'internal-test-video',
  title: '内部测试视频',
  visibilityStatus: 'internal',
  reviewStatus: 'pending_review',
  isPublished: false,
}

async function buildApp() {
  const { sourceRoutes } = await import('@/api/routes/sources')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(sourceRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'u-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('GET /v1/videos/:id/sources?preview=admin (ADR-160 AMENDMENT 2 D-160-AMD2-2)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    // sources query 默认返回空数组（避免 SourceService 调 mapSource 出错）
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([])
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('① preview=admin + admin token → 走 admin preview path（findVideoByShortIdAdminPreview 被调 / 返回 internal 视频 sources）', async () => {
    mockVQ.findVideoByShortIdAdminPreview.mockResolvedValue(MOCK_VIDEO)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/sources?preview=admin',
      headers: authHeader('admin'),
    })

    expect(res.statusCode).toBe(200)
    expect(mockVQ.findVideoByShortIdAdminPreview).toHaveBeenCalledWith(expect.anything(), 'abCD1234')
    expect(mockVQ.findVideoByShortId).not.toHaveBeenCalled()
    expect(mockSQ.findActiveSourcesWithSignalsByVideoId).toHaveBeenCalled()
  })

  it('② preview=admin + 无 token → 401 UNAUTHORIZED（不调任何 query）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/sources?preview=admin',
    })

    expect(res.statusCode).toBe(401)
    expect(mockVQ.findVideoByShortIdAdminPreview).not.toHaveBeenCalled()
    expect(mockVQ.findVideoByShortId).not.toHaveBeenCalled()
    expect(mockSQ.findActiveSourcesWithSignalsByVideoId).not.toHaveBeenCalled()
  })

  it('③ preview=admin + user role → 403 FORBIDDEN（不调任何 query）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/sources?preview=admin',
      headers: authHeader('user'),
    })

    expect(res.statusCode).toBe(403)
    expect(mockVQ.findVideoByShortIdAdminPreview).not.toHaveBeenCalled()
    expect(mockVQ.findVideoByShortId).not.toHaveBeenCalled()
    expect(mockSQ.findActiveSourcesWithSignalsByVideoId).not.toHaveBeenCalled()
  })

  it('④ preview=admin + admin token + soft-deleted（mock 返回 null）→ 404 NOT_FOUND', async () => {
    mockVQ.findVideoByShortIdAdminPreview.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/sources?preview=admin',
      headers: authHeader('admin'),
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
    expect(mockVQ.findVideoByShortIdAdminPreview).toHaveBeenCalled()
    expect(mockSQ.findActiveSourcesWithSignalsByVideoId).not.toHaveBeenCalled()
  })

  it('⑤ 无 preview query → 走 public path（findVideoByShortId 被调 / 向后兼容）', async () => {
    mockVQ.findVideoByShortId.mockResolvedValue(MOCK_VIDEO)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/sources',
    })

    expect(res.statusCode).toBe(200)
    expect(mockVQ.findVideoByShortId).toHaveBeenCalledWith(expect.anything(), 'abCD1234')
    expect(mockVQ.findVideoByShortIdAdminPreview).not.toHaveBeenCalled()
  })
})
