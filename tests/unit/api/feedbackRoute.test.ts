/**
 * tests/unit/api/feedbackRoute.test.ts
 * CHG-SN-4-05: POST /feedback/playback — rate-limit + PII hash + 副作用
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'

const mockRedis = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
}))
vi.mock('@/api/lib/redis', () => ({
  redis: mockRedis,
  default: mockRedis,
}))

const mockDb = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}))
vi.mock('@/api/lib/postgres', () => ({ db: mockDb }))

const mockInsertHealthEvent = vi.fn()
vi.mock('@/api/db/queries/sourceHealthEvents', () => ({
  listLineHealthEvents: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  insertHealthEvent: (...args: unknown[]) => mockInsertHealthEvent(...args),
}))

async function buildApp() {
  const { feedbackRoutes } = await import('@/api/routes/feedback')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(feedbackRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

const validBody = {
  videoId: '00000000-0000-0000-0000-000000000001',
  sourceId: '00000000-0000-0000-0000-000000000002',
  success: true,
}

describe('POST /feedback/playback', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedis.set.mockResolvedValue('OK')   // rate-limit 通过
    mockRedis.get.mockResolvedValue('0')
    mockRedis.incr.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)
    mockInsertHealthEvent.mockResolvedValue('ev-1')
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('合法请求 → 202 + { received: true }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().data.received).toBe(true)
  })

  it('rate-limit 触发 → 429 RATE_LIMITED', async () => {
    mockRedis.set.mockResolvedValue(null)  // NX 失败 = 已有 key
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(429)
    expect(res.json().error.code).toBe('RATE_LIMITED')
  })

  it('body 缺少必填字段 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId: 'bad-uuid', success: true }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('success=false → fire-and-forget insertHealthEvent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, success: false, errorCode: 'ERR_NETWORK' }),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => expect(mockInsertHealthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ origin: 'feedback_driven', sourceId: validBody.sourceId }),
    ))
  })

  it('success=false × ≥3 → 额外插入 queue signal（processedAt=null）', async () => {
    mockRedis.incr.mockResolvedValue(3)  // 第三次失败
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, success: false }),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => {
      const calls = mockInsertHealthEvent.mock.calls
      const queueSignal = calls.find((c) => c[1]?.processedAt === null)
      expect(queueSignal).toBeDefined()
    })
  })

  it('success=true + resolutionHeight → fire-and-forget db.query quality update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, resolutionHeight: 1080, resolutionWidth: 1920 }),
    })
    expect(res.statusCode).toBe(202)
    await vi.waitFor(() => {
      const calls = mockDb.query.mock.calls
      const qualityUpdate = calls.find((c: unknown[]) => String(c[0]).includes('quality_detected'))
      expect(qualityUpdate).toBeDefined()
    })
  })

  it('IP 地址不存储原值，只使用 hash（8 hex）作为 rate-limit key', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/feedback/playback',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.168.1.1' },
      body: JSON.stringify(validBody),
    })
    const setCall = mockRedis.set.mock.calls[0]
    const rateLimitKey = setCall[0] as string
    // key 格式: fb:rl:{8字节ipHash}:{sourceId}
    expect(rateLimitKey).toMatch(/^fb:rl:[0-9a-f]{8}:/)
    expect(rateLimitKey).not.toContain('192.168')
  })
})
