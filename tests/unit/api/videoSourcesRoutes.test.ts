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

// CHG-SN-6-10：mock insertAuditLog 用于 video.refetch_sources audit payload 内容断言
const insertAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: insertAuditLogMock,
  listAuditLogByTarget: vi.fn(),
  listAdminAuditLog: vi.fn(),
  getAdminAuditLogById: vi.fn(),
}))

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

// ADR-198：playback-verify 路由委托 SourceProbeService.recordPlaybackVerify
const mockProbeSvc = {
  recordPlaybackVerify: vi.fn(),
  batchProbe: vi.fn(),
  batchRenderCheck: vi.fn(),
}
vi.mock('@/api/services/SourceProbeService', () => ({
  SourceProbeService: vi.fn(() => mockProbeSvc),
}))
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

// ── ADR-198：admin 真实播放反馈端点 ──
describe('POST /admin/videos/:videoId/sources/:sourceId/playback-verify（ADR-198）', () => {
  const VID = '00000000-0000-0000-0000-000000000001'
  const SID = '00000000-0000-0000-0000-0000000000aa'
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 成功反馈（携分辨率）→ 200 + data.verified，委托 service', async () => {
    mockProbeSvc.recordPlaybackVerify.mockResolvedValue({
      sourceId: SID, newProbeStatus: 'ok', newRenderStatus: 'ok', verified: true,
    })
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VID}/sources/${SID}/playback-verify`,
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ success: true, resolutionWidth: 1920, resolutionHeight: 1080 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.verified).toBe(true)
    expect(mockProbeSvc.recordPlaybackVerify).toHaveBeenCalledWith(
      VID, SID, 'u-moderator',
      expect.objectContaining({ success: true, resolutionWidth: 1920, resolutionHeight: 1080 }),
      expect.anything(),
    )
  })

  it('失败反馈 success:false + errorCode → 200，透传 service', async () => {
    mockProbeSvc.recordPlaybackVerify.mockResolvedValue({
      sourceId: SID, newProbeStatus: 'dead', newRenderStatus: 'dead', verified: true,
    })
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VID}/sources/${SID}/playback-verify`,
      headers: { authorization: await tokenFor('admin'), 'content-type': 'application/json' },
      body: JSON.stringify({ success: false, errorCode: 'MEDIA_ERR_DECODE' }),
    })
    expect(res.statusCode).toBe(200)
    expect(mockProbeSvc.recordPlaybackVerify).toHaveBeenCalledWith(
      VID, SID, 'u-admin',
      expect.objectContaining({ success: false, errorCode: 'MEDIA_ERR_DECODE' }),
      expect.anything(),
    )
  })

  it('service 抛 NOT_FOUND → 404', async () => {
    const { AppError } = await import('@/api/lib/errors')
    mockProbeSvc.recordPlaybackVerify.mockRejectedValue(new AppError('NOT_FOUND', 'source 不存在', 404))
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VID}/sources/${SID}/playback-verify`,
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ success: true }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('body 缺 success → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VID}/sources/${SID}/playback-verify`,
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ resolutionWidth: 100 }),
    })
    expect(res.statusCode).toBe(422)
    expect(mockProbeSvc.recordPlaybackVerify).not.toHaveBeenCalled()
  })

  it('errorCode 超 64 字符 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VID}/sources/${SID}/playback-verify`,
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ success: false, errorCode: 'x'.repeat(65) }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('路径 id 非法 uuid → 404（不打 service/DB）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/bad-id/sources/${SID}/playback-verify`,
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ success: true }),
    })
    expect(res.statusCode).toBe(404)
    expect(mockProbeSvc.recordPlaybackVerify).not.toHaveBeenCalled()
  })

  it('非 moderator/admin 角色（user）→ 403', async () => {
    const token = `Bearer ${await signAccessToken({ userId: 'u-user', role: 'user' })}`
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VID}/sources/${SID}/playback-verify`,
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify({ success: true }),
    })
    expect(res.statusCode).toBe(403)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/videos/${VID}/sources/${SID}/playback-verify`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ success: true }),
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── CHG-SN-6-10 / R-MID-1 第 7 次系统化 legacy EXEMPT 补齐 ──
describe('POST /admin/videos/:id/refetch-sources — video.refetch_sources audit payload 断言', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('admin 触发 → 写 audit video.refetch_sources + afterJsonb { triggeredAt, siteKeys }', async () => {
    // findAdminVideoById 返回 video 存在
    const videoQueries = await import('@/api/db/queries/videos')
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000001',
    } as unknown as Awaited<ReturnType<typeof videoQueries.findAdminVideoById>>)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/videos/00000000-0000-0000-0000-000000000001/refetch-sources',
      headers: { authorization: await tokenFor('admin'), 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    })

    // fire-and-forget tick 释放
    await new Promise((r) => setImmediate(r))

    expect([200, 202]).toContain(res.statusCode)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'video.refetch_sources',
        targetKind: 'video',
        targetId: '00000000-0000-0000-0000-000000000001',
        afterJsonb: expect.objectContaining({
          triggeredAt: expect.any(String),
        }),
      }),
    )
  })

  it('admin 带 siteKeys 触发 → afterJsonb.siteKeys 透传', async () => {
    const videoQueries = await import('@/api/db/queries/videos')
    vi.mocked(videoQueries.findAdminVideoById).mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000002',
    } as unknown as Awaited<ReturnType<typeof videoQueries.findAdminVideoById>>)

    await app.inject({
      method: 'POST',
      url: '/v1/admin/videos/00000000-0000-0000-0000-000000000002/refetch-sources',
      headers: { authorization: await tokenFor('admin'), 'content-type': 'application/json' },
      payload: JSON.stringify({ siteKeys: ['bilibili', 'iqiyi'] }),
    })
    await new Promise((r) => setImmediate(r))

    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'video.refetch_sources',
        afterJsonb: expect.objectContaining({
          siteKeys: expect.arrayContaining(['bilibili']),
        }),
      }),
    )
  })
})
