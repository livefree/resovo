/**
 * tests/unit/api/sources-verify.test.ts
 * CHG-287: POST /admin/sources/:id/verify — 同步验证返回结果，权限检查，404 处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRedisGet, mockVerifySource, mockBatchVerifySources } = vi.hoisted(() => ({
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockVerifySource: vi.fn(),
  mockBatchVerifySources: vi.fn(),
}))

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/services/CrawlerService', () => ({
  CrawlerService: vi.fn(() => ({})),
}))
vi.mock('@/api/services/ContentService', () => ({
  ContentService: vi.fn().mockImplementation(() => ({
    verifySource: mockVerifySource,
    batchVerifySources: mockBatchVerifySources,
  })),
}))
vi.mock('@/api/db/queries/crawlerTasks', () => ({
  listTasks: vi.fn(),
  listTasksByRunId: vi.fn(),
  cancelPendingTasksByRun: vi.fn(),
  requestCancelRunningTasksByRun: vi.fn(),
  cancelAllActiveTasks: vi.fn(),
  findActiveTaskBySite: vi.fn(),
  getLatestTaskBySite: vi.fn(),
  getLatestTasksBySites: vi.fn(),
  getCrawlerOverview: vi.fn(),
  countOrphanActiveTasks: vi.fn(),
  markStalePendingTasks: vi.fn(),
}))
vi.mock('@/api/db/queries/crawlerSites', () => ({
  findCrawlerSite: vi.fn(),
  listCrawlerSites: vi.fn().mockResolvedValue([]),
  listEnabledCrawlerSites: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/db/queries/crawlerRuns', () => ({
  requestCancelAllActiveRuns: vi.fn().mockResolvedValue({ count: 0, runIds: [] }),
  syncRunStatusFromTasks: vi.fn(),
  listRuns: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getRunById: vi.fn(),
  updateRunControlStatus: vi.fn(),
}))
vi.mock('@/api/db/queries/crawlerTaskLogs', () => ({
  createCrawlerTaskLog: vi.fn(),
  listCrawlerTaskLogs: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn().mockImplementation(() => ({
    createAndEnqueueRun: vi.fn().mockResolvedValue({
      runId: 'run-1',
      taskIds: ['task-1'],
      enqueuedSiteKeys: ['site-a'],
      skippedSiteKeys: [],
    }),
  })),
}))
vi.mock('@/api/db/queries/systemSettings', () => ({
  getAutoCrawlConfig: vi.fn(),
  setAutoCrawlConfig: vi.fn(),
  setSetting: vi.fn(),
  getSetting: vi.fn(),
}))
vi.mock('@/api/lib/queue', () => ({
  crawlerQueue: { getRepeatableJobs: vi.fn().mockResolvedValue([]), removeRepeatableByKey: vi.fn() },
}))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: mockRedisGet },
}))
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
  const { adminCrawlerRoutes } = await import('@/api/routes/admin/crawler')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminCrawlerRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'moderator') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('POST /admin/sources/:id/verify (CHG-287)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockVerifySource.mockResolvedValue({ isActive: true, responseMs: 120, statusCode: 200 })
    mockBatchVerifySources.mockResolvedValue({
      scope: 'video',
      videoId: '11111111-1111-4111-8111-111111111111',
      siteKey: null,
      activeOnly: true,
      totalMatched: 2,
      processed: 2,
      activated: 1,
      inactivated: 1,
      timeout: 0,
      failed: 0,
      durationMs: 25,
    })
    app = await buildApp()
  })

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/sources/src-1/verify' })
    expect(res.statusCode).toBe(401)
  })

  it('普通用户（user）返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader('user'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('源不存在返回 404', async () => {
    mockVerifySource.mockResolvedValueOnce(null)
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/nonexistent/verify',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
    expect(mockVerifySource).toHaveBeenCalledWith('nonexistent')
  })

  it('验证成功返回 200，同步响应包含验证结果', async () => {
    mockVerifySource.mockResolvedValueOnce({ isActive: false, responseMs: 876, statusCode: 503 })

    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader(),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { isActive: boolean; responseMs: number; statusCode: number | null } }>()
    expect(body.data).toEqual({ isActive: false, responseMs: 876, statusCode: 503 })
    expect(mockVerifySource).toHaveBeenCalledWith('src-1')
  })

  it('moderator 权限可以验证（不只限 admin）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/src-1/verify',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('POST /admin/sources/batch-verify (CHG-292)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockVerifySource.mockResolvedValue({ isActive: true, responseMs: 120, statusCode: 200 })
    mockBatchVerifySources.mockResolvedValue({
      scope: 'video_site',
      videoId: '11111111-1111-4111-8111-111111111111',
      siteKey: 'site-a',
      activeOnly: true,
      totalMatched: 3,
      processed: 3,
      activated: 2,
      inactivated: 1,
      timeout: 1,
      failed: 0,
      durationMs: 66,
    })
    app = await buildApp()
  })

  it('scope=video 缺少 videoId 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/batch-verify',
      headers: authHeader('moderator'),
      payload: { scope: 'video' },
    })

    expect(res.statusCode).toBe(422)
    expect(mockBatchVerifySources).not.toHaveBeenCalled()
  })

  it('scope=site 缺少 siteKey 返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/batch-verify',
      headers: authHeader('moderator'),
      payload: { scope: 'site' },
    })

    expect(res.statusCode).toBe(422)
    expect(mockBatchVerifySources).not.toHaveBeenCalled()
  })

  it('按 video+site 批量验证返回摘要', async () => {
    const payload = {
      scope: 'video_site',
      videoId: '11111111-1111-4111-8111-111111111111',
      siteKey: 'site-a',
      activeOnly: true,
      limit: 120,
    }
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sources/batch-verify',
      headers: authHeader('moderator'),
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(mockBatchVerifySources).toHaveBeenCalledWith(payload)
    const body = res.json<{ data: { totalMatched: number; processed: number; timeout: number } }>()
    expect(body.data.totalMatched).toBe(3)
    expect(body.data.processed).toBe(3)
    expect(body.data.timeout).toBe(1)
  })
})
