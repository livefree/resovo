/**
 * crawler-dashboard-audit.test.ts — Crawler 重做 4 端点测试
 * CHG-SN-7-REDO-01-B / ADR-122 / ADR-121 4 文件框架（复用 actionType 降级版）
 *
 * 覆盖：
 *   - GET    /admin/crawler/kpi               → happy + 401
 *   - GET    /admin/crawler/timeline          → happy + 422 (range 非法) + 401
 *   - POST   /admin/crawler/sites/:key/run    → audit + 404 + 422 + 503
 *   - POST   /admin/crawler/run-all           → audit + 422 + 503
 *
 * audit 验证（ADR-121 7→4 文件框架）：
 *   - actionType: 'crawler.run_create'（复用，不扩 actionType union）
 *   - targetKind: 'crawler_site'（sites/:key/run）/ 'system'（run-all）
 *   - afterJsonb.triggerType: 'single' / 'all' 区分
 *   - 422 / 404 / 503 错误路径不写 audit
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/config', () => ({
  config: {
    POSTGRES_HOST: 'localhost', POSTGRES_PORT: 5432, POSTGRES_DB: 'test',
    POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test',
    REDIS_HOST: 'localhost', REDIS_PORT: 6379,
    JWT_SECRET: 'test', JWT_REFRESH_SECRET: 'test',
    ES_HOST: 'http://localhost:9200',
    NODE_ENV: 'test',
    POSTGRES_POOL_MIN: 1, POSTGRES_POOL_MAX: 1,
  },
}))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

// queries mocks
const mockGetCrawlerKpi = vi.fn()
vi.mock('@/api/db/queries/crawlerKpi', () => ({
  getCrawlerKpi: mockGetCrawlerKpi,
}))

const mockGetCrawlerTimeline = vi.fn()
vi.mock('@/api/db/queries/crawlerTimeline', () => ({
  getCrawlerTimeline: mockGetCrawlerTimeline,
}))

const mockFindCrawlerSite = vi.fn()
vi.mock('@/api/db/queries/crawlerSites', () => ({
  findCrawlerSite: mockFindCrawlerSite,
}))

// CrawlerRunService mock
const mockCreateAndEnqueueRun = vi.fn()
vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn(() => ({ createAndEnqueueRun: mockCreateAndEnqueueRun })),
}))

// audit log mock
const insertAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: insertAuditLogMock,
  listAuditLogByTarget: vi.fn(),
  listAdminAuditLog: vi.fn(),
  getAdminAuditLogById: vi.fn(),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

async function buildApp() {
  const { adminCrawlerDashboardRoutes } = await import('@/api/routes/admin/crawlerDashboard')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminCrawlerDashboardRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'admin' | 'viewer' = 'admin') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

beforeEach(() => {
  insertAuditLogMock.mockClear()
  mockGetCrawlerKpi.mockReset()
  mockGetCrawlerTimeline.mockReset()
  mockFindCrawlerSite.mockReset()
  mockCreateAndEnqueueRun.mockReset()
})

// ── GET /admin/crawler/kpi ───────────────────────────────────────

describe('GET /admin/crawler/kpi', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('admin 拉取 → 200 + CrawlerKpiResponse 全字段', async () => {
    mockGetCrawlerKpi.mockResolvedValueOnce({
      totalSites: 40, healthySites: 33, runningSites: 7, failedSites: 7,
      batchVideoCount: 649, batchVideoDelta: 47, avgDurationSeconds: 60,
      siteStats: [{ key: 'iqiy', routeCount: 2, health: 97 }],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/crawler/kpi',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { totalSites: number; siteStats: unknown[] } }
    expect(body.data.totalSites).toBe(40)
    expect(body.data.siteStats).toHaveLength(1)
    expect(mockGetCrawlerKpi).toHaveBeenCalledOnce()
  })

  it('无 token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/crawler/kpi' })
    expect(res.statusCode).toBe(401)
    expect(mockGetCrawlerKpi).not.toHaveBeenCalled()
  })
})

// ── GET /admin/crawler/timeline ──────────────────────────────────

describe('GET /admin/crawler/timeline', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('range=1h limit=8（默认） → 200', async () => {
    mockGetCrawlerTimeline.mockResolvedValueOnce({
      rangeStart: '2026-05-18T00:00:00.000Z',
      rangeEnd: '2026-05-18T01:00:00.000Z',
      ticks: [],
      rows: [],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/crawler/timeline',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(200)
    expect(mockGetCrawlerTimeline).toHaveBeenCalledWith(expect.anything(), '1h', 8)
  })

  it('range=30m limit=20 显式 → 200', async () => {
    mockGetCrawlerTimeline.mockResolvedValueOnce({
      rangeStart: 'x', rangeEnd: 'y', ticks: [], rows: [],
    })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/crawler/timeline?range=30m&limit=20',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(200)
    expect(mockGetCrawlerTimeline).toHaveBeenCalledWith(expect.anything(), '30m', 20)
  })

  it('range=invalid → 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/crawler/timeline?range=12h',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(422)
    expect(mockGetCrawlerTimeline).not.toHaveBeenCalled()
  })

  it('limit > 20 → 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/crawler/timeline?limit=100',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(422)
  })
})

// ── POST /admin/crawler/sites/:key/run ───────────────────────────

describe('POST /admin/crawler/sites/:key/run — audit `crawler.run_create` targetKind=crawler_site', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  const RUN_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('admin 触发 → 202 + audit afterJsonb.triggerType=single', async () => {
    mockFindCrawlerSite.mockResolvedValueOnce({ key: 'iqiy', name: '爱奇艺' })
    mockCreateAndEnqueueRun.mockResolvedValueOnce({
      runId: RUN_ID,
      taskIds: ['t1'],
      enqueuedSiteKeys: ['iqiy'],
      skippedSiteKeys: [],
    })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/sites/iqiy/run',
      headers: { authorization: await tokenFor('admin') },
      payload: { mode: 'incremental' },
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(202)
    expect(mockCreateAndEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: 'single',
        mode: 'incremental',
        siteKeys: ['iqiy'],
      }),
    )
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.run_create',
        targetKind: 'crawler_site',
        targetId: 'iqiy',
        afterJsonb: expect.objectContaining({
          triggerType: 'single',
          mode: 'incremental',
          siteKeys: ['iqiy'],
          runId: RUN_ID,
        }),
      }),
    )
  })

  it('mode 缺省 → 默认 incremental + 202', async () => {
    mockFindCrawlerSite.mockResolvedValueOnce({ key: 'iqiy' })
    mockCreateAndEnqueueRun.mockResolvedValueOnce({
      runId: RUN_ID, taskIds: [], enqueuedSiteKeys: ['iqiy'], skippedSiteKeys: [],
    })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/sites/iqiy/run',
      headers: { authorization: await tokenFor('admin') },
      payload: {},
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(202)
    expect(mockCreateAndEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'incremental' }),
    )
  })

  it('site key 不存在 → 404 + 不写 audit', async () => {
    mockFindCrawlerSite.mockResolvedValueOnce(null)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/sites/unknown/run',
      headers: { authorization: await tokenFor('admin') },
      payload: { mode: 'full' },
    })
    expect(res.statusCode).toBe(404)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
    expect(mockCreateAndEnqueueRun).not.toHaveBeenCalled()
  })

  it('site key 含非法字符 → 422 + 不写 audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/sites/bad$key/run',
      headers: { authorization: await tokenFor('admin') },
      payload: {},
    })
    expect(res.statusCode).toBe(422)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
    expect(mockFindCrawlerSite).not.toHaveBeenCalled()
  })

  it('mode 非法 → 422 + 不写 audit', async () => {
    mockFindCrawlerSite.mockResolvedValueOnce({ key: 'iqiy' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/sites/iqiy/run',
      headers: { authorization: await tokenFor('admin') },
      payload: { mode: 'turbo' },
    })
    expect(res.statusCode).toBe(422)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })

  it('enqueue 失败 → 503 + 不写 audit', async () => {
    mockFindCrawlerSite.mockResolvedValueOnce({ key: 'iqiy' })
    mockCreateAndEnqueueRun.mockRejectedValueOnce(new Error('queue down'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/sites/iqiy/run',
      headers: { authorization: await tokenFor('admin') },
      payload: { mode: 'full' },
    })
    expect(res.statusCode).toBe(503)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })

  it('非 admin → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/sites/iqiy/run',
      headers: { authorization: await tokenFor('viewer') },
      payload: {},
    })
    expect(res.statusCode).toBe(403)
  })
})

// ── POST /admin/crawler/run-all ──────────────────────────────────

describe('POST /admin/crawler/run-all — audit `crawler.run_create` targetKind=system', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  const RUN_ID = '11111111-2222-3333-4444-555555555555'

  it('admin 触发 → 202 + audit afterJsonb.triggerType=all', async () => {
    mockCreateAndEnqueueRun.mockResolvedValueOnce({
      runId: RUN_ID,
      taskIds: ['t1', 't2'],
      enqueuedSiteKeys: ['a', 'b'],
      skippedSiteKeys: [],
    })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/run-all',
      headers: { authorization: await tokenFor('admin') },
      payload: { mode: 'full' },
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(202)
    expect(mockCreateAndEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: 'all', mode: 'full' }),
    )
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.run_create',
        targetKind: 'system',
        targetId: RUN_ID,
        afterJsonb: expect.objectContaining({
          triggerType: 'all',
          mode: 'full',
          runId: RUN_ID,
        }),
      }),
    )
  })

  it('mode 缺省 → 默认 full + 202', async () => {
    mockCreateAndEnqueueRun.mockResolvedValueOnce({
      runId: RUN_ID, taskIds: [], enqueuedSiteKeys: [], skippedSiteKeys: [],
    })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/run-all',
      headers: { authorization: await tokenFor('admin') },
      payload: {},
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(202)
    expect(mockCreateAndEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: 'all', mode: 'full' }),
    )
  })

  it('mode 非法 → 422 + 不写 audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/run-all',
      headers: { authorization: await tokenFor('admin') },
      payload: { mode: 'invalid' },
    })
    expect(res.statusCode).toBe(422)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })

  it('enqueue 失败 → 503 + 不写 audit', async () => {
    mockCreateAndEnqueueRun.mockRejectedValueOnce(new Error('queue down'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/run-all',
      headers: { authorization: await tokenFor('admin') },
      payload: { mode: 'incremental' },
    })
    expect(res.statusCode).toBe(503)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })

  it('非 admin → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/run-all',
      headers: { authorization: await tokenFor('viewer') },
      payload: {},
    })
    expect(res.statusCode).toBe(403)
  })
})
