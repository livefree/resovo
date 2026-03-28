/**
 * admin-sources-query.test.ts — CHG-290
 * GET /admin/sources 查询参数扩展：keyword/title/siteKey/sortField/sortDir
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRedisGet, mockListAdminSources } = vi.hoisted(() => ({
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockListAdminSources: vi.fn(),
}))

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: mockRedisGet },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))
vi.mock('@/api/db/queries/sources', () => ({
  listAdminSources: mockListAdminSources,
  deleteSource: vi.fn(),
  batchDeleteSources: vi.fn(),
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
  updateSourceUrl: vi.fn(),
  countShellVideos: vi.fn(),
  listSubmissions: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
}))
vi.mock('@/api/db/queries/subtitles', () => ({
  listAdminSubtitles: vi.fn(),
  approveSubtitle: vi.fn(),
  rejectSubtitle: vi.fn(),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

async function buildApp() {
  const { adminContentRoutes } = await import('@/api/routes/admin/content')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminContentRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'moderator') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('GET /admin/sources (CHG-290)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockListAdminSources.mockResolvedValue({ rows: [], total: 0 })
    app = await buildApp()
  })

  it('supports keyword/title/siteKey/sortField/sortDir params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/sources?status=inactive&page=2&limit=50&keyword=hello&title=world&siteKey=site-a&sortField=video_title&sortDir=asc',
      headers: authHeader('moderator'),
    })

    expect(res.statusCode).toBe(200)
    expect(mockListAdminSources).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        active: 'false',
        page: 2,
        limit: 50,
        keyword: 'hello',
        title: 'world',
        siteKey: 'site-a',
        sortField: 'video_title',
        sortDir: 'asc',
      }),
    )
  })

  it('maps sortField=status to is_active for compatibility', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/sources?sortField=status&sortDir=desc',
      headers: authHeader('moderator'),
    })

    expect(res.statusCode).toBe(200)
    expect(mockListAdminSources).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sortField: 'is_active',
        sortDir: 'desc',
      }),
    )
  })

  it('keeps backward compatibility for active=true when status missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/sources?active=true',
      headers: authHeader('moderator'),
    })

    expect(res.statusCode).toBe(200)
    expect(mockListAdminSources).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ active: 'true' }),
    )
  })

  it('ignores unknown sortField without failing request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/sources?sortField=unknown_column&sortDir=asc',
      headers: authHeader('moderator'),
    })

    expect(res.statusCode).toBe(200)
    expect(mockListAdminSources).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sortField: undefined, sortDir: 'asc' }),
    )
  })

  it('rejects user role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/sources',
      headers: authHeader('user'),
    })

    expect(res.statusCode).toBe(403)
  })
})
