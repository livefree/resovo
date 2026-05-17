/**
 * crawler-runs-control-audit.test.ts — CrawlerRun cancel/pause/resume audit
 * payload 内容断言（CHG-SN-6-16-A / R-MID-1 第 9 次系统化）
 *
 * 覆盖 3 写端点的 audit payload 内容显式断言：
 *   - POST /admin/crawler/runs/:id/cancel → crawler_run.cancel
 *   - POST /admin/crawler/runs/:id/pause  → crawler_run.pause
 *   - POST /admin/crawler/runs/:id/resume → crawler_run.resume
 *
 * target_kind='system' + targetId=runId（052 migration CHECK 约束内 / 运维域）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

// crawler.ts import 链中含 config 校验 + worker 注册，预先 mock 避免 process.exit
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

// mock crawlerRunsQueries
const mockGetRunById = vi.fn()
const mockUpdateRunControlStatus = vi.fn().mockResolvedValue(undefined)
const mockSyncRunStatusFromTasks = vi.fn().mockResolvedValue(undefined)
const mockCancelPending = vi.fn().mockResolvedValue(2)
const mockRequestCancelRunning = vi.fn().mockResolvedValue(1)

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  getRunById: mockGetRunById,
  updateRunControlStatus: mockUpdateRunControlStatus,
  syncRunStatusFromTasks: mockSyncRunStatusFromTasks,
  listRuns: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  cancelPendingTasksByRun: mockCancelPending,
  requestCancelRunningTasksByRun: mockRequestCancelRunning,
}))

vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn(() => ({})),
}))

// mock insertAuditLog
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

const RUN_ID = '00000000-0000-0000-0000-000000000001'

const RUN_RUNNING = {
  id: RUN_ID,
  status: 'running' as const,
  controlStatus: 'active',
}

const RUN_PAUSED = {
  id: RUN_ID,
  status: 'paused' as const,
  controlStatus: 'paused',
}

beforeEach(() => {
  insertAuditLogMock.mockClear()
  mockGetRunById.mockReset()
  mockUpdateRunControlStatus.mockClear()
  mockSyncRunStatusFromTasks.mockClear()
  mockCancelPending.mockClear().mockResolvedValue(2)
  mockRequestCancelRunning.mockClear().mockResolvedValue(1)
})

describe('POST /admin/crawler/runs/:id/cancel — crawler_run.cancel audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('admin 触发 cancel → audit payload 含 actionType / before / after 状态变更', async () => {
    mockGetRunById.mockResolvedValueOnce(RUN_RUNNING).mockResolvedValueOnce({
      ...RUN_RUNNING, controlStatus: 'cancelling',
    })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/runs/${RUN_ID}/cancel`,
      headers: { authorization: await tokenFor('admin') },
    })

    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler_run.cancel',
        targetKind: 'system',
        targetId: RUN_ID,
        beforeJsonb: expect.objectContaining({ runId: RUN_ID, status: 'running' }),
        afterJsonb: expect.objectContaining({
          runId: RUN_ID,
          controlStatus: 'cancelling',
          cancelledPending: 2,
          signaledRunning: 1,
        }),
      }),
    )
  })

  it('404 当 run 不存在 → 不写 audit', async () => {
    mockGetRunById.mockResolvedValueOnce(null)
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/runs/${RUN_ID}/cancel`,
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(404)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })
})

describe('POST /admin/crawler/runs/:id/pause — crawler_run.pause audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('running 状态 pause → controlStatus 切到 pausing + audit', async () => {
    mockGetRunById.mockResolvedValueOnce(RUN_RUNNING)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/runs/${RUN_ID}/pause`,
      headers: { authorization: await tokenFor('admin') },
    })

    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler_run.pause',
        targetKind: 'system',
        targetId: RUN_ID,
        beforeJsonb: expect.objectContaining({ status: 'running' }),
        afterJsonb: expect.objectContaining({ controlStatus: 'pausing' }),
      }),
    )
  })

  it('queued 状态 pause → controlStatus 切到 paused', async () => {
    mockGetRunById.mockResolvedValueOnce({ ...RUN_RUNNING, status: 'queued' })
    await (await buildApp()).inject({
      method: 'POST',
      url: `/v1/admin/crawler/runs/${RUN_ID}/pause`,
      headers: { authorization: await tokenFor('admin') },
    })
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler_run.pause',
        afterJsonb: expect.objectContaining({ controlStatus: 'paused' }),
      }),
    )
  })
})

describe('POST /admin/crawler/runs/:id/resume — crawler_run.resume audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('paused 状态 resume → controlStatus 切到 active + audit', async () => {
    mockGetRunById.mockResolvedValueOnce(RUN_PAUSED)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/runs/${RUN_ID}/resume`,
      headers: { authorization: await tokenFor('admin') },
    })

    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler_run.resume',
        targetKind: 'system',
        targetId: RUN_ID,
        beforeJsonb: expect.objectContaining({ status: 'paused', controlStatus: 'paused' }),
        afterJsonb: expect.objectContaining({ runId: RUN_ID, controlStatus: 'active' }),
      }),
    )
  })
})
