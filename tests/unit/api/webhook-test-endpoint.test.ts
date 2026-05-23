/**
 * tests/unit/api/webhook-test-endpoint.test.ts —
 * ADR-146 / CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A POST /admin/webhook/test 单测
 *
 * 覆盖（2 用例）：
 *   #1 URL 未配置 → 422 VALIDATION_ERROR
 *   #2 正常 URL → 200 + 返回 success/httpStatus/latencyMs/error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import { db } from '@/api/lib/postgres'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const mockDbQuery = db.query as ReturnType<typeof vi.fn>

const ADMIN_USER_ID = '11111111-1111-4111-8111-111111111111'

function settingsRows(opts: { enabled?: boolean; url: string; secret?: string; events?: string[] }) {
  return {
    rows: [
      { key: 'notification_webhook_enabled', value: opts.enabled === false ? 'false' : 'true' },
      { key: 'notification_webhook_url', value: opts.url },
      { key: 'notification_webhook_secret', value: opts.secret ?? '' },
      { key: 'notification_webhook_events', value: JSON.stringify(opts.events ?? []) },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

async function buildApp() {
  const { adminWebhookRoutes } = await import('@/api/routes/admin/webhook')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminWebhookRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: ADMIN_USER_ID, role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

describe('POST /admin/webhook/test (ADR-146)', () => {
  it('#1 URL 未配置 → 422 VALIDATION_ERROR', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ url: '' }))
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/webhook/test',
      headers: adminAuth(),
      payload: {},
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    expect(res.json().error.message).toContain('请先')
    await app.close()
  })

  it('#2 正常 https URL → 200 + 返回 success/httpStatus/latencyMs', async () => {
    mockDbQuery.mockResolvedValueOnce(settingsRows({ url: 'https://example.com/webhook' }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/webhook/test',
      headers: adminAuth(),
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({
      success: true,
      httpStatus: 200,
      error: null,
    })
    expect(res.json().data.latencyMs).toBeGreaterThanOrEqual(0)
    await app.close()
  })
})
