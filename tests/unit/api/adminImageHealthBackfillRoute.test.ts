/**
 * tests/unit/api/adminImageHealthBackfillRoute.test.ts — CHORE-09
 *
 * 验证 POST /v1/admin/image-health/backfill：
 * - admin 调用 → 返回 200 + 调 enqueueBackfillJob()
 * - 非 admin（moderator / user）拒绝 → 403
 * - enqueue 抛错 → 500 INTERNAL_ERROR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockEnqueue = vi.fn()
vi.mock('@/api/workers/imageBackfillWorker', () => ({
  enqueueBackfillJob: (...args: unknown[]) => mockEnqueue(...args),
}))

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

async function buildApp() {
  const { adminImageHealthRoutes } = await import('@/api/routes/admin/image-health')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminImageHealthRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('POST /admin/image-health/backfill (CHORE-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue(undefined)
  })

  it('admin → 200 + enqueued=true + 调 enqueueBackfillJob()', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/backfill',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.enqueued).toBe(true)
      expect(body.data.message).toContain('backfill')
      expect(mockEnqueue).toHaveBeenCalledTimes(1)
    } finally {
      await app.close()
    }
  })

  it('moderator → 403 FORBIDDEN（admin only）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/backfill',
        headers: authHeader('moderator'),
      })
      expect(res.statusCode).toBe(403)
      expect(mockEnqueue).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('未认证 → 401', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/backfill',
      })
      expect(res.statusCode).toBe(401)
      expect(mockEnqueue).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('enqueue 抛错 → 500 INTERNAL_ERROR', async () => {
    mockEnqueue.mockRejectedValueOnce(new Error('redis down'))
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/backfill',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(500)
      const body = JSON.parse(res.body)
      expect(body.error.code).toBe('INTERNAL_ERROR')
    } finally {
      await app.close()
    }
  })
})
