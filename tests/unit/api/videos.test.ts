/**
 * tests/unit/api/videos.test.ts
 * VIDEO-01: GET /videos, GET /videos/:id, GET /videos/trending 测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

vi.mock('@/api/db/queries/videos', () => ({
  listVideos: vi.fn(),
  findVideoByShortId: vi.fn(),
  listTrendingVideos: vi.fn(),
}))

import * as videoQueries from '@/api/db/queries/videos'
const mockQ = videoQueries as {
  listVideos: ReturnType<typeof vi.fn>
  findVideoByShortId: ReturnType<typeof vi.fn>
  listTrendingVideos: ReturnType<typeof vi.fn>
}

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_CARD = {
  id: 'uuid-1',
  shortId: 'abCD1234',
  slug: 'test-video-abCD1234',
  title: '测试电影',
  titleEn: 'Test Movie',
  coverUrl: 'https://example.com/cover.jpg',
  type: 'movie' as const,
  rating: 8.5,
  year: 2024,
  status: 'completed' as const,
  episodeCount: 1,
  sourceCount: 2,
}

const MOCK_VIDEO = {
  ...MOCK_CARD,
  description: '这是一部测试电影',
  category: 'action' as const,
  country: 'CN',
  director: ['导演甲'],
  cast: ['演员乙', '演员丙'],
  writers: ['编剧丁'],
  subtitleLangs: ['zh-CN', 'en'],
  createdAt: '2024-01-01T00:00:00.000Z',
}

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  const { videoRoutes } = await import('@/api/routes/videos')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(videoRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// GET /v1/videos — 视频列表
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/videos', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockQ.listVideos.mockResolvedValue({ rows: [MOCK_CARD], total: 1 })
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('默认返回列表，含 pagination', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toMatchObject({
      total: 1,
      page: 1,
      limit: 20,
      hasNext: false,
    })
  })

  it('type 过滤：只返回指定类型', async () => {
    mockQ.listVideos.mockResolvedValue({ rows: [], total: 0 })
    const res = await app.inject({ method: 'GET', url: '/v1/videos?type=anime' })
    expect(res.statusCode).toBe(200)
    const callArgs = mockQ.listVideos.mock.calls[0][1] as { type: string }
    expect(callArgs.type).toBe('anime')
  })

  it('year 过滤：传入年份参数', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos?year=2024' })
    expect(res.statusCode).toBe(200)
    const callArgs = mockQ.listVideos.mock.calls[0][1] as { year: number }
    expect(callArgs.year).toBe(2024)
  })

  it('sort=rating：调用时 sort 参数为 rating', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos?sort=rating' })
    expect(res.statusCode).toBe(200)
    const callArgs = mockQ.listVideos.mock.calls[0][1] as { sort: string }
    expect(callArgs.sort).toBe('rating')
  })

  it('page=2 时 pagination.page 为 2', async () => {
    mockQ.listVideos.mockResolvedValue({ rows: [], total: 50 })
    const res = await app.inject({ method: 'GET', url: '/v1/videos?page=2&limit=20' })
    expect(res.statusCode).toBe(200)
    expect(res.json().pagination.page).toBe(2)
    expect(res.json().pagination.hasNext).toBe(true) // 50 > 2*20 → true
  })

  it('hasNext 计算正确：page*limit < total 时为 true', async () => {
    mockQ.listVideos.mockResolvedValue({ rows: [MOCK_CARD], total: 21 })
    const res = await app.inject({ method: 'GET', url: '/v1/videos?page=1&limit=20' })
    expect(res.json().pagination.hasNext).toBe(true)
  })

  it('pagination.hasNext 为 false 当无更多数据', async () => {
    mockQ.listVideos.mockResolvedValue({ rows: [MOCK_CARD], total: 5 })
    const res = await app.inject({ method: 'GET', url: '/v1/videos?page=1&limit=20' })
    expect(res.json().pagination.hasNext).toBe(false)
  })

  it('无效 type 参数 → 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos?type=invalid' })
    expect(res.statusCode).toBe(422)
  })
})

// ═══════════════════════════════════════════════════════════════
// GET /v1/videos/trending
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/videos/trending', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockQ.listTrendingVideos.mockResolvedValue([MOCK_CARD])
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('返回 trending 列表（data 数组）', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/trending' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(1)
  })

  it('period=today 传递给查询函数', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/trending?period=today' })
    expect(res.statusCode).toBe(200)
    const callArgs = mockQ.listTrendingVideos.mock.calls[0][1] as { period: string }
    expect(callArgs.period).toBe('today')
  })

  it('默认 period 为 week', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/trending' })
    expect(res.statusCode).toBe(200)
    const callArgs = mockQ.listTrendingVideos.mock.calls[0][1] as { period: string }
    expect(callArgs.period).toBe('week')
  })
})

// ═══════════════════════════════════════════════════════════════
// GET /v1/videos/:id — 视频详情
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/videos/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockQ.findVideoByShortId.mockResolvedValue(MOCK_VIDEO)
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('通过 short_id 查询，返回完整视频信息含 director/cast/writers', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.shortId).toBe('abCD1234')
    expect(body.data.director).toEqual(['导演甲'])
    expect(body.data.cast).toEqual(['演员乙', '演员丙'])
    expect(body.data.writers).toEqual(['编剧丁'])
  })

  it('不存在的 short_id → 404 NOT_FOUND', async () => {
    mockQ.findVideoByShortId.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/v1/videos/notfound' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('已软删除的视频（findVideoByShortId 返回 null）→ 404', async () => {
    mockQ.findVideoByShortId.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234' })
    expect(res.statusCode).toBe(404)
  })

  it('短 ID 格式不合法（非 8 位字母数字）→ 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/toolong123456' })
    expect(res.statusCode).toBe(404)
    expect(mockQ.findVideoByShortId).not.toHaveBeenCalled()
  })

  it('short_id 含特殊字符 → 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/ab!@#$%^' })
    expect(res.statusCode).toBe(404)
  })
})
