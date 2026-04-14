/**
 * moderationBatch.test.ts
 * UX-13: POST /admin/moderation/batch-approve
 *         POST /admin/moderation/batch-reject
 *         GET  /admin/moderation/history
 *         POST /admin/moderation/:id/reopen
 * CHG-387: batch-reject 需 reason；approve_and_publish 仅 admin（由 videos.ts 测试保障）
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

const mockFindAdminVideoById = vi.fn()
const mockTransitionVideoState = vi.fn()

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: (...args: unknown[]) => mockFindAdminVideoById(...args),
  transitionVideoState: (...args: unknown[]) => mockTransitionVideoState(...args),
  updateVideoEnrichStatus: vi.fn(),
}))

const mockListModerationHistory = vi.fn()

vi.mock('@/api/db/queries/moderation', () => ({
  listModerationHistory: (...args: unknown[]) => mockListModerationHistory(...args),
}))

vi.mock('@/api/services/VideoService', () => ({
  VideoService: class {
    update = vi.fn()
  },
}))

vi.mock('@/api/services/DoubanService', () => ({
  DoubanService: class {
    searchByKeyword = vi.fn()
    confirmSubject = vi.fn()
  },
}))

// ── 工具 ─────────────────────────────────────────────────────────

function makePendingVideo(id: string, overrides: Record<string, unknown> = {}) {
  return { id, review_status: 'pending_review', meta_score: 80, ...overrides }
}

async function buildApp() {
  const { adminModerationRoutes } = await import('@/api/routes/admin/moderation')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminModerationRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function modToken() {
  return `Bearer ${await signAccessToken({ userId: 'u-mod', role: 'moderator' })}`
}

// ═══════════════════════════════════════════════════════════════
// POST /v1/admin/moderation/batch-approve
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/admin/moderation/batch-approve', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    // 默认：状态迁移成功（返回迁移结果对象）
    mockTransitionVideoState.mockResolvedValue({ id: 'v1', review_status: 'approved' })
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('全部通过 → 200 { approved, skipped, failed }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1', 'v2', 'v3'] }),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.approved).toBe(3)
    expect(body.data.skipped).toBe(0)
    expect(body.data.failed).toBe(0)
    expect(mockTransitionVideoState).toHaveBeenCalledTimes(3)
    expect(mockTransitionVideoState).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
      { action: 'approve', reviewedBy: 'u-mod' }
    )
  })

  it('STATE_CONFLICT → 计入 skipped，不失败', async () => {
    mockTransitionVideoState
      .mockResolvedValueOnce({ id: 'v1', review_status: 'approved' })
      .mockRejectedValueOnce(new Error('STATE_CONFLICT'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1', 'v2'] }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ approved: 1, skipped: 1, failed: 0 })
  })

  it('transitionVideoState 返回 null → 计入 skipped', async () => {
    mockTransitionVideoState.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'] }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ approved: 0, skipped: 1, failed: 0 })
  })

  it('意外错误 → 计入 failed', async () => {
    mockTransitionVideoState.mockRejectedValue(new Error('db timeout'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'] }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ approved: 0, skipped: 0, failed: 1 })
  })

  it('ids 为空数组 → 422 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('超出 50 条 → 422', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `v${i}`)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-approve',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'] }),
    })
    expect(res.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/admin/moderation/batch-reject
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/admin/moderation/batch-reject', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockTransitionVideoState.mockResolvedValue({ id: 'v1', review_status: 'rejected' })
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('全部拒绝 → 200 { rejected, skipped, failed }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1', 'v2'], reason: '画质异常' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ rejected: 2, skipped: 0, failed: 0 })
    expect(mockTransitionVideoState).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
      { action: 'reject', reason: '画质异常', reviewedBy: 'u-mod' }
    )
  })

  it('reason 缺失 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'] }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('reason 空字符串 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'], reason: '' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('ids 为空数组 → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [], reason: '原因' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/batch-reject',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['v1'], reason: '原因' }),
    })
    expect(res.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════
// GET /v1/admin/moderation/history
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/admin/moderation/history', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  const mockRows = [
    {
      id: 'v1', title: '测试视频', type: 'movie', year: 2024, cover_url: null,
      review_status: 'approved', reviewed_at: '2026-04-01T12:00:00Z',
      reviewed_by: 'u-mod', review_reason: null,
      douban_status: 'matched', source_check_status: 'ok', meta_score: 85,
      created_at: '2026-03-30T00:00:00Z',
    },
  ]

  beforeEach(async () => {
    vi.clearAllMocks()
    mockListModerationHistory.mockResolvedValue({ rows: mockRows, total: 1 })
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('返回历史列表 → 200 { data, total }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/history',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('v1')
  })

  it('传入 result=approved 过滤参数', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/history?result=approved&type=movie',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    expect(mockListModerationHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ result: 'approved', type: 'movie' })
    )
  })

  it('非法 result 值被忽略（undefined）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/history?result=unknown',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    expect(mockListModerationHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ result: undefined })
    )
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/moderation/history',
    })
    expect(res.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/admin/moderation/:id/reopen
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/admin/moderation/:id/reopen', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue({ id: 'v1', review_status: 'rejected', meta_score: 70 })
    mockTransitionVideoState.mockResolvedValue({ id: 'v1', review_status: 'pending_review' })
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('成功复审 → 200 { id, reopened: true }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/v1/reopen',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ id: 'v1', reopened: true })
    expect(mockTransitionVideoState).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
      { action: 'reopen_pending' }
    )
  })

  it('视频不存在 → 404', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/not-exist/reopen',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('视频非 rejected → 422 NOT_REJECTED', async () => {
    mockFindAdminVideoById.mockResolvedValue({ id: 'v1', review_status: 'pending_review', meta_score: 70 })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/v1/reopen',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('NOT_REJECTED')
  })

  it('transition 抛错 → 500', async () => {
    mockTransitionVideoState.mockRejectedValue(new Error('db error'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/v1/reopen',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(500)
    expect(res.json().error.code).toBe('INTERNAL_ERROR')
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/v1/reopen',
    })
    expect(res.statusCode).toBe(401)
  })
})
