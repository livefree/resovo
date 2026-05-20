/**
 * image-health-actions.test.ts — POST /admin/image-health/rescan + switch-fallback-domain
 * （CHG-SN-7-MISC-IMAGE-1 / ADR-135）
 *
 * 守卫：audit payload 内容断言（R-MID-1 / PAYLOAD_ASSERTION_REQUIRED）
 *   - image_health.rescan
 *   - image_health.switch_domain
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))

const insertAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: insertAuditLogMock,
  listAuditLogByTarget: vi.fn(),
  listAdminAuditLog: vi.fn(),
  getAdminAuditLogById: vi.fn(),
}))

const rescanPostersMock = vi.hoisted(() => vi.fn())
const switchFallbackDomainMock = vi.hoisted(() => vi.fn())
vi.mock('@/api/db/queries/imageHealth', () => ({
  getImageHealthStats: vi.fn(),
  getTopBrokenDomains: vi.fn(),
  listMissingPosterVideos: vi.fn(),
  getBrokenEventsTrend: vi.fn(),
  rescanPosters: rescanPostersMock,
  switchFallbackDomain: switchFallbackDomainMock,
}))

const enqueueBackfillJobMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/workers/imageBackfillWorker', () => ({
  enqueueBackfillJob: enqueueBackfillJobMock,
}))

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn(), scan: vi.fn() },
}))

vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
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

function adminHeaders() {
  mockVerify.mockReturnValue({ userId: 'user-admin-1', role: 'admin' })
  return { Authorization: 'Bearer test-token' }
}

beforeEach(() => {
  insertAuditLogMock.mockReset().mockResolvedValue(undefined)
  rescanPostersMock.mockReset()
  switchFallbackDomainMock.mockReset()
  enqueueBackfillJobMock.mockReset().mockResolvedValue(undefined)
})

describe('POST /admin/image-health/rescan（ADR-135）', () => {
  it('默认 scope=broken_only → 200 + 写 audit log image_health.rescan', async () => {
    rescanPostersMock.mockResolvedValueOnce({ updatedCount: 5 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/image-health/rescan',
      headers: adminHeaders(),
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: { updatedCount: number; enqueued: boolean; scope: string } }
    expect(body.data.updatedCount).toBe(5)
    expect(body.data.enqueued).toBe(true)
    expect(body.data.scope).toBe('broken_only')
    expect(enqueueBackfillJobMock).toHaveBeenCalled()
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'image_health.rescan',
        targetKind: 'image_health',
        afterJsonb: expect.objectContaining({ scope: 'broken_only', updatedCount: 5, enqueued: true }),
      }),
    )
  })

  it('scope=all → 传 all 到 rescanPosters', async () => {
    rescanPostersMock.mockResolvedValueOnce({ updatedCount: 100 })
    const app = await buildApp()
    await app.inject({
      method: 'POST',
      url: '/admin/image-health/rescan',
      headers: adminHeaders(),
      payload: { scope: 'all' },
    })
    expect(rescanPostersMock).toHaveBeenCalledWith(expect.anything(), 'all')
  })

  it('非法 scope → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/image-health/rescan',
      headers: adminHeaders(),
      payload: { scope: 'invalid' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /admin/image-health/switch-fallback-domain（ADR-135）', () => {
  const SWITCH_RESULT = {
    dryRun: true,
    affectedRows: 10,
    affectedColumns: 2,
    breakdown: { cover_url: 8, backdrop_url: 2, banner_backdrop_url: 0 },
  }

  it('dryRun=true（默认）→ 200 + 不写 audit log', async () => {
    switchFallbackDomainMock.mockResolvedValueOnce(SWITCH_RESULT)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/image-health/switch-fallback-domain',
      headers: adminHeaders(),
      payload: { fromDomain: 'old.cdn.com', toDomain: 'new.cdn.com', dryRun: true },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: typeof SWITCH_RESULT }
    expect(body.data.dryRun).toBe(true)
    expect(body.data.affectedRows).toBe(10)
    // dryRun=true 不写 audit
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })

  it('dryRun=false → 200 + 写 audit log image_health.switch_domain', async () => {
    const execResult = { ...SWITCH_RESULT, dryRun: false }
    switchFallbackDomainMock.mockResolvedValueOnce(execResult)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/image-health/switch-fallback-domain',
      headers: adminHeaders(),
      payload: { fromDomain: 'old.cdn.com', toDomain: 'new.cdn.com', dryRun: false },
    })
    expect(res.statusCode).toBe(200)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'image_health.switch_domain',
        targetKind: 'image_health',
        afterJsonb: expect.objectContaining({
          fromDomain: 'old.cdn.com',
          toDomain: 'new.cdn.com',
          dryRun: false,
          affectedRows: 10,
        }),
      }),
    )
  })

  it('dryRun 默认为 true（省略参数）→ 不写 audit', async () => {
    switchFallbackDomainMock.mockResolvedValueOnce(SWITCH_RESULT)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/image-health/switch-fallback-domain',
      headers: adminHeaders(),
      payload: { fromDomain: 'old.cdn.com', toDomain: 'new.cdn.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })

  it('缺 fromDomain → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/image-health/switch-fallback-domain',
      headers: adminHeaders(),
      payload: { toDomain: 'new.cdn.com' },
    })
    expect(res.statusCode).toBe(400)
  })
})
