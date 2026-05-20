/**
 * admin-dashboard.test.ts — Dashboard 3 端点单元测试（ADR-127 / CHG-SN-7-MISC-DASHBOARD-2）
 *
 * 覆盖：
 *   GET /admin/dashboard/overview   → 200 + DashboardOverviewPayload + 401
 *   GET /admin/dashboard/spark      → 200 + spark 点列表 + 422 (metric 非法) + 401
 *   GET /admin/dashboard/analytics  → 200 + DashboardAnalyticsPayload + 422 (period 非法) + 401
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── infrastructure mocks ──────────────────────────────────────────

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

// ── query mocks ───────────────────────────────────────────────────

const mockGetDashboardOverview = vi.fn()
vi.mock('@/api/db/queries/dashboardOverview', () => ({
  getDashboardOverview: (...args: unknown[]) => mockGetDashboardOverview(...args),
}))

const mockGetDashboardSpark = vi.fn()
vi.mock('@/api/db/queries/dashboardSpark', () => ({
  getDashboardSpark: (...args: unknown[]) => mockGetDashboardSpark(...args),
}))

const mockGetDashboardAnalyticsData = vi.fn()
vi.mock('@/api/db/queries/dashboardAnalytics', () => ({
  getDashboardAnalyticsData: (...args: unknown[]) => mockGetDashboardAnalyticsData(...args),
}))

// ── test fixtures ─────────────────────────────────────────────────

const MOCK_OVERVIEW = {
  kpis: [
    { key: 'videoTotal',          value: '695',      deltaText: '↑ +47 今日', deltaDirection: 'up',   variant: 'default'   },
    { key: 'pendingStaging',      value: '484 / 23', deltaText: '→ 持平',     deltaDirection: 'flat', variant: 'is-warn'   },
    { key: 'sourceReachableRate', value: '98.7%',    deltaText: '↑ 健康',     deltaDirection: 'up',   variant: 'is-ok'     },
    { key: 'inactiveSources',     value: '1,939',    deltaText: '↑ 偏多',     deltaDirection: 'up',   variant: 'is-danger' },
  ],
  workflow: [
    { key: 'collected',    current: 142, total: 200 },
    { key: 'pendingReview', current: 484, total: 600 },
    { key: 'staging',      current: 23,  total: 50  },
    { key: 'published',    current: 188, total: 695 },
  ],
  generatedAt: '2026-05-19T10:00:00.000Z',
}

const MOCK_SPARK_POINTS = [
  { date: '2026-05-13', value: 620 },
  { date: '2026-05-14', value: 638 },
  { date: '2026-05-15', value: 651 },
  { date: '2026-05-16', value: 662 },
  { date: '2026-05-17', value: 670 },
  { date: '2026-05-18', value: 680 },
  { date: '2026-05-19', value: 695 },
]

const MOCK_ANALYTICS_DATA = {
  collectTimeline: [{ date: '2026-05-13', count: 120 }, { date: '2026-05-14', count: 135 }],
  sourceTypeDistribution: [{ type: 'm3u8', count: 1000, pct: 78.1 }],
  recentTasks: [
    { id: 'task-1', site: 'iyf.tv', status: 'ok', statusLabel: '成功', startedAt: '2026-05-19T10:00:00Z', finishedAt: '2026-05-19T10:01:00Z', videosUpserted: 55, sourcesUpserted: 138, durationSeconds: 53 },
  ],
}

// ── fastify app builder ───────────────────────────────────────────

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

async function buildApp() {
  const { adminDashboardRoutes } = await import('@/api/routes/admin/dashboard')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminDashboardRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'admin' | 'moderator' | 'viewer' = 'admin') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

beforeEach(() => {
  mockGetDashboardOverview.mockReset()
  mockGetDashboardSpark.mockReset()
  mockGetDashboardAnalyticsData.mockReset()
})

// ── GET /admin/dashboard/overview ────────────────────────────────

describe('GET /admin/dashboard/overview', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('admin → 200 + kpis[4] + workflow[4] + generatedAt', async () => {
    mockGetDashboardOverview.mockResolvedValueOnce(MOCK_OVERVIEW)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/overview',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: typeof MOCK_OVERVIEW }
    expect(body.data.kpis).toHaveLength(4)
    expect(body.data.workflow).toHaveLength(4)
    expect(body.data.generatedAt).toBeTruthy()
    expect(mockGetDashboardOverview).toHaveBeenCalledOnce()
  })

  it('无 token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/dashboard/overview' })
    expect(res.statusCode).toBe(401)
    expect(mockGetDashboardOverview).not.toHaveBeenCalled()
  })

  it('moderator role → 403 (overview 仅 admin)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/overview',
      headers: { authorization: await tokenFor('moderator') },
    })
    expect(res.statusCode).toBe(403)
  })
})

// ── GET /admin/dashboard/spark ────────────────────────────────────

describe('GET /admin/dashboard/spark', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('metric=videoTotal&days=7 → 200 + 7 DashboardSparkPoint', async () => {
    mockGetDashboardSpark.mockResolvedValueOnce(MOCK_SPARK_POINTS)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/spark?metric=videoTotal&days=7',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { metric: string; points: unknown[] } }
    expect(body.data.metric).toBe('videoTotal')
    expect(body.data.points).toHaveLength(7)
    expect(mockGetDashboardSpark).toHaveBeenCalledWith(expect.anything(), 'videoTotal', 7)
  })

  it('metric 不在枚举 → 422 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/spark?metric=invalid',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(422)
    expect(mockGetDashboardSpark).not.toHaveBeenCalled()
  })

  it('days=0（超范围）→ 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/spark?metric=videoTotal&days=0',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(422)
  })

  it('metric 缺失 → 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/spark?days=7',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(422)
  })

  it('无 token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/dashboard/spark?metric=videoTotal' })
    expect(res.statusCode).toBe(401)
  })
})

// ── GET /admin/dashboard/analytics ───────────────────────────────

describe('GET /admin/dashboard/analytics', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => { app = await buildApp() })
  afterEach(() => app.close())

  it('默认 period=7d → 200 + DashboardAnalyticsPayload', async () => {
    mockGetDashboardOverview.mockResolvedValueOnce(MOCK_OVERVIEW)
    mockGetDashboardAnalyticsData.mockResolvedValueOnce(MOCK_ANALYTICS_DATA)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/analytics',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { kpis: unknown[]; collectTimeline: unknown[]; recentTasks: unknown[] } }
    expect(body.data.kpis).toHaveLength(4)
    expect(body.data.collectTimeline).toHaveLength(2)
    expect(body.data.recentTasks).toHaveLength(1)
    expect(mockGetDashboardAnalyticsData).toHaveBeenCalledWith(expect.anything(), '7d')
  })

  it('period=30d → 正确传参到 getDashboardAnalyticsData', async () => {
    mockGetDashboardOverview.mockResolvedValueOnce(MOCK_OVERVIEW)
    mockGetDashboardAnalyticsData.mockResolvedValueOnce(MOCK_ANALYTICS_DATA)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/analytics?period=30d',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(200)
    expect(mockGetDashboardAnalyticsData).toHaveBeenCalledWith(expect.anything(), '30d')
  })

  it('period=invalid → 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dashboard/analytics?period=invalid',
      headers: { authorization: await tokenFor('admin') },
    })
    expect(res.statusCode).toBe(422)
    expect(mockGetDashboardAnalyticsData).not.toHaveBeenCalled()
  })

  it('无 token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/dashboard/analytics' })
    expect(res.statusCode).toBe(401)
  })
})
