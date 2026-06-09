/**
 * nav-counts-route.test.ts — GET /admin/system/nav-counts route 层（ADR-190 / NTLG-P0-1）
 *
 * 覆盖：
 *   #1 admin → 200 + data/meta 透传 NavCountsService 结果
 *   #2 moderator → role='moderator' 透传给 Service（角色门控由 Service 承担）
 *   #3 无 token → 401（鉴权守卫）
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

const getCountsMock = vi.fn()
vi.mock('@/api/services/NavCountsService', () => ({
  NavCountsService: class {
    getCounts = (...args: unknown[]) => getCountsMock(...args)
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
  const { adminSystemNavCountsRoutes } = await import('@/api/routes/admin/system-nav-counts')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminSystemNavCountsRoutes)
  await app.ready()
  return app
}

function authAs(role: 'admin' | 'moderator') {
  mockVerify.mockReturnValue({ userId: ADMIN_USER_ID, role, iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

describe('GET /admin/system/nav-counts', () => {
  it('#1 admin → 200 + data/meta 透传 Service 结果', async () => {
    getCountsMock.mockResolvedValueOnce({
      counts: { moderation: 484, sources: 1939, imageHealth: 597, userSubmissions: 12, merge: 6 },
      partial: false,
      omitted: [],
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/system/nav-counts', headers: authAs('admin') })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Record<string, number>; meta: { partial: boolean; omitted: string[] } }
    expect(body.data.moderation).toBe(484)
    expect(body.data.merge).toBe(6)
    expect(body.meta).toEqual({ partial: false, omitted: [] })
    expect(getCountsMock).toHaveBeenCalledWith('admin')
    await app.close()
  })

  it('#2 moderator → role 透传 Service + omitted 回显', async () => {
    getCountsMock.mockResolvedValueOnce({
      counts: { moderation: 484, sources: 1939, userSubmissions: 12 },
      partial: true,
      omitted: ['imageHealth', 'merge'],
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/system/nav-counts', headers: authAs('moderator') })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Record<string, number>; meta: { omitted: string[] } }
    expect(body.meta.omitted).toEqual(['imageHealth', 'merge'])
    expect(body.data.imageHealth).toBeUndefined()
    expect(getCountsMock).toHaveBeenCalledWith('moderator')
    await app.close()
  })

  it('#3 无 token → 401', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/system/nav-counts' })
    expect(res.statusCode).toBe(401)
    expect(getCountsMock).not.toHaveBeenCalled()
    await app.close()
  })
})
