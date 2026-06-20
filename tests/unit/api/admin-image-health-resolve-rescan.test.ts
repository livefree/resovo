/**
 * tests/unit/api/admin-image-health-resolve-rescan.test.ts — IMGH-P2-1C / ADR-209 D-209-2 + D-209-3
 *
 * 验证 POST /admin/image-health/resolve-event + /rescan-selected：
 * - resolve-event admin 成功 → 200 {resolvedCount} + 服务层 resolveImageEvents(eventIds,note) + 审计载荷
 * - resolve-event resolvedCount=0 → 仍 200（幂等，不报 404）+ 审计仍写
 * - rescan-selected admin 成功 → 200 {updatedCount,enqueuedCount} + scoped 闭环
 *     （getCatalogIdsByVideoIds → rescanPostersByCatalogIds(catalogIds) → listPendingImageUrls(...catalogIds) →
 *       queue.add dedup jobId）+ 审计复用 image_health.rescan
 * - rescan-selected **禁裸调 enqueueBackfillJob 全局扫库**（Codex BLOCK 守卫）
 * - rescan-selected videoIds 解析为空 → updatedCount=0/enqueuedCount=0，不入队，仍 200 + 审计
 * - 坏 body（空数组/非 uuid）→ 400 / moderator → 403 / 未认证 → 401
 *
 * 策略：mock query 层（保留真实 ImageHealthService 跑 scoped 逻辑，断言禁全局副作用）。
 * 守卫：audit payload 内容断言（R-MID-1 / PAYLOAD_ASSERTION_REQUIRED）image_health.resolve_event
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

// query 层 mock：仅覆写 1C 涉及的 4 个函数，其余经 importActual 保留（route 其他端点不在本测范围）
const resolveImageEventsMock = vi.hoisted(() => vi.fn())
const getCatalogIdsMock = vi.hoisted(() => vi.fn())
const rescanByCatalogIdsMock = vi.hoisted(() => vi.fn())
const listPendingMock = vi.hoisted(() => vi.fn())
vi.mock('@/api/db/queries/imageHealth', async (orig) => {
  const actual = await orig<typeof import('@/api/db/queries/imageHealth')>()
  return {
    ...actual,
    resolveImageEvents: resolveImageEventsMock,
    getCatalogIdsByVideoIds: getCatalogIdsMock,
    rescanPostersByCatalogIds: rescanByCatalogIdsMock,
    listPendingImageUrls: listPendingMock,
  }
})

const insertAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: insertAuditLogMock,
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

const queueAddMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/lib/queue', () => ({ imageHealthQueue: { add: queueAddMock } }))

// 禁全局副作用守卫：enqueueBackfillJob 被 mock，断言 rescan-selected 永不调用
const enqueueBackfillJobMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/workers/imageBackfillWorker', () => ({
  enqueueBackfillJob: enqueueBackfillJobMock,
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

const EVT1 = '33333333-3333-3333-3333-333333333331'
const EVT2 = '33333333-3333-3333-3333-333333333332'
const VID1 = '44444444-4444-4444-4444-444444444441'
const VID2 = '44444444-4444-4444-4444-444444444442'
const CAT1 = '55555555-5555-5555-5555-555555555551'

beforeEach(() => {
  resolveImageEventsMock.mockReset()
  getCatalogIdsMock.mockReset()
  rescanByCatalogIdsMock.mockReset()
  listPendingMock.mockReset()
  insertAuditLogMock.mockReset().mockResolvedValue(undefined)
  queueAddMock.mockReset().mockResolvedValue(undefined)
  enqueueBackfillJobMock.mockReset().mockResolvedValue(undefined)
})

describe('POST /admin/image-health/resolve-event (IMGH-P2-1C / D-209-2)', () => {
  it('admin 成功 → 200 {resolvedCount} + 服务转发 + 审计 image_health.resolve_event', async () => {
    resolveImageEventsMock.mockResolvedValue(2)
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/resolve-event',
        headers: authHeader('admin'),
        payload: { eventIds: [EVT1, EVT2], note: '已修复' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toEqual({ resolvedCount: 2 })
      expect(resolveImageEventsMock).toHaveBeenCalledWith(expect.anything(), [EVT1, EVT2], '已修复')
      // 审计载荷断言（PAYLOAD_ASSERTION_REQUIRED）
      expect(insertAuditLogMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actionType: 'image_health.resolve_event',
          targetKind: 'image_health',
          afterJsonb: expect.objectContaining({ eventIds: [EVT1, EVT2], resolvedCount: 2, note: '已修复' }),
        }),
      )
    } finally {
      await app.close()
    }
  })

  it('resolvedCount=0（事件不存在/已解决）→ 仍 200 幂等 + 审计仍写（不报 404）', async () => {
    resolveImageEventsMock.mockResolvedValue(0)
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/resolve-event',
        headers: authHeader('admin'),
        payload: { eventIds: [EVT1] },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toEqual({ resolvedCount: 0 })
      expect(insertAuditLogMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actionType: 'image_health.resolve_event',
          afterJsonb: expect.objectContaining({ resolvedCount: 0, note: null }),
        }),
      )
    } finally {
      await app.close()
    }
  })

  it('空 eventIds 数组 → 400 VALIDATION_ERROR（service 不调用）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/resolve-event',
        headers: authHeader('admin'),
        payload: { eventIds: [] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR')
      expect(resolveImageEventsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('非 uuid eventId → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/resolve-event',
        headers: authHeader('admin'),
        payload: { eventIds: ['not-a-uuid'] },
      })
      expect(res.statusCode).toBe(400)
      expect(resolveImageEventsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('moderator → 403（admin only）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/resolve-event',
        headers: authHeader('moderator'),
        payload: { eventIds: [EVT1] },
      })
      expect(res.statusCode).toBe(403)
      expect(resolveImageEventsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('未认证 → 401', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/resolve-event',
        payload: { eventIds: [EVT1] },
      })
      expect(res.statusCode).toBe(401)
      expect(resolveImageEventsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})

describe('POST /admin/image-health/rescan-selected (IMGH-P2-1C / D-209-3)', () => {
  it('admin 成功 → 200 + scoped 闭环（catalogIds 解析 → scoped 重置 → scoped 入队 dedup）+ 审计 image_health.rescan', async () => {
    getCatalogIdsMock.mockResolvedValue([CAT1])
    rescanByCatalogIdsMock.mockResolvedValue({ updatedCount: 1 })
    listPendingMock.mockResolvedValue([
      { catalogId: CAT1, videoId: VID1, kind: 'poster', url: 'https://img.example.com/p.jpg' },
    ])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/rescan-selected',
        headers: authHeader('admin'),
        payload: { videoIds: [VID1, VID2] },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toEqual({ updatedCount: 1, enqueuedCount: 1 })
      // scoped：解析 videoIds → catalogIds，重置 + listPending 均限定 catalogIds
      expect(getCatalogIdsMock).toHaveBeenCalledWith(expect.anything(), [VID1, VID2])
      expect(rescanByCatalogIdsMock).toHaveBeenCalledWith(expect.anything(), [CAT1])
      expect(listPendingMock).toHaveBeenCalledWith(expect.anything(), expect.any(Number), 0, [CAT1])
      // dedup jobId 复用 worker 语义
      expect(queueAddMock).toHaveBeenCalledWith(
        'health-check',
        { type: 'health-check', catalogId: CAT1, videoId: VID1, kind: 'poster', url: 'https://img.example.com/p.jpg' },
        expect.objectContaining({ jobId: `health-check-${CAT1}-poster` }),
      )
      // **禁全局副作用守卫**：永不裸调 enqueueBackfillJob（Codex BLOCK）
      expect(enqueueBackfillJobMock).not.toHaveBeenCalled()
      // 审计复用 image_health.rescan（scoped 变体载荷）
      expect(insertAuditLogMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actionType: 'image_health.rescan',
          targetKind: 'image_health',
          afterJsonb: expect.objectContaining({
            videoIds: [VID1, VID2], catalogIds: [CAT1], updatedCount: 1, enqueuedCount: 1,
          }),
        }),
      )
    } finally {
      await app.close()
    }
  })

  it('videoIds 解析为空（全软删除/无 catalog）→ updatedCount=0/enqueuedCount=0，不入队，仍 200 + 审计', async () => {
    getCatalogIdsMock.mockResolvedValue([])
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/rescan-selected',
        headers: authHeader('admin'),
        payload: { videoIds: [VID1] },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toEqual({ updatedCount: 0, enqueuedCount: 0 })
      expect(rescanByCatalogIdsMock).not.toHaveBeenCalled()
      expect(listPendingMock).not.toHaveBeenCalled()
      expect(queueAddMock).not.toHaveBeenCalled()
      expect(enqueueBackfillJobMock).not.toHaveBeenCalled()
      expect(insertAuditLogMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actionType: 'image_health.rescan',
          afterJsonb: expect.objectContaining({ catalogIds: [], updatedCount: 0, enqueuedCount: 0 }),
        }),
      )
    } finally {
      await app.close()
    }
  })

  it('空 videoIds 数组 → 400 VALIDATION_ERROR（service 不调用）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/rescan-selected',
        headers: authHeader('admin'),
        payload: { videoIds: [] },
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR')
      expect(getCatalogIdsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('非 uuid videoId → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/rescan-selected',
        headers: authHeader('admin'),
        payload: { videoIds: ['bad'] },
      })
      expect(res.statusCode).toBe(400)
      expect(getCatalogIdsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('moderator → 403（admin only）', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/rescan-selected',
        headers: authHeader('moderator'),
        payload: { videoIds: [VID1] },
      })
      expect(res.statusCode).toBe(403)
      expect(getCatalogIdsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('未认证 → 401', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/image-health/rescan-selected',
        payload: { videoIds: [VID1] },
      })
      expect(res.statusCode).toBe(401)
      expect(getCatalogIdsMock).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})
