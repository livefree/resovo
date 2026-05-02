/**
 * moderationMetaEdit.test.ts
 * UX-12: PATCH /admin/moderation/:id/meta — 内联元数据快速编辑
 * P2 fix: 非 pending_review 视频 → 422 NOT_PENDING
 * P2 fix: POST /admin/moderation/:id/douban-ignore
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
const mockUpdateVideoEnrichStatus = vi.fn()

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: (...args: unknown[]) => mockFindAdminVideoById(...args),
  updateVideoEnrichStatus: (...args: unknown[]) => mockUpdateVideoEnrichStatus(...args),
}))

const mockVideoSvcUpdate = vi.fn()

vi.mock('@/api/services/VideoService', () => ({
  VideoService: class {
    update = mockVideoSvcUpdate
  },
}))

vi.mock('@/api/services/DoubanService', () => ({
  DoubanService: class {
    searchByKeyword = vi.fn()
    confirmSubject = vi.fn()
  },
}))

// ── 工具 ─────────────────────────────────────────────────────────

function makePendingVideo(overrides: Record<string, unknown> = {}) {
  return { id: 'vid-1', review_status: 'pending_review', meta_score: 75, ...overrides }
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
  return `Bearer ${await signAccessToken({ userId: 'u-1', role: 'moderator' })}`
}

// ═══════════════════════════════════════════════════════════════
// PATCH /v1/admin/moderation/:id/meta
// ═══════════════════════════════════════════════════════════════

describe('PATCH /v1/admin/moderation/:id/meta', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    // 默认：视频存在且处于 pending_review
    mockFindAdminVideoById.mockResolvedValue(makePendingVideo())
    mockVideoSvcUpdate.mockResolvedValue({ id: 'vid-1' })
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('成功更新标题 → 200 { id, updated: true }', async () => {
    mockVideoSvcUpdate.mockResolvedValue({ id: 'vid-1', title: '新标题' })
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '新标题' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ id: 'vid-1', updated: true })
  })

  it('成功更新 year + type → 200，参数透传正确', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ year: 2020, type: 'series' }),
    })
    expect(res.statusCode).toBe(200)
    expect(mockVideoSvcUpdate).toHaveBeenCalledWith('vid-1', { year: 2020, type: 'series' })
  })

  it('成功更新 genres → 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ genres: ['action', 'sci_fi'] }),
    })
    expect(res.statusCode).toBe(200)
    expect(mockVideoSvcUpdate).toHaveBeenCalledWith('vid-1', { genres: ['action', 'sci_fi'] })
  })

  it('year 为 null 是合法值（清除年份）→ 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ year: null }),
    })
    expect(res.statusCode).toBe(200)
    expect(mockVideoSvcUpdate).toHaveBeenCalledWith('vid-1', { year: null })
  })

  it('视频不存在 → 404 NOT_FOUND', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/not-exist/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '任意' }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('视频非 pending_review → 422 NOT_PENDING（P2 fix）', async () => {
    mockFindAdminVideoById.mockResolvedValue(makePendingVideo({ review_status: 'approved' }))
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '任意' }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('NOT_PENDING')
  })

  it('body 为空对象 → 422 VALIDATION_ERROR（先于 pending_review 校验）', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('title 空字符串 → 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('year 超范围 → 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ year: 1800 }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('type 非法值 → 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'unknown_type' }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('service 抛错 → 500 INTERNAL_ERROR', async () => {
    mockVideoSvcUpdate.mockRejectedValue(new Error('db timeout'))
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '测试标题' }),
    })
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('服务器内部错误')
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '任意' }),
    })
    expect(res.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/admin/moderation/:id/douban-ignore
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/admin/moderation/:id/douban-ignore', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue(makePendingVideo())
    mockUpdateVideoEnrichStatus.mockResolvedValue(undefined)
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('候选视频忽略成功 → 200 { id, ignored: true }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/vid-1/douban-ignore',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ id: 'vid-1', ignored: true })
    expect(mockUpdateVideoEnrichStatus).toHaveBeenCalledWith(
      expect.anything(),
      'vid-1',
      { doubanStatus: 'unmatched', metaScore: 75 }
    )
  })

  it('视频不存在 → 404', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/not-exist/douban-ignore',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(404)
  })

  it('视频非 pending_review → 422 NOT_PENDING', async () => {
    mockFindAdminVideoById.mockResolvedValue(makePendingVideo({ review_status: 'approved' }))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/vid-1/douban-ignore',
      headers: { authorization: authHeader },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('NOT_PENDING')
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/vid-1/douban-ignore',
    })
    expect(res.statusCode).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/admin/moderation/:id/douban-confirm — pending_review 校验（P2 fix）
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/admin/moderation/:id/douban-confirm — pending_review guard', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindAdminVideoById.mockResolvedValue(makePendingVideo())
    app = await buildApp()
    authHeader = await modToken()
  })

  afterEach(() => app.close())

  it('视频非 pending_review → 422 NOT_PENDING（P2 fix）', async () => {
    mockFindAdminVideoById.mockResolvedValue(makePendingVideo({ review_status: 'approved' }))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/vid-1/douban-confirm',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ subjectId: 'db-sub-1' }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('NOT_PENDING')
  })

  it('视频不存在 → 404', async () => {
    mockFindAdminVideoById.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation/not-exist/douban-confirm',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ subjectId: 'db-sub-1' }),
    })
    expect(res.statusCode).toBe(404)
  })
})
