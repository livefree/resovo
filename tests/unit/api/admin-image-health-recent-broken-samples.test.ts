/**
 * tests/unit/api/admin-image-health-recent-broken-samples.test.ts — IMGH-P3-1A / ADR-210
 *
 * 验证 GET /admin/image-health/recent-broken-samples（破损样本区数据源，事件流口径）：
 * - admin 成功 → 200 { data: BrokenSampleRow[] } + 服务层 getRecentBrokenSamples(limit) 透传
 * - 无 limit → 默认 24（对齐前端 MAX_SAMPLES）；自定义 limit 透传
 * - 坏 limit（0 / 负 / 非数 / 超 50）→ 400 VALIDATION_ERROR
 * - moderator → 403 / 未认证 → 401（admin-only，承 ADR-208 域权限）
 *
 * 策略：mock query 层 getRecentBrokenSamples（保留真实 ImageHealthService 转发 + route schema 校验）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

const getRecentBrokenSamplesMock = vi.hoisted(() => vi.fn())
vi.mock('@/api/db/queries/imageHealth', async (orig) => {
  const actual = await orig<typeof import('@/api/db/queries/imageHealth')>()
  return { ...actual, getRecentBrokenSamples: getRecentBrokenSamplesMock }
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

const SAMPLE = {
  videoId: 'v-1',
  catalogId: 'c-1',
  title: '破损样本',
  posterUrl: 'https://cdn.example.com/p.jpg',
  posterSource: 'tmdb',
  posterStatus: 'pending_review',
  eventType: 'fetch_404',
  brokenDomain: 'cdn.example.com',
  occurrenceCount: 3,
  lastSeenBrokenAt: '2026-06-20T00:00:00.000Z',
}

beforeEach(() => {
  getRecentBrokenSamplesMock.mockReset().mockResolvedValue([SAMPLE])
})

describe('GET /admin/image-health/recent-broken-samples (IMGH-P3-1A / ADR-210)', () => {
  it('admin 成功 → 200 { data } + 默认 limit 24 透传', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/recent-broken-samples',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toEqual([SAMPLE])
      expect(getRecentBrokenSamplesMock).toHaveBeenCalledWith(expect.anything(), 24)
    } finally {
      await app.close()
    }
  })

  it('自定义 limit 透传 service', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/recent-broken-samples?limit=10',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      expect(getRecentBrokenSamplesMock).toHaveBeenCalledWith(expect.anything(), 10)
    } finally {
      await app.close()
    }
  })

  it('空结果 → 200 { data: [] }（破损样本区据此显示「暂无破损样本」）', async () => {
    getRecentBrokenSamplesMock.mockResolvedValue([])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/recent-broken-samples',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toEqual([])
    } finally {
      await app.close()
    }
  })

  it.each(['0', '-1', 'abc', '999'])('坏 limit=%s → 400 VALIDATION_ERROR，不调 service', async (bad) => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/recent-broken-samples?limit=${bad}`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR')
      expect(getRecentBrokenSamplesMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('moderator → 403（admin-only）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/recent-broken-samples',
        headers: authHeader('moderator'),
      })
      expect(res.statusCode).toBe(403)
      expect(getRecentBrokenSamplesMock).not.toHaveBeenCalled()
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
        url: '/admin/image-health/recent-broken-samples',
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })
})
