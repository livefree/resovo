/**
 * moderationMetaEdit.test.ts
 * UX-12: PATCH /admin/moderation/:id/meta — 内联元数据快速编辑
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

vi.mock('@/api/db/queries/videos', () => ({
  findAdminVideoById: vi.fn(),
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

// ── App builder ───────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────

describe('PATCH /v1/admin/moderation/:id/meta', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authHeader: string

  beforeEach(async () => {
    vi.clearAllMocks()
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
    const body = res.json()
    expect(body.data).toEqual({ id: 'vid-1', updated: true })
  })

  it('成功更新 year + type → 200', async () => {
    mockVideoSvcUpdate.mockResolvedValue({ id: 'vid-1' })
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
    mockVideoSvcUpdate.mockResolvedValue({ id: 'vid-1' })
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ genres: ['action', 'sci_fi'] }),
    })
    expect(res.statusCode).toBe(200)
    expect(mockVideoSvcUpdate).toHaveBeenCalledWith('vid-1', { genres: ['action', 'sci_fi'] })
  })

  it('视频不存在 → 404', async () => {
    mockVideoSvcUpdate.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/not-exist/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '任意' }),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('body 为空对象 → 422 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('body 字段格式非法（title 过短）→ 422', async () => {
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
    expect(body.error.message).toContain('db timeout')
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

  it('year 为 null 是合法值（清除年份）→ 200', async () => {
    mockVideoSvcUpdate.mockResolvedValue({ id: 'vid-1' })
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/moderation/vid-1/meta',
      headers: { authorization: authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ year: null }),
    })
    expect(res.statusCode).toBe(200)
    expect(mockVideoSvcUpdate).toHaveBeenCalledWith('vid-1', { year: null })
  })
})
