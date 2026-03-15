/**
 * tests/unit/api/sources.test.ts
 * PLAYER-01: GET /videos/:id/sources, POST /videos/:id/sources/:sid/report 测试
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

vi.mock('@/api/db/queries/sources', () => ({
  findActiveSourcesByVideoId: vi.fn(),
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/videos', () => ({
  findVideoByShortId: vi.fn(),
  listVideos: vi.fn(),
  listTrendingVideos: vi.fn(),
}))

import * as sourceQueries from '@/api/db/queries/sources'
import * as videoQueries from '@/api/db/queries/videos'

const mockSQ = sourceQueries as {
  findActiveSourcesByVideoId: ReturnType<typeof vi.fn>
  findSourceById: ReturnType<typeof vi.fn>
}
const mockVQ = videoQueries as {
  findVideoByShortId: ReturnType<typeof vi.fn>
}

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_VIDEO = {
  id: 'video-uuid-1',
  shortId: 'abCD1234',
  title: '测试电影',
  type: 'movie' as const,
  isPublished: true,
}

const MOCK_SOURCE = {
  id: 'source-uuid-1',
  videoId: 'video-uuid-1',
  episodeNumber: null,
  sourceUrl: 'https://cdn.example.com/video.m3u8', // ADR-001: 直链
  sourceName: '线路1',
  quality: '1080P' as const,
  type: 'hls' as const,
  isActive: true,
  lastChecked: null,
}

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  const { sourceRoutes } = await import('@/api/routes/sources')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(sourceRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// GET /v1/videos/:id/sources
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/videos/:id/sources', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockVQ.findVideoByShortId.mockResolvedValue(MOCK_VIDEO)
    mockSQ.findActiveSourcesByVideoId.mockResolvedValue([MOCK_SOURCE])
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('只返回 is_active=true 的播放源', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].isActive).toBe(true)
  })

  it('ADR-001 验证：响应包含 source_url 直链，不含代理路径', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    const source = res.json().data[0]
    // source_url 必须是直链（以 http 开头，不含 /proxy/ 路径）
    expect(source.sourceUrl).toMatch(/^https?:\/\//)
    expect(source.sourceUrl).not.toContain('/proxy/')
  })

  it('?episode=1 参数传递给查询函数', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/sources?episode=1',
    })
    expect(res.statusCode).toBe(200)
    const callArgs = mockSQ.findActiveSourcesByVideoId.mock.calls[0]
    expect(callArgs[2]).toBe(1) // episode 参数
  })

  it('视频不存在 → 404', async () => {
    mockVQ.findVideoByShortId.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/v1/videos/notfound/sources' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('无播放源时返回空数组', async () => {
    mockSQ.findActiveSourcesByVideoId.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/videos/:id/sources/:sid/report
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/videos/:id/sources/:sid/report', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockSQ.findSourceById.mockResolvedValue(MOCK_SOURCE)
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('未登录举报 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/source-uuid-1/report',
      payload: { reason: 'broken' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('登录后举报成功 → 204', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/source-uuid-1/report',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'broken' },
    })
    expect(res.statusCode).toBe(204)
  })

  it('播放源不存在 → 404', async () => {
    mockSQ.findSourceById.mockResolvedValue(null)
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/not-exist/report',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'broken' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('无效举报原因 → 422', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/source-uuid-1/report',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'invalid_reason' },
    })
    expect(res.statusCode).toBe(422)
  })
})
