/**
 * video-play-events-route.test.ts — POST /videos/:id/play-events 路由映射单测（ADR-216 / STATS-03-A2）
 *
 * 覆盖：shortId 非法→404 / body zod 失败→422 VALIDATION_ERROR / 服务结果→HTTP 码映射
 *   （ok→202 / not_found→404 / invalid_source→422 INVALID_SOURCE / rate_limited→429）。
 * mock lib db/redis + VideoPlayEventService/VideoService，构建最小 fastify inject（route 薄逻辑）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../apps/api/src/lib/postgres', () => ({ db: {} }))
vi.mock('../../../apps/api/src/lib/redis', () => ({ redis: {} }))

const mockRecord = vi.fn()
vi.mock('../../../apps/api/src/services/VideoPlayEventService', () => ({
  VideoPlayEventService: vi.fn().mockImplementation(() => ({ recordPlayEvent: mockRecord })),
}))
vi.mock('../../../apps/api/src/services/VideoService', () => ({
  VideoService: vi.fn().mockImplementation(() => ({})),
}))

import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify'
import { videoRoutes } from '../../../apps/api/src/routes/videos'

const VALID_BODY = {
  playSessionId: '0123456789abcdef',
  idempotencyKey: 'a'.repeat(64),
  watchSeconds: 30,
  occurredAt: '2026-06-25T00:00:00.000Z',
}

const optAuthSpy = vi.fn(async () => {})

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  // 模拟 A1 + authenticate 的 decorate（route 依赖）
  app.decorate('optionalAuthenticate', optAuthSpy)
  app.decorateRequest('visitorHash', null)
  app.decorateRequest('visitorIsEphemeral', false)
  app.decorateRequest('user', null)
  await app.register(videoRoutes)
  await app.ready()
  return app
}

function post(
  app: FastifyInstance,
  id: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: `/videos/${id}/play-events`, payload: body })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRecord.mockResolvedValue({ ok: true })
})

describe('POST /videos/:id/play-events 路由映射', () => {
  it('shortId 非法（非 8 字符）→ 404 NOT_FOUND，不调 service', async () => {
    const app = await buildApp()
    const res = await post(app, 'bad', VALID_BODY)
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('body 缺必填字段 → 422 VALIDATION_ERROR，不调 service', async () => {
    const app = await buildApp()
    const res = await post(app, 'abcd1234', { watchSeconds: 30 })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('idempotencyKey 非 64hex → 422', async () => {
    const app = await buildApp()
    const res = await post(app, 'abcd1234', { ...VALID_BODY, idempotencyKey: 'short' })
    expect(res.statusCode).toBe(422)
    await app.close()
  })

  it('watchSeconds 边界：0 与 86400 合法（202）；86401 越界 → 422（Codex D-1/F）', async () => {
    const app = await buildApp()
    expect((await post(app, 'abcd1234', { ...VALID_BODY, watchSeconds: 0 })).statusCode).toBe(202)
    expect((await post(app, 'abcd1234', { ...VALID_BODY, watchSeconds: 86400 })).statusCode).toBe(202)
    expect((await post(app, 'abcd1234', { ...VALID_BODY, watchSeconds: 86401 })).statusCode).toBe(422)
    await app.close()
  })

  it('preHandler optionalAuthenticate 实际运行（D-216-5）', async () => {
    const app = await buildApp()
    await post(app, 'abcd1234', VALID_BODY)
    expect(optAuthSpy).toHaveBeenCalled()
    await app.close()
  })

  it('service ok → 202 { data: { received: true } }', async () => {
    mockRecord.mockResolvedValue({ ok: true })
    const app = await buildApp()
    const res = await post(app, 'abcd1234', VALID_BODY)
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ data: { received: true } })
    await app.close()
  })

  it('service not_found → 404 NOT_FOUND', async () => {
    mockRecord.mockResolvedValue({ ok: false, reason: 'not_found' })
    const app = await buildApp()
    const res = await post(app, 'abcd1234', VALID_BODY)
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
    await app.close()
  })

  it('service invalid_source → 422 INVALID_SOURCE', async () => {
    mockRecord.mockResolvedValue({ ok: false, reason: 'invalid_source' })
    const app = await buildApp()
    const res = await post(app, 'abcd1234', VALID_BODY)
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('INVALID_SOURCE')
    await app.close()
  })

  it('service rate_limited → 429 RATE_LIMITED', async () => {
    mockRecord.mockResolvedValue({ ok: false, reason: 'rate_limited' })
    const app = await buildApp()
    const res = await post(app, 'abcd1234', VALID_BODY)
    expect(res.statusCode).toBe(429)
    expect(res.json().error.code).toBe('RATE_LIMITED')
    await app.close()
  })

  it('happy path 传递 visitorHash/userId 至 service（消费 A1 + optionalAuthenticate）', async () => {
    const app = await buildApp()
    await post(app, 'abcd1234', VALID_BODY)
    expect(mockRecord).toHaveBeenCalledTimes(1)
    const arg = mockRecord.mock.calls[0][0]
    expect(arg).toMatchObject({ shortId: 'abcd1234', idempotencyKey: 'a'.repeat(64) })
    expect(arg).toHaveProperty('visitorHash')
    expect(arg).toHaveProperty('userId')
    await app.close()
  })
})
