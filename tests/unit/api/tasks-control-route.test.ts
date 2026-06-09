/**
 * tasks-control-route.test.ts — POST /admin/tasks/:id/{cancel,retry}（ADR-191 / NTLG-P0-3-A）
 *
 * 覆盖 id 分派 + cancel/retry 状态机：
 *   cancel：crawler run（复用取消）/ crawler 404 / bull waiting→remove / bull active→409 / bull 404
 *   retry：bull failed→retry / bull 非 failed→409 / crawler 终态→新 run / crawler 非终态→409
 *   鉴权：moderator→403（admin-only）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

const crawlerGetJob = vi.fn()
const maintenanceGetJob = vi.fn()
vi.mock('@/api/lib/queue', () => ({
  crawlerQueue: { getJob: (...a: unknown[]) => crawlerGetJob(...a) },
  maintenanceQueue: { getJob: (...a: unknown[]) => maintenanceGetJob(...a) },
}))

const auditWrite = vi.fn()
vi.mock('@/api/services/AuditLogService', () => ({
  AuditLogService: class { write = (...a: unknown[]) => auditWrite(...a) },
}))

const createAndEnqueueRun = vi.fn()
vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: class { createAndEnqueueRun = (...a: unknown[]) => createAndEnqueueRun(...a) },
}))

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  getRunById: vi.fn(),
  updateRunControlStatus: vi.fn(),
  syncRunStatusFromTasks: vi.fn(),
}))
vi.mock('@/api/db/queries/crawlerTasks', () => ({
  cancelPendingTasksByRun: vi.fn().mockResolvedValue(2),
  requestCancelRunningTasksByRun: vi.fn().mockResolvedValue(1),
  listDistinctSiteKeysByRun: vi.fn().mockResolvedValue(['bilibili', 'youku']),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'
import * as runsQueries from '@/api/db/queries/crawlerRuns'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const RUN_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  // mockReset 清空 once-queue（clearAllMocks 仅清调用历史，保留 mockResolvedValueOnce 队列 → 防跨测试泄漏）
  crawlerGetJob.mockReset()
  maintenanceGetJob.mockReset()
  auditWrite.mockReset()
  createAndEnqueueRun.mockReset()
})

async function buildApp() {
  const { adminTaskControlRoutes } = await import('@/api/routes/admin/tasks')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminTaskControlRoutes)
  await app.ready()
  return app
}

function authAs(role: 'admin' | 'moderator') {
  mockVerify.mockReturnValue({ userId: ADMIN_ID, role, iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

function bullJob(state: string) {
  return { getState: vi.fn().mockResolvedValue(state), remove: vi.fn(), retry: vi.fn() }
}

describe('POST /admin/tasks/:id/cancel', () => {
  it('crawler run（裸 UUID）→ 复用取消逻辑 + target.kind=crawler_run', async () => {
    vi.mocked(runsQueries.getRunById).mockResolvedValueOnce({ id: RUN_ID, status: 'running', controlStatus: 'none' } as never)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: `/admin/tasks/${RUN_ID}/cancel`, headers: authAs('admin') })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { target: { kind: string }; cancelled: boolean } }
    expect(body.data.target.kind).toBe('crawler_run')
    expect(body.data.cancelled).toBe(true)
    expect(runsQueries.updateRunControlStatus).toHaveBeenCalledWith(expect.anything(), RUN_ID, 'cancelling')
    expect(auditWrite).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'crawler_run.cancel' }))
  })

  it('crawler run 不存在 → 404', async () => {
    vi.mocked(runsQueries.getRunById).mockResolvedValueOnce(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: `/admin/tasks/${RUN_ID}/cancel`, headers: authAs('admin') })
    expect(res.statusCode).toBe(404)
  })

  it('bull waiting → remove + cancelled=true + target.kind=bull_job', async () => {
    const job = bullJob('waiting')
    crawlerGetJob.mockResolvedValueOnce(job)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/tasks/bull-crawler-99/cancel', headers: authAs('admin') })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { target: { kind: string; queue: string }; cancelled: boolean } }
    expect(body.data.target.kind).toBe('bull_job')
    expect(body.data.target.queue).toBe('crawler')
    expect(body.data.cancelled).toBe(true)
    expect(job.remove).toHaveBeenCalled()
    expect(auditWrite).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'task.cancel' }))
  })

  it('bull active → 409 STATE_CONFLICT（不支持运行中取消）', async () => {
    crawlerGetJob.mockResolvedValueOnce(bullJob('active'))
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/tasks/bull-crawler-99/cancel', headers: authAs('admin') })
    expect(res.statusCode).toBe(409)
  })

  it('bull job 不存在 → 404（maintenance 队列分派）', async () => {
    maintenanceGetJob.mockResolvedValueOnce(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/tasks/bull-maintenance-7/cancel', headers: authAs('admin') })
    expect(res.statusCode).toBe(404)
    expect(maintenanceGetJob).toHaveBeenCalledWith('7')
  })

  it('moderator → 403（admin-only）', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: `/admin/tasks/${RUN_ID}/cancel`, headers: authAs('moderator') })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /admin/tasks/:id/retry', () => {
  it('bull failed → job.retry() + retried=true', async () => {
    const job = bullJob('failed')
    crawlerGetJob.mockResolvedValueOnce(job)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/tasks/bull-crawler-5/retry', headers: authAs('admin') })
    expect(res.statusCode).toBe(200)
    expect(job.retry).toHaveBeenCalled()
    expect((res.json() as { data: { retried: boolean } }).data.retried).toBe(true)
    expect(auditWrite).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'task.retry' }))
  })

  it('bull 非 failed → 409', async () => {
    crawlerGetJob.mockResolvedValueOnce(bullJob('active'))
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/tasks/bull-crawler-5/retry', headers: authAs('admin') })
    expect(res.statusCode).toBe(409)
  })

  it('crawler 终态 → 重建 siteKeys 新建 run + retryRunId', async () => {
    vi.mocked(runsQueries.getRunById).mockResolvedValueOnce({
      id: RUN_ID, status: 'failed', triggerType: 'batch', mode: 'incremental', crawlMode: 'batch', keyword: null, targetVideoId: null,
    } as never)
    createAndEnqueueRun.mockResolvedValueOnce({ runId: 'new-run-id', taskIds: [], enqueuedSiteKeys: [], skippedSiteKeys: [] })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: `/admin/tasks/${RUN_ID}/retry`, headers: authAs('admin') })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { target: { kind: string; retryRunId: string }; retried: boolean } }
    expect(body.data.target.kind).toBe('crawler_run')
    expect(body.data.target.retryRunId).toBe('new-run-id')
    expect(createAndEnqueueRun).toHaveBeenCalledWith(expect.objectContaining({
      triggerType: 'batch', mode: 'incremental', siteKeys: ['bilibili', 'youku'],
    }))
  })

  it('crawler 非终态 → 409', async () => {
    vi.mocked(runsQueries.getRunById).mockResolvedValueOnce({ id: RUN_ID, status: 'running' } as never)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: `/admin/tasks/${RUN_ID}/retry`, headers: authAs('admin') })
    expect(res.statusCode).toBe(409)
  })
})
