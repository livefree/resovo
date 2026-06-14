/**
 * adminSearchRoute.test.ts — GET /admin/search 路由层单测（ADR-200 §端点契约）
 *
 * 覆盖：q 校验 422 / admin·moderator 角色映射 / ADR-110 {data} 信封 / requireRole 403 拦截
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }))

vi.mock('@/api/lib/elasticsearch', () => ({ es: {}, ES_INDEX: 'resovo_videos' }))
vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/services/AdminSearchService', () => ({
  AdminSearchService: vi.fn().mockImplementation(() => ({ search: mockSearch })),
}))
vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import type { UserRole } from '@/types'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

async function buildApp() {
  const { adminSearchRoutes } = await import('@/api/routes/admin/search')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminSearchRoutes)
  await app.ready()
  return app
}

function asUser(role: UserRole) {
  mockVerify.mockReturnValue({ userId: 'u1', role, iat: Math.floor(Date.now() / 1000) })
}

describe('GET /admin/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearch.mockResolvedValue({ query: 'x', groups: [] })
  })

  it('q 缺失 → 422 VALIDATION_ERROR', async () => {
    asUser('admin')
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/search', headers: { authorization: 'Bearer t' } })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
    await app.close()
  })

  it('admin → service role=admin + limit 透传 + ADR-110 {data} 信封', async () => {
    asUser('admin')
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/search?q=abc&limit=5', headers: { authorization: 'Bearer t' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ data: { query: 'x', groups: [] } })
    expect(mockSearch).toHaveBeenCalledWith('abc', { limit: 5, role: 'admin' })
    await app.close()
  })

  it('moderator → service role=moderator + 默认 limit=8', async () => {
    asUser('moderator')
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/admin/search?q=abc', headers: { authorization: 'Bearer t' } })
    expect(mockSearch).toHaveBeenCalledWith('abc', { limit: 8, role: 'moderator' })
    await app.close()
  })

  it('普通 user 角色 → 403 FORBIDDEN（requireRole 拦截，不调 service）', async () => {
    asUser('user')
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/search?q=abc', headers: { authorization: 'Bearer t' } })
    expect(res.statusCode).toBe(403)
    expect(mockSearch).not.toHaveBeenCalled()
    await app.close()
  })
})
