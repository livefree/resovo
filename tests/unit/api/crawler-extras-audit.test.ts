/**
 * crawler-extras-audit.test.ts — reindex + runs 统一入口 audit
 * payload 内容断言（CHG-SN-6-26-RETRO / R-MID-1 第 12 次系统化）
 *
 * 覆盖：
 *   - POST /admin/crawler/reindex → crawler.reindex + afterJsonb.result
 *   - POST /admin/crawler/runs single → crawler.run_create + targetId=runId
 *   - POST /admin/crawler/runs keyword → afterJsonb.crawlMode + keyword
 *   - 422 不写 audit
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn(), getRepeatableJobs: vi.fn().mockResolvedValue([]), removeRepeatableByKey: vi.fn() },
}))

vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getAutoCrawlConfig: vi.fn(),
  setAutoCrawlConfig: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  cancelAllActiveTasks: vi.fn(),
  countOrphanActiveTasks: vi.fn().mockResolvedValue(0),
  cancelPendingTasksByRun: vi.fn(),
  requestCancelRunningTasksByRun: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  requestCancelAllActiveRuns: vi.fn(),
  syncRunStatusFromTasks: vi.fn(),
  getRunById: vi.fn(),
  updateRunControlStatus: vi.fn(),
  listRuns: vi.fn(),
}))

// mock CrawlerService（reindexAll）
const mockReindexAll = vi.fn().mockResolvedValue({ indexed: 100, duration_ms: 1234 })
vi.mock('@/api/services/CrawlerService', () => ({
  CrawlerService: vi.fn(() => ({ reindexAll: mockReindexAll })),
}))

// mock CrawlerRunService（createAndEnqueueRun）
const mockCreateAndEnqueueRun = vi.fn()
vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn(() => ({ createAndEnqueueRun: mockCreateAndEnqueueRun })),
}))

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
  const { adminCrawlerRoutes } = await import('@/api/routes/admin/crawler')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminCrawlerRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'admin' = 'admin') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

beforeEach(() => {
  insertAuditLogMock.mockClear()
  mockReindexAll.mockClear().mockResolvedValue({ indexed: 100, duration_ms: 1234 })
  mockCreateAndEnqueueRun.mockReset()
})

describe('POST /admin/crawler/reindex — crawler.reindex audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('admin 触发 → afterJsonb 含 result + triggeredAt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/reindex',
      headers: { authorization: await tokenFor('admin') },
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    expect(mockReindexAll).toHaveBeenCalledOnce()
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.reindex',
        targetKind: 'system',
        targetId: 'reindex',
        afterJsonb: expect.objectContaining({
          result: expect.objectContaining({ indexed: 100, duration_ms: 1234 }),
          triggeredAt: expect.any(String),
        }),
      }),
    )
  })
})

describe('POST /admin/crawler/runs — crawler.run_create audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  const RUN_ID = '11111111-2222-3333-4444-555555555555'

  it('single triggerType：targetId=run.id + afterJsonb 完整', async () => {
    mockCreateAndEnqueueRun.mockResolvedValueOnce({ id: RUN_ID, status: 'queued' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/runs',
      headers: { authorization: await tokenFor('admin') },
      payload: { triggerType: 'single', mode: 'incremental', siteKeys: ['site-a'] },
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(202)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.run_create',
        targetKind: 'system',
        targetId: RUN_ID,
        afterJsonb: expect.objectContaining({
          triggerType: 'single',
          mode: 'incremental',
          siteKeys: ['site-a'],
          crawlMode: null,
          keyword: null,
        }),
      }),
    )
  })

  it('keyword crawlMode：afterJsonb.keyword 非空', async () => {
    mockCreateAndEnqueueRun.mockResolvedValueOnce({ id: RUN_ID, status: 'queued' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/runs',
      headers: { authorization: await tokenFor('admin') },
      payload: {
        triggerType: 'all',
        mode: 'full',
        crawlMode: 'keyword',
        keyword: 'test-query',
      },
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(202)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.run_create',
        afterJsonb: expect.objectContaining({
          crawlMode: 'keyword',
          keyword: 'test-query',
        }),
      }),
    )
  })

  it('422 siteKeys 缺失 → 不写 audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/runs',
      headers: { authorization: await tokenFor('admin') },
      payload: { triggerType: 'single', mode: 'incremental' },
    })
    expect(res.statusCode).toBe(422)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
    expect(mockCreateAndEnqueueRun).not.toHaveBeenCalled()
  })

  it('503 enqueue 失败 → 不写 audit', async () => {
    mockCreateAndEnqueueRun.mockRejectedValueOnce(new Error('queue down'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/runs',
      headers: { authorization: await tokenFor('admin') },
      payload: { triggerType: 'single', mode: 'incremental', siteKeys: ['site-a'] },
    })
    expect(res.statusCode).toBe(503)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })
})
