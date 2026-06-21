/**
 * tests/unit/api/admin-image-health-problem-images.test.ts — IMGH-P3-4A / ADR-211
 *
 * 验证 GET /admin/image-health/problem-images（问题图片可视化治理板数据源，supersede ADR-210）：
 * - admin 成功 → 200 { data, total, counts }；默认 kind=poster/scope=published/offset=0/limit=48 透传
 * - total = counts[kind]（省一次 count 查询）；自定义 kind/scope/offset/limit 透传 + total 取对应 kind
 * - 坏 kind / scope / limit(0/超100) / offset(负) → 400 VALIDATION_ERROR，不调 service
 * - moderator → 403 / 未认证 → 401（admin-only，承 ADR-208 域权限）
 *
 * 策略：mock query 层 getProblemImages + getProblemImageCounts（保留真实 ImageHealthService 转发 + route schema 校验）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

const getProblemImagesMock = vi.hoisted(() => vi.fn())
const getProblemImageCountsMock = vi.hoisted(() => vi.fn())
vi.mock('@/api/db/queries/imageHealth', async (orig) => {
  const actual = await orig<typeof import('@/api/db/queries/imageHealth')>()
  return { ...actual, getProblemImages: getProblemImagesMock, getProblemImageCounts: getProblemImageCountsMock }
})

vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
  listAuditLogByTarget: vi.fn(),
  listAdminAuditLog: vi.fn(),
  getAdminAuditLogById: vi.fn(),
}))

vi.mock('@/api/db/queries/metadata-field-proposals', () => ({
  getFieldProposalsByCatalogIdAndField: vi.fn(),
  markFieldProposalApplied: vi.fn(),
}))

vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({ safeUpdate: vi.fn() })),
  CATALOG_SOURCE_PRIORITY: { manual: 5, tmdb: 4, bangumi: 4, douban: 3, crawler: 1 },
}))

vi.mock('@/api/lib/queue', () => ({ imageHealthQueue: { add: vi.fn() } }))
vi.mock('@/api/workers/imageBackfillWorker', () => ({ enqueueBackfillJob: vi.fn() }))

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
  mockVerify.mockReturnValue({ userId: 'user-admin-1', role })
  return { Authorization: 'Bearer test-token' }
}

const ROW = {
  videoId: 'v-1',
  catalogId: 'c-1',
  title: '问题封面',
  isPublished: true,
  kind: 'poster',
  imageUrl: 'https://cdn.example.com/p.jpg',
  status: 'pending_review',
  problemReason: 'broken_event',
  source: 'douban',
  eventType: 'client_load_error',
  brokenDomain: 'cdn.example.com',
  occurrenceCount: 13,
  lastSeenBrokenAt: '2026-06-20T00:00:00.000Z',
}
const COUNTS = { poster: 25, backdrop: 6, logo: 12, banner_backdrop: 0 }

beforeEach(() => {
  getProblemImagesMock.mockReset().mockResolvedValue([ROW])
  getProblemImageCountsMock.mockReset().mockResolvedValue(COUNTS)
})

describe('GET /admin/image-health/problem-images (IMGH-P3-4A / ADR-211)', () => {
  it('admin 成功 → 200 { data, total, counts }；默认 poster/published/0/48 透传 + total=counts.poster', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/problem-images',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data).toEqual([ROW])
      expect(body.counts).toEqual(COUNTS)
      expect(body.total).toBe(25) // counts[poster]
      expect(getProblemImagesMock).toHaveBeenCalledWith(expect.anything(), 'poster', 'published', 0, 48)
      expect(getProblemImageCountsMock).toHaveBeenCalledWith(expect.anything(), 'published')
    } finally {
      await app.close()
    }
  })

  it('自定义 kind=backdrop&scope=all&offset=48&limit=24 透传 + total 取 counts.backdrop', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/problem-images?kind=backdrop&scope=all&offset=48&limit=24',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).total).toBe(6) // counts[backdrop]
      expect(getProblemImagesMock).toHaveBeenCalledWith(expect.anything(), 'backdrop', 'all', 48, 24)
      expect(getProblemImageCountsMock).toHaveBeenCalledWith(expect.anything(), 'all')
    } finally {
      await app.close()
    }
  })

  it('空结果 → 200 { data: [], total: 0 }', async () => {
    getProblemImagesMock.mockResolvedValue([])
    getProblemImageCountsMock.mockResolvedValue({ poster: 0, backdrop: 0, logo: 0, banner_backdrop: 0 })
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/problem-images',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data).toEqual([])
      expect(body.total).toBe(0)
    } finally {
      await app.close()
    }
  })

  it.each(['stills', 'thumbnail', 'cover', ''])('坏 kind=%s → 400，不调 service', async (bad) => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/problem-images?kind=${bad}`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR')
      expect(getProblemImagesMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it.each(['weekly', 'draft'])('坏 scope=%s → 400', async (bad) => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/problem-images?scope=${bad}`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(400)
      expect(getProblemImagesMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it.each(['0', '101', 'abc'])('坏 limit=%s → 400', async (bad) => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/problem-images?limit=${bad}`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(400)
      expect(getProblemImagesMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('坏 offset=-1 → 400', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/problem-images?offset=-1',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(400)
      expect(getProblemImagesMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('moderator → 403（admin-only）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/problem-images',
        headers: authHeader('moderator'),
      })
      expect(res.statusCode).toBe(403)
      expect(getProblemImagesMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('未认证 → 401', async () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid token') })
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/problem-images',
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })
})
