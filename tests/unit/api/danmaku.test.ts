/**
 * tests/unit/api/danmaku.test.ts
 * CHG-21: GET /videos/:id/danmaku、POST /videos/:id/danmaku 测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

vi.mock('@/api/db/queries/videos', () => ({
  findVideoByShortId: vi.fn(),
}))

vi.mock('@/api/db/queries/danmaku', () => ({
  getDanmaku: vi.fn(),
  insertDanmaku: vi.fn(),
}))

import * as videoQueries from '@/api/db/queries/videos'
import * as danmakuQueries from '@/api/db/queries/danmaku'

const mockVQ = videoQueries as {
  findVideoByShortId: ReturnType<typeof vi.fn>
}
const mockDQ = danmakuQueries as {
  getDanmaku: ReturnType<typeof vi.fn>
  insertDanmaku: ReturnType<typeof vi.fn>
}

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_VIDEO = {
  id: 'video-uuid-1',
  shortId: 'abCD1234',
  title: '测试动漫',
  type: 'anime' as const,
  isPublished: true,
  episodeCount: 12,
}

const MOCK_DANMAKU_ITEMS = [
  { time: 10, type: 0, color: '#ffffff', text: '好看' },
  { time: 30, type: 1, color: '#ff0000', text: '太棒了' },
]

const MOCK_INSERTED = { time: 15, type: 0, color: '#00ff00', text: '哈哈' }

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  const { danmakuRoutes } = await import('@/api/routes/danmaku')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(danmakuRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// GET /v1/videos/:id/danmaku
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/videos/:id/danmaku', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockVQ.findVideoByShortId.mockResolvedValue(MOCK_VIDEO)
    mockDQ.getDanmaku.mockResolvedValue(MOCK_DANMAKU_ITEMS)
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('返回弹幕列表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/danmaku',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0]).toMatchObject({ time: 10, type: 0, color: '#ffffff', text: '好看' })
  })

  it('?ep=2 参数传递给查询函数', async () => {
    await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/danmaku?ep=2' })
    const callArgs = mockDQ.getDanmaku.mock.calls[0]
    expect(callArgs[2]).toBe(2)
  })

  it('默认 ep=1', async () => {
    await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/danmaku' })
    const callArgs = mockDQ.getDanmaku.mock.calls[0]
    expect(callArgs[2]).toBe(1)
  })

  it('视频不存在返回 404', async () => {
    mockVQ.findVideoByShortId.mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/danmaku',
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('short_id 格式非法返回 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/!!!!/danmaku',
    })
    expect(res.statusCode).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/videos/:id/danmaku
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/videos/:id/danmaku', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockVQ.findVideoByShortId.mockResolvedValue(MOCK_VIDEO)
    mockDQ.insertDanmaku.mockResolvedValue(MOCK_INSERTED)
    app = await buildApp()
    const token = signAccessToken({ userId: 'user-uuid-1', role: 'user' })
    authHeader = `Bearer ${token}`
  })
  afterEach(() => app.close())

  const VALID_BODY = { ep: 1, time: 15, type: 0, color: '#00ff00', text: '哈哈' }

  it('发送弹幕成功返回 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/danmaku',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data).toMatchObject(MOCK_INSERTED)
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/danmaku',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    expect(res.statusCode).toBe(401)
  })

  it('颜色格式非法返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/danmaku',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, color: 'red' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('text 超过 100 字返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/danmaku',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, text: 'a'.repeat(101) }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('type 非法值返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/danmaku',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, type: 5 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('视频不存在返回 404', async () => {
    mockVQ.findVideoByShortId.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/danmaku',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    expect(res.statusCode).toBe(404)
  })

  it('insertDanmaku 接收正确参数（含 episodeNumber）', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/danmaku',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, ep: 3 }),
    })
    const callArgs = mockDQ.insertDanmaku.mock.calls[0][1]
    expect(callArgs.episodeNumber).toBe(3)
    expect(callArgs.videoId).toBe('video-uuid-1')
  })
})
