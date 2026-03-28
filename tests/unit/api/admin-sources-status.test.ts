/**
 * admin-sources-status.test.ts — CHG-294
 * PATCH /admin/sources/:id/status + POST /admin/sources/batch-status
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRedisGet, mockSetSourceStatus, mockBatchSetSourceStatus } = vi.hoisted(() => ({
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockSetSourceStatus: vi.fn(),
  mockBatchSetSourceStatus: vi.fn(),
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
  listAdminSources: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  deleteSource: vi.fn(),
  batchDeleteSources: vi.fn(),
  setSourceStatus: mockSetSourceStatus,
  batchSetSourceStatus: mockBatchSetSourceStatus,
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
  updateSourceUrl: vi.fn(),
  countShellVideos: vi.fn(),
  listSubmissions: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  listSourcesForBatchVerify: vi.fn().mockResolvedValue([]),
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

describe('admin source status routes (CHG-294)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockSetSourceStatus.mockResolvedValue(true)
    mockBatchSetSourceStatus.mockResolvedValue(2)
    app = await buildApp()
  })

  it('PATCH /admin/sources/:id/status updates single source status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/sources/src-1/status',
      headers: authHeader('moderator'),
      payload: { isActive: false },
    })

    expect(res.statusCode).toBe(200)
    expect(mockSetSourceStatus).toHaveBeenCalledWith(expect.anything(), 'src-1', false)
    expect(res.json<{ data: { updated: boolean; isActive: boolean } }>()).toEqual({
      data: { updated: true, isActive: false },
    })
  })

  it('PATCH /admin/sources/:id/status returns 404 when source not found', async () => {
    mockSetSourceStatus.mockResolvedValueOnce(false)

    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/sources/src-missing/status',
      headers: authHeader('moderator'),
      payload: { isActive: true },
    })

    expect(res.statusCode).toBe(404)
  })

  it('POST /admin/sources/batch-status updates statuses in batch', async () => {
    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/batch-status',
      headers: authHeader('moderator'),
      payload: { ids, isActive: true },
    })

    expect(res.statusCode).toBe(200)
    expect(mockBatchSetSourceStatus).toHaveBeenCalledWith(expect.anything(), ids, true)
    expect(res.json<{ data: { updated: number; isActive: boolean } }>()).toEqual({
      data: { updated: 2, isActive: true },
    })
  })

  it('POST /admin/sources/batch-status validates payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/batch-status',
      headers: authHeader('moderator'),
      payload: { ids: [], isActive: true },
    })

    expect(res.statusCode).toBe(422)
    expect(mockBatchSetSourceStatus).not.toHaveBeenCalled()
  })

  it('rejects user role', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/sources/src-1/status',
      headers: authHeader('user'),
      payload: { isActive: true },
    })

    expect(res.statusCode).toBe(403)
  })
})
