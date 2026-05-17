/**
 * crawler-freeze-audit.test.ts — POST /admin/crawler/freeze audit
 * payload 内容断言（CHG-SN-6-20-A / R-MID-1 第 10 次系统化）
 *
 * 覆盖：
 *   - POST /admin/crawler/freeze enabled=true  → crawler.freeze + payload before/after
 *   - POST /admin/crawler/freeze enabled=false → before=true / after=false 切换
 *   - 422 不写 audit
 *
 * target_kind='system' 复用 052 CHECK 内值 + target_id='crawler_global_freeze' setting key
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
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn(), getRepeatableJobs: vi.fn().mockResolvedValue([]) },
}))

// mock systemSettings：getSetting/setSetting
const mockGetSetting = vi.fn()
const mockSetSetting = vi.fn().mockResolvedValue(undefined)
vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: mockGetSetting,
  setSetting: mockSetSetting,
}))

// mock countOrphanActiveTasks（用于 afterJsonb 的 orphanTaskCount）
const mockCountOrphan = vi.fn().mockResolvedValue(0)
vi.mock('@/api/db/queries/crawlerTasks', () => ({
  countOrphanActiveTasks: mockCountOrphan,
  cancelPendingTasksByRun: vi.fn(),
  requestCancelRunningTasksByRun: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  getRunById: vi.fn(),
  updateRunControlStatus: vi.fn(),
  syncRunStatusFromTasks: vi.fn(),
  listRuns: vi.fn(),
}))

vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn(() => ({})),
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
  mockGetSetting.mockReset()
  mockSetSetting.mockClear()
  mockCountOrphan.mockClear().mockResolvedValue(0)
})

describe('POST /admin/crawler/freeze — crawler.freeze audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('enabled=true：before=false → after=true，audit payload 完整', async () => {
    // 第一次调用（before）返回 'false'，第二次调用（refresh after setSetting）返回 'true'
    mockGetSetting.mockResolvedValueOnce('false').mockResolvedValueOnce('true')

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/freeze',
      headers: { authorization: await tokenFor('admin') },
      payload: { enabled: true },
    })

    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    expect(mockSetSetting).toHaveBeenCalledWith({}, 'crawler_global_freeze', 'true')
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.freeze',
        targetKind: 'system',
        targetId: 'crawler_global_freeze',
        beforeJsonb: expect.objectContaining({ freezeEnabled: false }),
        afterJsonb: expect.objectContaining({
          freezeEnabled: true,
          orphanTaskCount: 0,
        }),
      }),
    )
  })

  it('enabled=false：before=true → after=false', async () => {
    mockGetSetting.mockResolvedValueOnce('true').mockResolvedValueOnce('false')

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/freeze',
      headers: { authorization: await tokenFor('admin') },
      payload: { enabled: false },
    })

    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.freeze',
        beforeJsonb: expect.objectContaining({ freezeEnabled: true }),
        afterJsonb: expect.objectContaining({ freezeEnabled: false }),
      }),
    )
  })

  it('422 body 校验失败 → 不写 audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/freeze',
      headers: { authorization: await tokenFor('admin') },
      payload: { enabled: 'not-a-bool' },
    })
    expect(res.statusCode).toBe(422)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
    expect(mockSetSetting).not.toHaveBeenCalled()
  })

  it('orphanTaskCount > 0 → afterJsonb 含正确计数', async () => {
    mockGetSetting.mockResolvedValueOnce('false').mockResolvedValueOnce('true')
    mockCountOrphan.mockResolvedValueOnce(5)

    await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/freeze',
      headers: { authorization: await tokenFor('admin') },
      payload: { enabled: true },
    })
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        afterJsonb: expect.objectContaining({ orphanTaskCount: 5 }),
      }),
    )
  })
})
