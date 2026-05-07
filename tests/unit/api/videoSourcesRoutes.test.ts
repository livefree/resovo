/**
 * tests/unit/api/videoSourcesRoutes.test.ts
 * CHG-SN-4-05: PATCH /admin/videos/:id/sources/:sourceId + POST /sources/disable-dead
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))

const mockModerationSvc = {
  toggleSource: vi.fn(),
  disableDead: vi.fn(),
  rejectLabeled: vi.fn(),
  updateStaffNote: vi.fn(),
  stagingRevert: vi.fn(),
}
vi.mock('@/api/services/ModerationService', () => ({
  ModerationService: vi.fn(() => mockModerationSvc),
}))
vi.mock('@/api/services/CrawlerRunService', () => ({ CrawlerRunService: vi.fn(() => ({ createAndEnqueueRun: vi.fn() })) }))
vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn().mockResolvedValue(null),
  transitionVideoState: vi.fn(),
}))

async function buildApp() {
  const { adminVideoSourcesRoutes } = await import('@/api/routes/admin/videoSources')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminVideoSourcesRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'moderator' | 'admin') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

describe('PATCH /admin/videos/:id/sources/:sourceId', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator toggle is_active=false → 200 + data', async () => {
    mockModerationSvc.toggleSource.mockResolvedValue({ id: 's1', is_active: false, updated_at: '2026-05-06T00:00:00Z' })
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/videos/vid-1/sources/s1',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('data')
    expect(res.json().data).toHaveProperty('updated_at')
  })

  it('source 不存在 → 404', async () => {
    mockModerationSvc.toggleSource.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/videos/vid-1/sources/missing',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  // CHG-SN-5-PRE-01-C
  it('expectedUpdatedAt 转发到 service 层', async () => {
    mockModerationSvc.toggleSource.mockResolvedValue({ id: 's1', is_active: true, updated_at: '2026-05-06T00:00:01Z' })
    await app.inject({
      method: 'PATCH',
      url: '/v1/admin/videos/vid-1/sources/s1',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: true, expectedUpdatedAt: '2026-05-06T00:00:00Z' }),
    })
    expect(mockModerationSvc.toggleSource).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'vid-1',
        sourceId: 's1',
        isActive: true,
        expectedUpdatedAt: '2026-05-06T00:00:00Z',
      }),
    )
  })

  // CHG-SN-5-PRE-01-C
  it('service 抛 STATE_CONFLICT → 409 REVIEW_RACE', async () => {
    const { AppError } = await import('@/api/lib/errors')
    mockModerationSvc.toggleSource.mockRejectedValue(
      new AppError('STATE_CONFLICT', 'Optimistic lock conflict on video source', 409),
    )
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/videos/vid-1/sources/s1',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false, expectedUpdatedAt: '2026-05-06T00:00:00Z' }),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('REVIEW_RACE')
  })

  // CHG-SN-5-PRE-01-C
  it('expectedUpdatedAt 非 ISO → 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/videos/vid-1/sources/s1',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false, expectedUpdatedAt: 'not-a-date' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('body 缺少 isActive → 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/videos/vid-1/sources/s1',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ notIsActive: true }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/videos/vid-1/sources/s1',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /admin/videos/:id/sources/disable-dead', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 批量禁用 → 200 + data', async () => {
    mockModerationSvc.disableDead.mockResolvedValue({ disabled: 2, sourceIds: ['s1', 's2'] })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/videos/vid-1/sources/disable-dead',
      headers: { authorization: await tokenFor('moderator') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.disabled).toBe(2)
    expect(body.data.sourceIds).toHaveLength(2)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/videos/vid-1/sources/disable-dead',
    })
    expect(res.statusCode).toBe(401)
  })
})
