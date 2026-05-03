/**
 * tests/unit/api/moderationQueueRoutes.test.ts
 * CHG-SN-4-05: pending-queue / reject-labeled / staff-note / line-health contract tests
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
  rejectLabeled: vi.fn(),
  updateStaffNote: vi.fn(),
  stagingRevert: vi.fn(),
  toggleSource: vi.fn(),
  disableDead: vi.fn(),
}
vi.mock('@/api/services/ModerationService', () => ({
  ModerationService: vi.fn(() => mockModerationSvc),
}))
vi.mock('@/api/services/VideoService', () => ({ VideoService: vi.fn(() => ({})) }))
vi.mock('@/api/services/DoubanService', () => ({ DoubanService: vi.fn(() => ({})) }))
vi.mock('@/api/services/VideoIndexSyncService', () => ({ VideoIndexSyncService: vi.fn(() => ({})) }))

const mockListPendingQueue = vi.fn()
const mockListLineHealth = vi.fn()
vi.mock('@/api/db/queries/moderation', () => ({
  listModerationHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  listPendingQueue: (...args: unknown[]) => mockListPendingQueue(...args),
}))
vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn().mockResolvedValue(null),
  transitionVideoState: vi.fn(),
  updateVideoEnrichStatus: vi.fn(),
}))
vi.mock('@/api/db/queries/sourceHealthEvents', () => ({
  listLineHealthEvents: (...args: unknown[]) => mockListLineHealth(...args),
}))
vi.mock('@/api/db/queries/metadataProvenance', () => ({
  getProvenanceByCatalogId: vi.fn(),
  getLocksByCatalogId: vi.fn(),
}))
const mockListAuditLogByTarget = vi.fn()
vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: vi.fn(),
  listAuditLogByTarget: (...args: unknown[]) => mockListAuditLogByTarget(...args),
}))

async function buildApp() {
  const { adminModerationRoutes } = await import('@/api/routes/admin/moderation')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminModerationRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'moderator' | 'admin' | 'viewer') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

describe('GET /admin/moderation/pending-queue', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockListPendingQueue.mockResolvedValue({ data: [], nextCursor: null, total: 0, todayStats: { reviewed: 0, approveRate: null } })
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 返回 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/pending-queue',
      headers: { authorization: await tokenFor('moderator') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('todayStats')
  })

  it('未认证返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/moderation/pending-queue' })
    expect(res.statusCode).toBe(401)
  })

  it('query 参数传递给 listPendingQueue', async () => {
    await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/pending-queue?limit=10&type=movie',
      headers: { authorization: await tokenFor('moderator') },
    })
    expect(mockListPendingQueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 10, type: 'movie' }),
      expect.any(String),
    )
  })
})

describe('POST /admin/moderation/:id/reject-labeled', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockModerationSvc.rejectLabeled.mockResolvedValue({ id: 'vid-1', review_status: 'rejected' })
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 可拒绝标记', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/vid-1/reject-labeled',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ labelKey: 'all_dead' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('data')
  })

  it('body 缺少 labelKey → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/vid-1/reject-labeled',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'test' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('视频不存在 → 404', async () => {
    mockModerationSvc.rejectLabeled.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/nonexistent/reject-labeled',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ labelKey: 'other' }),
    })
    expect(res.statusCode).toBe(404)
  })

  it('STATE_CONFLICT → 409 REVIEW_RACE', async () => {
    mockModerationSvc.rejectLabeled.mockRejectedValue(new AppError('STATE_CONFLICT', 'Optimistic lock conflict', 409))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/vid-1/reject-labeled',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ labelKey: 'other' }),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('REVIEW_RACE')
  })
})

describe('PATCH /admin/moderation/:id/staff-note', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockModerationSvc.updateStaffNote.mockResolvedValue({ id: 'vid-1', updated_at: '2026-05-02T00:00:00Z' })
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 可更新备注', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/staff-note',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ note: '需要复核源' }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('note 为 null 可清空备注', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/staff-note',
      headers: { authorization: await tokenFor('moderator'), 'content-type': 'application/json' },
      body: JSON.stringify({ note: null }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('视频不存在 → 404', async () => {
    mockModerationSvc.updateStaffNote.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/nonexistent/staff-note',
      headers: { authorization: await tokenFor('admin'), 'content-type': 'application/json' },
      body: JSON.stringify({ note: 'test' }),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /admin/moderation/:id/line-health/:sourceId', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockListLineHealth.mockResolvedValue({ rows: [], total: 0 })
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 返回 200 + pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/vid-1/line-health/src-1',
      headers: { authorization: await tokenFor('moderator') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('pagination')
    expect(body.pagination).toHaveProperty('total')
  })

  it('响应格式对齐 api-rules.md pagination 信封', async () => {
    mockListLineHealth.mockResolvedValue({ rows: [{ id: 'ev-1' }], total: 1 })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/vid-1/line-health/src-1?page=1&limit=20',
      headers: { authorization: await tokenFor('admin') },
    })
    const body = res.json()
    expect(body.pagination.total).toBe(1)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(20)
  })
})

describe('GET /admin/moderation/:id/audit-log (CHG-SN-4-FIX-C)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockListAuditLogByTarget.mockResolvedValue({ rows: [], total: 0 })
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('未认证返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/vid-1/audit-log',
    })
    expect(res.statusCode).toBe(401)
  })

  it('moderator 返回 200 + pagination 信封', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/vid-1/audit-log',
      headers: { authorization: await tokenFor('moderator') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('pagination')
    expect(body.pagination).toHaveProperty('total')
    expect(body.pagination).toHaveProperty('hasNext')
  })

  it('targetKind 固定为 video，targetId = path :id', async () => {
    await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/vid-42/audit-log?page=2&limit=10',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(mockListAuditLogByTarget).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        targetKind: 'video',
        targetId: 'vid-42',
        page: 2,
        limit: 10,
      }),
    )
  })

  it('返回的 row 字段全部 camelCase（教训自 09d）', async () => {
    mockListAuditLogByTarget.mockResolvedValue({
      rows: [{
        id: '1',
        actorId: 'u-1',
        actorUsername: 'alice',
        actionType: 'video.approve',
        targetKind: 'video',
        targetId: 'vid-1',
        beforeJsonb: null,
        afterJsonb: null,
        requestId: null,
        createdAt: '2026-05-02T00:00:00Z',
      }],
      total: 1,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/vid-1/audit-log',
      headers: { authorization: await tokenFor('admin') },
    })
    const body = res.json()
    expect(body.data[0]).toHaveProperty('actorId')
    expect(body.data[0]).toHaveProperty('actorUsername')
    expect(body.data[0]).toHaveProperty('actionType')
    expect(body.data[0]).toHaveProperty('createdAt')
    expect(body.data[0]).not.toHaveProperty('actor_id')
    expect(body.data[0]).not.toHaveProperty('action_type')
  })

  it('viewer 角色被拒绝（403）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/vid-1/audit-log',
      headers: { authorization: await tokenFor('viewer') },
    })
    expect(res.statusCode).toBe(403)
  })
})
