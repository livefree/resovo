/**
 * tests/unit/api/sources-verify.test.ts
 * CHG-287: POST /admin/sources/:id/verify — 同步验证返回结果，权限检查，404 处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRedisGet, mockVerifySource } = vi.hoisted(() => ({
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockVerifySource: vi.fn(),
}))

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/services/CrawlerService', () => ({
  CrawlerService: vi.fn(() => ({})),
  parseCrawlerSources: vi.fn(),
}))
vi.mock('@/api/services/ContentService', () => ({
  ContentService: vi.fn().mockImplementation(() => ({
    verifySource: mockVerifySource,
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
