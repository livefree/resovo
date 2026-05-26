/**
 * crawler-system-audit.test.ts — auto-config + stop-all audit
 * payload 内容断言（CHG-SN-6-25-RETRO / R-MID-1 第 11 次系统化）
 *
 * 覆盖：
 *   - POST /admin/crawler/auto-config → crawler.auto_config + before/after config
 *   - POST /admin/crawler/stop-all    → crawler.stop_all + freezeEnabled + markedRuns + taskChanges
 *   - 422 不写 audit
 *
 * target_kind='system' 复用 052 CHECK 内值；target_id 用 setting key 字面量（auto_crawl_config / stop_all）
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
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn(), getRepeatableJobs: vi.fn().mockResolvedValue([]), removeRepeatableByKey: vi.fn() },
}))

const mockGetSetting = vi.fn()
const mockSetSetting = vi.fn().mockResolvedValue(undefined)
const mockGetAutoCrawlConfig = vi.fn()
const mockSetAutoCrawlConfig = vi.fn().mockResolvedValue(undefined)
vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: mockGetSetting,
  setSetting: mockSetSetting,
  getAutoCrawlConfig: mockGetAutoCrawlConfig,
  setAutoCrawlConfig: mockSetAutoCrawlConfig,
}))

const mockCancelAllActiveTasks = vi.fn().mockResolvedValue({ pendingCancelled: 0, runningSignaled: 0 })
const mockCountOrphan = vi.fn().mockResolvedValue(0)
vi.mock('@/api/db/queries/crawlerTasks', () => ({
  cancelAllActiveTasks: mockCancelAllActiveTasks,
  countOrphanActiveTasks: mockCountOrphan,
  cancelPendingTasksByRun: vi.fn(),
  requestCancelRunningTasksByRun: vi.fn(),
}))

const mockRequestCancelAllActiveRuns = vi.fn().mockResolvedValue({ count: 0, runIds: [] })
vi.mock('@/api/db/queries/crawlerRuns', () => ({
  requestCancelAllActiveRuns: mockRequestCancelAllActiveRuns,
  syncRunStatusFromTasks: vi.fn().mockResolvedValue(undefined),
  getRunById: vi.fn(),
  updateRunControlStatus: vi.fn(),
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

const BEFORE_CONFIG = {
  globalEnabled: false,
  scheduleType: 'daily' as const,
  intervalMinutes: 60,              // ADR-154 D-154-1
  dailyTime: '03:00',
  defaultMode: 'incremental' as const,
  onlyEnabledSites: true,
  conflictPolicy: 'skip_running' as const,
  perSiteOverrides: {},
}

const AFTER_CONFIG = {
  globalEnabled: true,
  scheduleType: 'daily' as const,
  intervalMinutes: 60,              // ADR-154 D-154-1（zod default）
  dailyTime: '04:30',
  defaultMode: 'full' as const,
  onlyEnabledSites: false,
  conflictPolicy: 'queue_after_running' as const,
  perSiteOverrides: {},
}

beforeEach(() => {
  insertAuditLogMock.mockClear()
  mockGetSetting.mockReset()
  mockSetSetting.mockClear()
  mockGetAutoCrawlConfig.mockReset()
  mockSetAutoCrawlConfig.mockClear()
  mockCancelAllActiveTasks.mockClear().mockResolvedValue({ pendingCancelled: 0, runningSignaled: 0 })
  mockRequestCancelAllActiveRuns.mockClear().mockResolvedValue({ count: 0, runIds: [] })
})

describe('POST /admin/crawler/auto-config — crawler.auto_config audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('admin 提交 → before/after config 完整断言', async () => {
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BEFORE_CONFIG)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/auto-config',
      headers: { authorization: await tokenFor('admin') },
      payload: AFTER_CONFIG,
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    // ADR-155 D-155-6 / EP-1C-1b：zod transform 输出永远同时含 dailyTime + dailyTimes
    // setAutoCrawlConfig 收到的 config 含 dailyTimes alias = [dailyTime]
    expect(mockSetAutoCrawlConfig).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ ...AFTER_CONFIG, dailyTimes: ['04:30'] }),
    )
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.auto_config',
        targetKind: 'system',
        targetId: 'auto_crawl_config',
        beforeJsonb: expect.objectContaining({ config: BEFORE_CONFIG }),
        afterJsonb: expect.objectContaining({ config: expect.objectContaining({ ...AFTER_CONFIG, dailyTimes: ['04:30'] }) }),
      }),
    )
  })

  it('422 body 缺失 → 不写 audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/auto-config',
      headers: { authorization: await tokenFor('admin') },
      payload: { globalEnabled: 'not-bool' },
    })
    expect(res.statusCode).toBe(422)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
    expect(mockSetAutoCrawlConfig).not.toHaveBeenCalled()
  })
})

describe('POST /admin/crawler/stop-all — crawler.stop_all audit', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('freeze=true：before/after 切换 + markedRuns + removeRepeatableTick + taskChanges', async () => {
    mockGetSetting.mockResolvedValueOnce('false').mockResolvedValueOnce('true')
    mockRequestCancelAllActiveRuns.mockResolvedValueOnce({ count: 2, runIds: ['r1', 'r2'] })
    mockCancelAllActiveTasks.mockResolvedValueOnce({ pendingCancelled: 5, runningSignaled: 3 })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/stop-all',
      headers: { authorization: await tokenFor('admin') },
      payload: { freeze: true, removeRepeatableTick: true },
    })
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.stop_all',
        targetKind: 'system',
        targetId: 'stop_all',
        beforeJsonb: expect.objectContaining({ freezeEnabled: false }),
        afterJsonb: expect.objectContaining({
          freezeEnabled: true,
          markedRuns: 2,
          removeRepeatableTick: true,
          pendingCancelled: 5,
          runningSignaled: 3,
        }),
      }),
    )
  })

  it('freeze=false：未触发 setSetting，audit 仍写入', async () => {
    mockGetSetting.mockResolvedValue('false')

    await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/stop-all',
      headers: { authorization: await tokenFor('admin') },
      payload: { freeze: false, removeRepeatableTick: false },
    })
    await new Promise((r) => setImmediate(r))
    expect(mockSetSetting).not.toHaveBeenCalled()
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: 'crawler.stop_all',
        afterJsonb: expect.objectContaining({ freezeEnabled: false, removeRepeatableTick: false }),
      }),
    )
  })

  it('422 body 校验失败 → 不写 audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/crawler/stop-all',
      headers: { authorization: await tokenFor('admin') },
      payload: { freeze: 'not-bool' },
    })
    expect(res.statusCode).toBe(422)
    await new Promise((r) => setImmediate(r))
    expect(insertAuditLogMock).not.toHaveBeenCalled()
  })
})
