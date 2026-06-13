/**
 * tests/unit/api/integration-credentials-route.test.ts —
 * ADR-173 §端点契约 3 路由层单测（META-30 / Card B2）
 *
 * 覆盖：GET 列表信封 / PUT 未知 provider → 404 / PUT 正常 → ok / POST test → 结果 / 鉴权门禁。
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

const listMock = vi.fn()
const saveMock = vi.fn()
const testMock = vi.fn()

vi.mock('@/api/services/IntegrationCredentialsService', () => ({
  IntegrationCredentialsService: class {
    listForAdmin = (...a: unknown[]) => listMock(...a)
    save = (...a: unknown[]) => saveMock(...a)
    test = (...a: unknown[]) => testMock(...a)
  },
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const ADMIN_USER_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
})

async function buildApp() {
  const { adminIntegrationCredentialsRoutes } = await import('@/api/routes/admin/integrationCredentials')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminIntegrationCredentialsRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: ADMIN_USER_ID, role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

describe('GET /admin/integrations/credentials', () => {
  it('200 + { data: { providers } }', async () => {
    listMock.mockResolvedValueOnce([{ provider: 'bangumi', label: 'Bangumi', values: {}, configured: false, enabled: true, lastTestedAt: null, lastTestOk: null, lastTestLatencyMs: null, lastTestError: null }])
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/integrations/credentials', headers: adminAuth() })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { providers: unknown[] } }).data.providers).toHaveLength(1)
  })

  it('未鉴权 → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/integrations/credentials' })
    expect(res.statusCode).toBe(401)
  })
})

describe('PUT /admin/integrations/credentials/:provider', () => {
  it('未知 provider → 404（不调 service）', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/integrations/credentials/unknownx',
      headers: adminAuth(),
      payload: { token: 'x' },
    })
    expect(res.statusCode).toBe(404)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('正常 → 200 { data: { ok: true } } + service.save 调用', async () => {
    saveMock.mockResolvedValueOnce(undefined)
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/integrations/credentials/bangumi',
      headers: adminAuth(),
      payload: { token: 'plain', userAgent: 'UA/x' },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { ok: boolean } }).data.ok).toBe(true)
    expect(saveMock).toHaveBeenCalledWith('bangumi', expect.objectContaining({ token: 'plain' }), ADMIN_USER_ID, expect.any(String))
  })
})

describe('POST /admin/integrations/credentials/:provider/test', () => {
  it('200 + 测试结果（draft 透传 service）', async () => {
    testMock.mockResolvedValueOnce({ ok: true, latencyMs: 80, authStatus: 'valid', testedAt: '2026-06-13T00:00:00Z' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/integrations/credentials/tmdb/test',
      headers: adminAuth(),
      payload: { draft: true, token: 'cand' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { ok: boolean; authStatus: string } }
    expect(body.data.ok).toBe(true)
    expect(body.data.authStatus).toBe('valid')
    expect(testMock).toHaveBeenCalledWith('tmdb', expect.objectContaining({ draft: true }), ADMIN_USER_ID, expect.any(String))
  })

  it('未知 provider → 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/integrations/credentials/nope/test', headers: adminAuth(), payload: {} })
    expect(res.statusCode).toBe(404)
  })
})
