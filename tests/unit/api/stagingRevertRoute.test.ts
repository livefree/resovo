/**
 * tests/unit/api/stagingRevertRoute.test.ts
 * CHG-SN-4-05: POST /admin/staging/:id/revert contract test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'
import { AppError } from '@/api/lib/errors'

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))

const mockModerationSvc = {
  stagingRevert: vi.fn(),
  rejectLabeled: vi.fn(),
  updateStaffNote: vi.fn(),
  toggleSource: vi.fn(),
  disableDead: vi.fn(),
}
vi.mock('@/api/services/ModerationService', () => ({
  ModerationService: vi.fn(() => mockModerationSvc),
}))
vi.mock('@/api/services/VideoService', () => ({ VideoService: vi.fn(() => ({})) }))
vi.mock('@/api/services/DoubanService', () => ({ DoubanService: vi.fn(() => ({})) }))
vi.mock('@/api/services/VideoIndexSyncService', () => ({ VideoIndexSyncService: vi.fn(() => ({})) }))
vi.mock('@/api/services/StagingPublishService', () => ({ StagingPublishService: vi.fn(() => ({})) }))
vi.mock('@/api/db/queries/moderation', () => ({
  listModerationHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  listPendingQueue: vi.fn().mockResolvedValue({ data: [], nextCursor: null, total: 0, todayStats: { reviewed: 0, approveRate: null } }),
}))
vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn().mockResolvedValue(null),
  transitionVideoState: vi.fn(),
  updateVideoEnrichStatus: vi.fn(),
}))
vi.mock('@/api/db/queries/sourceHealthEvents', () => ({
  listLineHealthEvents: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
}))
vi.mock('@/api/db/queries/staging', () => ({
  listStagingVideos: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getStagingVideo: vi.fn().mockResolvedValue(null),
  approveStagingVideo: vi.fn(),
  rejectStagingVideo: vi.fn(),
}))
vi.mock('@/api/db/queries/metadataProvenance', () => ({
  getProvenanceByCatalogId: vi.fn(),
  getLocksByCatalogId: vi.fn(),
}))

async function buildApp() {
  const { adminStagingRoutes } = await import('@/api/routes/admin/staging')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminStagingRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'moderator' | 'admin') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

describe('POST /admin/staging/:id/revert', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 退回成功 → 200', async () => {
    mockModerationSvc.stagingRevert.mockResolvedValue({
      id: 'vid-1',
      review_status: 'pending_review',
      updated_at: '2026-05-02T00:00:00Z',
    })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/staging/vid-1/revert',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('data')
  })

  it('视频不存在 → 404', async () => {
    mockModerationSvc.stagingRevert.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/staging/nonexistent/revert',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.statusCode).toBe(404)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/staging/vid-1/revert',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.statusCode).toBe(401)
  })

  it('STATE_CONFLICT → 409', async () => {
    mockModerationSvc.stagingRevert.mockRejectedValue(new AppError('STATE_CONFLICT', 'Optimistic lock conflict', 409))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/staging/vid-1/revert',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.statusCode).toBe(409)
  })
})
