/**
 * tests/unit/api/moderationStats.test.ts
 * CHG-220: GET /admin/videos/moderation-stats + GET /admin/videos/pending-review
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: undefined }))

vi.mock('@/api/db/queries/videos', () => ({
  listAdminVideos: vi.fn(),
  findAdminVideoById: vi.fn(),
  publishVideo: vi.fn(),
  updateVisibility: vi.fn(),
  reviewVideo: vi.fn(),
  batchPublishVideos: vi.fn(),
  batchUnpublishVideos: vi.fn(),
  createVideo: vi.fn(),
  updateVideoMeta: vi.fn(),
  getModerationStats: vi.fn(),
  listPendingReviewVideos: vi.fn(),
}))

vi.mock('@/api/services/DoubanService', () => ({
  DoubanService: class { syncVideo = vi.fn() },
}))

import * as videoQueries from '@/api/db/queries/videos'

const mockGetModerationStats = videoQueries.getModerationStats as ReturnType<typeof vi.fn>
const mockListPendingReviewVideos = videoQueries.listPendingReviewVideos as ReturnType<typeof vi.fn>

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_STATS = {
  pendingCount: 12,
  todayReviewedCount: 5,
  interceptRate: 33.3,
}

const MOCK_PENDING_ROWS = [
  {
    id: 'vid-uuid-1',
    shortId: 'abc12345',
    title: '待审电影一',
    type: 'movie',
    coverUrl: 'https://img.example.com/1.jpg',
    year: 2024,
    siteKey: 'site-a',
    siteName: 'Site A',
    firstSourceUrl: 'https://cdn.example.com/1.m3u8',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
]

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  const { adminVideoRoutes } = await import('@/api/routes/admin/videos')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminVideoRoutes)
  await app.ready()
  return app
}

async function modToken() {
  return `Bearer ${await signAccessToken({ userId: 'u-1', role: 'moderator' })}`
}

// ═══════════════════════════════════════════════════════════════
// GET /admin/videos/moderation-stats
// ═══════════════════════════════════════════════════════════════

describe('GET /admin/videos/moderation-stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetModerationStats.mockResolvedValue(MOCK_STATS)
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('返回统计数据', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/videos/moderation-stats',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.pendingCount).toBe(12)
    expect(body.data.todayReviewedCount).toBe(5)
    expect(body.data.interceptRate).toBe(33.3)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/videos/moderation-stats',
    })
    expect(res.statusCode).toBe(401)
  })

  it('interceptRate 无数据时为 null', async () => {
    mockGetModerationStats.mockResolvedValue({ ...MOCK_STATS, interceptRate: null })
    const res = await app.inject({
      method: 'GET',
      url: '/admin/videos/moderation-stats',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.interceptRate).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// GET /admin/videos/pending-review
// ═══════════════════════════════════════════════════════════════

describe('GET /admin/videos/pending-review', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockListPendingReviewVideos.mockResolvedValue({ rows: MOCK_PENDING_ROWS, total: 1 })
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('返回待审列表，含 firstSourceUrl', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/videos/pending-review',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.data[0].firstSourceUrl).toBe('https://cdn.example.com/1.m3u8')
    expect(body.data[0].shortId).toBe('abc12345')
  })

  it('分页参数传递给查询层', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/videos/pending-review?page=2&limit=10',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    expect(mockListPendingReviewVideos).toHaveBeenCalledWith(
      expect.anything(),
      { page: 2, limit: 10 }
    )
  })

  it('无效分页参数 → 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/videos/pending-review?page=0',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(422)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/videos/pending-review',
    })
    expect(res.statusCode).toBe(401)
  })
})
