/**
 * tests/unit/api/reviewLabelsRoute.test.ts
 * CHG-SN-4-05: GET /admin/review-labels contract test
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

const mockListActiveReviewLabels = vi.fn()
vi.mock('@/api/db/queries/reviewLabels', () => ({
  listActiveReviewLabels: (...args: unknown[]) => mockListActiveReviewLabels(...args),
  findReviewLabelByKey: vi.fn(),
}))

const labelRow = {
  id: 'lbl-1',
  label_key: 'all_dead',
  label: '全线路失效',
  applies_to: 'reject',
  display_order: 1,
  is_active: true,
  created_at: '2026-05-01T00:00:00Z',
}

async function buildApp() {
  const { adminReviewLabelsRoutes } = await import('@/api/routes/admin/reviewLabels')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminReviewLabelsRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'moderator' | 'admin' | 'viewer') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

describe('GET /admin/review-labels', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    vi.clearAllMocks()
    mockListActiveReviewLabels.mockResolvedValue([labelRow])
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('moderator 返回 200 + data 数组', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/review-labels',
      headers: { authorization: await tokenFor('moderator') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0]).toHaveProperty('labelKey', 'all_dead')
  })

  it('未认证 → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/review-labels' })
    expect(res.statusCode).toBe(401)
  })

  it('appliesTo=reject 参数传递给 listActiveReviewLabels', async () => {
    await app.inject({
      method: 'GET',
      url: '/v1/admin/review-labels?appliesTo=reject',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(mockListActiveReviewLabels).toHaveBeenCalledWith(
      expect.anything(),
      'reject',
    )
  })

  it('响应格式包含 labelKey / label / appliesTo / displayOrder', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/review-labels',
      headers: { authorization: await tokenFor('moderator') },
    })
    const item = res.json().data[0]
    expect(item).toHaveProperty('labelKey')
    expect(item).toHaveProperty('label')
    expect(item).toHaveProperty('appliesTo')
    expect(item).toHaveProperty('displayOrder')
    expect(item).toHaveProperty('isActive')
  })
})
