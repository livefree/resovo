/**
 * tests/unit/api/admin-image-health-candidates.test.ts — IMGH-P2-1A / ADR-208 D-208-2
 *
 * 验证 GET /admin/image-health/candidates：
 * - admin → 200 + 候选按 trust(CATALOG_SOURCE_PRIORITY) 降序、confidence 次级降序
 * - proposed_value 非串候选防御性剔除
 * - 无候选 → 空数组（不报错）
 * - 参数校验：缺/坏 catalogId 或 field → 400
 * - 非 admin → 403 / 未认证 → 401
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGetByField = vi.fn()
vi.mock('@/api/db/queries/metadata-field-proposals', () => ({
  getFieldProposalsByCatalogIdAndField: (...args: unknown[]) => mockGetByField(...args),
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

const CATALOG = '11111111-1111-1111-1111-111111111111'

function proposal(over: Record<string, unknown> = {}) {
  return {
    catalogId: CATALOG,
    fieldName: 'coverUrl',
    sourceKind: 'douban',
    sourceRef: 'd-1',
    proposedValue: 'https://img.example.com/a.jpg',
    confidence: 0.5,
    isWinner: false,
    applied: false,
    conflictState: null,
    proposedAt: '2026-06-20T00:00:00.000Z',
    ...over,
  }
}

describe('GET /admin/image-health/candidates (IMGH-P2-1A)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('admin → 200 + 候选按 trust 降序、confidence 次级降序', async () => {
    // douban(trust 3) / tmdb(trust 4) / bangumi(trust 4, conf 0.9 > tmdb 0.7)
    mockGetByField.mockResolvedValue([
      proposal({ sourceKind: 'douban', confidence: 0.99 }),
      proposal({ sourceKind: 'tmdb', confidence: 0.7, isWinner: true }),
      proposal({ sourceKind: 'bangumi', confidence: 0.9 }),
    ])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/candidates?catalogId=${CATALOG}&field=coverUrl`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      const { candidates } = JSON.parse(res.body).data
      expect(candidates.map((c: { source: string }) => c.source)).toEqual([
        'bangumi', // trust 4, conf 0.9
        'tmdb',    // trust 4, conf 0.7
        'douban',  // trust 3
      ])
      expect(candidates[0]).toMatchObject({ source: 'bangumi', trust: 4 })
      expect(candidates[2]).toMatchObject({ source: 'douban', trust: 3 })
      // 调用参数透传
      expect(mockGetByField).toHaveBeenCalledWith(expect.anything(), CATALOG, 'coverUrl')
    } finally {
      await app.close()
    }
  })

  it('proposed_value 非串候选被剔除', async () => {
    mockGetByField.mockResolvedValue([
      proposal({ sourceKind: 'tmdb', proposedValue: 'https://ok.example/x.jpg' }),
      proposal({ sourceKind: 'douban', proposedValue: null }),
      proposal({ sourceKind: 'bangumi', proposedValue: { url: 'obj' } }),
      proposal({ sourceKind: 'crawler', proposedValue: '' }),
    ])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/candidates?catalogId=${CATALOG}&field=coverUrl`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      const { candidates } = JSON.parse(res.body).data
      expect(candidates).toHaveLength(1)
      expect(candidates[0].source).toBe('tmdb')
    } finally {
      await app.close()
    }
  })

  it('无候选 → 空数组（不报错）', async () => {
    mockGetByField.mockResolvedValue([])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/candidates?catalogId=${CATALOG}&field=backdropUrl`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data.candidates).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('坏 field → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/candidates?catalogId=${CATALOG}&field=bogus`,
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR')
      expect(mockGetByField).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('非 UUID catalogId → 400', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/image-health/candidates?catalogId=not-uuid&field=coverUrl',
        headers: authHeader('admin'),
      })
      expect(res.statusCode).toBe(400)
      expect(mockGetByField).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('moderator → 403（admin only）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/candidates?catalogId=${CATALOG}&field=coverUrl`,
        headers: authHeader('moderator'),
      })
      expect(res.statusCode).toBe(403)
      expect(mockGetByField).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('未认证 → 401', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/image-health/candidates?catalogId=${CATALOG}&field=coverUrl`,
      })
      expect(res.statusCode).toBe(401)
      expect(mockGetByField).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})
