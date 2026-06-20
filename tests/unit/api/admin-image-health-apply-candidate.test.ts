/**
 * tests/unit/api/admin-image-health-apply-candidate.test.ts — IMGH-P2-1B / ADR-208 D-208-3
 *
 * 验证 POST /admin/image-health/apply-candidate：
 * - admin 成功 → 200 {applied,status} + safeUpdate 复用闸门 + markApplied(best-effort) + 入队 ×2 + 审计载荷
 * - field∈skippedFields → 409 FIELD_LOCKED_OR_LOWER_PRIORITY（含 skippedFields，不静默成功，不入队/不审计）
 * - sourceRef 不符 → 409 CANDIDATE_STALE（safeUpdate 不调用）
 * - 候选查无 → 404 CANDIDATE_NOT_FOUND / 非串值 → 422 INVALID_CANDIDATE_VALUE
 * - 未知 source → 422 INVALID_SOURCE（getByField 不调用）/ catalog 不存在 → 404 CATALOG_NOT_FOUND
 * - 坏 body → 400 / moderator → 403 / 未认证 → 401
 *
 * 守卫：audit payload 内容断言（R-MID-1 / PAYLOAD_ASSERTION_REQUIRED）image_health.apply_candidate
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

const getByFieldMock = vi.hoisted(() => vi.fn())
const markAppliedMock = vi.hoisted(() => vi.fn().mockResolvedValue(1))
vi.mock('@/api/db/queries/metadata-field-proposals', () => ({
  getFieldProposalsByCatalogIdAndField: getByFieldMock,
  markFieldProposalApplied: markAppliedMock,
}))

const insertAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: insertAuditLogMock,
  listAuditLogByTarget: vi.fn(),
  listAdminAuditLog: vi.fn(),
  getAdminAuditLogById: vi.fn(),
}))

const safeUpdateMock = vi.hoisted(() => vi.fn())
vi.mock('@/api/services/MediaCatalogService', () => ({
  MediaCatalogService: vi.fn().mockImplementation(() => ({ safeUpdate: safeUpdateMock })),
  CATALOG_SOURCE_PRIORITY: { manual: 5, tmdb: 4, bangumi: 4, douban: 3, crawler: 1 },
}))

const queueAddMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/lib/queue', () => ({ imageHealthQueue: { add: queueAddMock } }))

vi.mock('@/api/workers/imageBackfillWorker', () => ({
  enqueueBackfillJob: vi.fn().mockResolvedValue(undefined),
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
  mockVerify.mockReturnValue({ userId: 'user-admin-1', role })
  return { Authorization: 'Bearer test-token' }
}

const CATALOG = '11111111-1111-1111-1111-111111111111'
const VIDEO = '22222222-2222-2222-2222-222222222222'

function proposal(over: Record<string, unknown> = {}) {
  return {
    catalogId: CATALOG,
    fieldName: 'coverUrl',
    sourceKind: 'tmdb',
    sourceRef: 'tmdb-1',
    proposedValue: 'https://img.example.com/a.jpg',
    confidence: 0.9,
    isWinner: true,
    applied: false,
    conflictState: null,
    proposedAt: '2026-06-20T00:00:00.000Z',
    ...over,
  }
}

function body(over: Record<string, unknown> = {}) {
  return {
    catalogId: CATALOG,
    videoId: VIDEO,
    field: 'coverUrl',
    source: 'tmdb',
    sourceRef: 'tmdb-1',
    ...over,
  }
}

beforeEach(() => {
  getByFieldMock.mockReset()
  markAppliedMock.mockReset().mockResolvedValue(1)
  insertAuditLogMock.mockReset().mockResolvedValue(undefined)
  safeUpdateMock.mockReset()
  queueAddMock.mockReset().mockResolvedValue(undefined)
})

describe('POST /admin/image-health/apply-candidate (IMGH-P2-1B)', () => {
  it('admin 成功 → 200 + safeUpdate 闸门 + markApplied + 入队 ×2 + 审计 image_health.apply_candidate', async () => {
    getByFieldMock.mockResolvedValue([proposal()])
    safeUpdateMock.mockResolvedValue({ updated: { id: CATALOG }, skippedFields: [] })
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: body(),
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toEqual({ applied: true, status: 'pending_review' })

      // safeUpdate 复用闸门：url + 状态列同源写，source 透传
      expect(safeUpdateMock).toHaveBeenCalledWith(
        CATALOG,
        { coverUrl: 'https://img.example.com/a.jpg', posterStatus: 'pending_review' },
        'tmdb',
        { sourceRef: 'tmdb-1' },
      )
      expect(markAppliedMock).toHaveBeenCalledWith(expect.anything(), CATALOG, 'coverUrl', 'tmdb')
      // 入队 health-check + blurhash-extract，二者均含 videoId
      expect(queueAddMock).toHaveBeenCalledTimes(2)
      expect(queueAddMock).toHaveBeenCalledWith('health-check', {
        type: 'health-check', catalogId: CATALOG, videoId: VIDEO, kind: 'poster', url: 'https://img.example.com/a.jpg',
      })
      expect(queueAddMock).toHaveBeenCalledWith('blurhash-extract', {
        type: 'blurhash-extract', catalogId: CATALOG, videoId: VIDEO, kind: 'poster', url: 'https://img.example.com/a.jpg',
      })
      // 审计载荷断言（R-MID-1 / PAYLOAD_ASSERTION_REQUIRED）
      expect(insertAuditLogMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actionType: 'image_health.apply_candidate',
          targetKind: 'image_health',
          targetId: CATALOG,
          afterJsonb: expect.objectContaining({
            field: 'coverUrl', source: 'tmdb', sourceRef: 'tmdb-1',
            url: 'https://img.example.com/a.jpg', videoId: VIDEO,
          }),
        }),
      )
    } finally {
      await app.close()
    }
  })

  it('field 被锁/优先级不足（∈skippedFields）→ 409 FIELD_LOCKED_OR_LOWER_PRIORITY + 不入队/不审计', async () => {
    getByFieldMock.mockResolvedValue([proposal()])
    safeUpdateMock.mockResolvedValue({ updated: { id: CATALOG }, skippedFields: ['coverUrl'] })
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: body(),
      })
      expect(res.statusCode).toBe(409)
      const parsed = JSON.parse(res.body)
      expect(parsed.error.code).toBe('FIELD_LOCKED_OR_LOWER_PRIORITY')
      expect(parsed.skippedFields).toEqual(['coverUrl'])
      // 不静默成功：不入队、不审计、不 markApplied
      expect(queueAddMock).not.toHaveBeenCalled()
      expect(insertAuditLogMock).not.toHaveBeenCalled()
      expect(markAppliedMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('sourceRef 不符 → 409 CANDIDATE_STALE（safeUpdate 不调用）', async () => {
    getByFieldMock.mockResolvedValue([proposal({ sourceRef: 'tmdb-OLD' })])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: body({ sourceRef: 'tmdb-NEW' }),
      })
      expect(res.statusCode).toBe(409)
      expect(JSON.parse(res.body).error.code).toBe('CANDIDATE_STALE')
      expect(safeUpdateMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('候选查无（无匹配 source）→ 404 CANDIDATE_NOT_FOUND', async () => {
    getByFieldMock.mockResolvedValue([proposal({ sourceKind: 'douban' })])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: body({ source: 'tmdb' }),
      })
      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).error.code).toBe('CANDIDATE_NOT_FOUND')
      expect(safeUpdateMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('候选值非串 → 422 INVALID_CANDIDATE_VALUE', async () => {
    getByFieldMock.mockResolvedValue([proposal({ proposedValue: null })])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: body(),
      })
      expect(res.statusCode).toBe(422)
      expect(JSON.parse(res.body).error.code).toBe('INVALID_CANDIDATE_VALUE')
    } finally {
      await app.close()
    }
  })

  it('未知 source → 422 INVALID_SOURCE（getByField 不调用）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: body({ source: 'wikipedia' }),
      })
      expect(res.statusCode).toBe(422)
      expect(JSON.parse(res.body).error.code).toBe('INVALID_SOURCE')
      expect(getByFieldMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('catalog 不存在（safeUpdate updated=null）→ 404 CATALOG_NOT_FOUND', async () => {
    getByFieldMock.mockResolvedValue([proposal()])
    safeUpdateMock.mockResolvedValue({ updated: null, skippedFields: [] })
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: body(),
      })
      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).error.code).toBe('CATALOG_NOT_FOUND')
    } finally {
      await app.close()
    }
  })

  it('坏 body（缺 videoId）→ 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('admin'),
        payload: { catalogId: CATALOG, field: 'coverUrl', source: 'tmdb', sourceRef: 'tmdb-1' },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR')
      expect(getByFieldMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('moderator → 403（admin only）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        headers: authHeader('moderator'),
        payload: body(),
      })
      expect(res.statusCode).toBe(403)
      expect(safeUpdateMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('未认证 → 401', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/apply-candidate',
        payload: body(),
      })
      expect(res.statusCode).toBe(401)
      expect(safeUpdateMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})
