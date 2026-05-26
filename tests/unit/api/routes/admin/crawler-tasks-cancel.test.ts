/**
 * crawler-tasks-cancel.test.ts — CW1-B-EP-TEST
 * ADR-151 §5 task 级 cancel 路由单测
 *
 * 覆盖：
 *   #1 POST /admin/crawler/tasks/:id/cancel — pending task → 200 cancelled
 *   #2 POST /admin/crawler/tasks/:id/cancel — task not found → 404
 *   #3 POST /admin/crawler/tasks/:id/cancel — terminal task → 422 TASK_CANCEL_FORBIDDEN_TERMINAL
 *   #4 POST /admin/crawler/tasks/:id/cancel — audit 写入 crawler_task.cancel
 *   #5 POST /admin/crawler/tasks/batch-cancel — ids 有效 → 200 summary
 *   #6 POST /admin/crawler/tasks/batch-cancel — ids 空数组 → 422 VALIDATION_ERROR
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖 ────────────────────────────────────────────────────
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
vi.mock('@/api/workers/maintenanceScheduler', () => ({
  getSchedulerStatus: vi.fn().mockReturnValue([]),
  registerMaintenanceScheduler: vi.fn(),
}))

// mock cancelTaskById + batchCancelTasks
const { cancelTaskByIdMock, batchCancelTasksMock, syncRunStatusFromTasksMock } = vi.hoisted(() => ({
  cancelTaskByIdMock: vi.fn(),
  batchCancelTasksMock: vi.fn(),
  syncRunStatusFromTasksMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  listTasks: vi.fn(),
  findTaskById: vi.fn(),
  cancelAllActiveTasks: vi.fn(),
  cancelTaskById: cancelTaskByIdMock,
  batchCancelTasks: batchCancelTasksMock,
  findActiveTaskBySite: vi.fn(),
  getLatestTaskBySite: vi.fn(),
  getLatestTasksBySites: vi.fn(),
  markStalePendingTasks: vi.fn(),
  countOrphanActiveTasks: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  syncRunStatusFromTasks: syncRunStatusFromTasksMock,
  listRuns: vi.fn(),
  getRunById: vi.fn(),
  listActiveRunIds: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerSites', () => ({
  listCrawlerSites: vi.fn(),
  getCrawlerSiteByKey: vi.fn(),
}))
vi.mock('@/api/db/queries/systemSettings', () => ({
  getAutoCrawlConfig: vi.fn().mockResolvedValue({ globalEnabled: false }),
  getSystemSettings: vi.fn(),
}))
vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn(() => ({})),
}))
vi.mock('@/api/db/queries/crawlerTaskLogs', () => ({
  createCrawlerTaskLog: vi.fn(),
  listCrawlerTaskLogs: vi.fn(),
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

const TASK_ID = '11111111-2222-3333-4444-555555555555'
const RUN_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

async function buildApp() {
  const { registerCrawlerTaskRoutes } = await import('@/api/routes/admin/crawler.tasks')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(registerCrawlerTaskRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function adminToken() {
  return `Bearer ${await signAccessToken({ userId: 'u-admin', role: 'admin' })}`
}

describe('POST /admin/crawler/tasks/:id/cancel', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    cancelTaskByIdMock.mockReset()
    batchCancelTasksMock.mockReset()
    syncRunStatusFromTasksMock.mockReset().mockResolvedValue(undefined)
    insertAuditLogMock.mockClear()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('#1 pending task → 200 + finalStatus=cancelled', async () => {
    cancelTaskByIdMock.mockResolvedValueOnce({
      task: { id: TASK_ID, status: 'cancelled', cancelRequested: true, runId: RUN_ID, finishedAt: new Date().toISOString() },
      runId: RUN_ID,
      finalStatus: 'cancelled',
      alreadyRequested: false,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/tasks/${TASK_ID}/cancel`,
      headers: { authorization: await adminToken() },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.finalStatus).toBe('cancelled')
    expect(body.data.runId).toBe(RUN_ID)
  })

  it('#2 task not found → 404 NOT_FOUND', async () => {
    cancelTaskByIdMock.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/tasks/${TASK_ID}/cancel`,
      headers: { authorization: await adminToken() },
    })

    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('#3 terminal task → 422 TASK_CANCEL_FORBIDDEN_TERMINAL', async () => {
    // cancelTaskById throws AppError with STATE_CONFLICT
    const { AppError } = await import('@/api/lib/errors')
    cancelTaskByIdMock.mockRejectedValueOnce(
      new AppError('STATE_CONFLICT', 'TASK_CANCEL_FORBIDDEN_TERMINAL', 422),
    )

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/tasks/${TASK_ID}/cancel`,
      headers: { authorization: await adminToken() },
    })

    expect(res.statusCode).toBe(422)
    const body = JSON.parse(res.body)
    expect(body.error.code).toBe('TASK_CANCEL_FORBIDDEN_TERMINAL')
  })

  it('#4 成功 cancel → audit 写入 crawler_task.cancel + targetKind=crawler_task', async () => {
    cancelTaskByIdMock.mockResolvedValueOnce({
      task: { id: TASK_ID, status: 'running', cancelRequested: false, runId: null, finishedAt: null },
      runId: null,
      finalStatus: 'cancel_requested',
      alreadyRequested: false,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/crawler/tasks/${TASK_ID}/cancel`,
      headers: { authorization: await adminToken() },
    })

    expect(res.statusCode).toBe(200)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler_task.cancel',
        targetKind: 'crawler_task',
        targetId: TASK_ID,
        afterJsonb: expect.objectContaining({
          finalStatus: 'cancel_requested',
          alreadyRequested: false,
          reason: 'task_manual_cancel',
        }),
      }),
    )
  })
})

describe('POST /admin/crawler/tasks/batch-cancel', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    cancelTaskByIdMock.mockReset()
    batchCancelTasksMock.mockReset()
    insertAuditLogMock.mockClear()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('#5 valid ids → 200 + summary', async () => {
    const id1 = '11111111-1111-1111-1111-111111111111'
    const id2 = '22222222-2222-2222-2222-222222222222'
    batchCancelTasksMock.mockResolvedValueOnce({
      summary: { cancelled: 1, cancelRequested: 1, alreadyRequested: 0, errors: [] },
      runIds: ['run-1'],
      failedRunSyncIds: [],
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/tasks/batch-cancel',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [id1, id2] }),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.summary.cancelled).toBe(1)
    expect(body.data.summary.cancelRequested).toBe(1)
    expect(body.processed).toBe(2)
  })

  it('#6 ids 空数组 → 422 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/tasks/batch-cancel',
      headers: { authorization: await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    })

    expect(res.statusCode).toBe(422)
    const body = JSON.parse(res.body)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
