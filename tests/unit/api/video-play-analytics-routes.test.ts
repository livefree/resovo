/**
 * video-play-analytics-routes.test.ts — 后台播放分析 3 端点 route 单测（ADR-217 / STATS-07-A）
 *
 * 覆盖：
 *   GET /admin/analytics/video-plays/overview     → 200 {data:对象6字段} / 401 / 403(viewer) / 422(空串/未知键)
 *   GET /admin/analytics/video-plays/trend         → 200 {data:[]裸数组} / 422
 *   GET /admin/analytics/video-plays/top-videos    → 200 {data:[]} / 422(limit 越界/0/非数)
 * + 响应信封断言（HIGH-1）：trend/top 裸数组、无 items/total；overview 单对象回显 period。
 * + handler 仅调 service 并透传 parsed query（含默认 7d/20）；422 时 service 不被调用。
 * mock VideoPlayAnalyticsService（route 行为层守护，D-217-9）。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── infra mocks（镜像 admin-dashboard.test 的最小集，保证 import 链可解析）────────
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

// ── service mock（route 唯一业务出入口）──────────────────────────────────────────
const mockGetOverview = vi.fn()
const mockGetTrend = vi.fn()
const mockGetTopVideos = vi.fn()
vi.mock('@/api/services/VideoPlayAnalyticsService', () => ({
  VideoPlayAnalyticsService: vi.fn().mockImplementation(() => ({
    getOverview: mockGetOverview,
    getTrend: mockGetTrend,
    getTopVideos: mockGetTopVideos,
  })),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

async function buildApp() {
  const { adminVideoPlayAnalyticsRoutes } = await import('@/api/routes/admin/analytics.video-plays')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminVideoPlayAnalyticsRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

async function tokenFor(role: 'admin' | 'moderator' | 'viewer' = 'admin') {
  return `Bearer ${await signAccessToken({ userId: `u-${role}`, role })}`
}

let app: Awaited<ReturnType<typeof buildApp>>
beforeEach(async () => {
  mockGetOverview.mockReset()
  mockGetTrend.mockReset()
  mockGetTopVideos.mockReset()
  app = await buildApp()
})
afterEach(() => app.close())

// ── overview ──────────────────────────────────────────────────────
describe('GET /admin/analytics/video-plays/overview', () => {
  const OVERVIEW = {
    period: '7d', totalPlays: 100, totalWatchSeconds: 5000, avgWatchSeconds: 50, anonPlays: 70, loggedInPlays: 30,
  }

  it('admin 默认 → 200 + {data:6字段对象}，service 收默认 7d', async () => {
    mockGetOverview.mockResolvedValueOnce(OVERVIEW)
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: typeof OVERVIEW }
    expect(Object.keys(body.data).sort()).toEqual(
      ['anonPlays', 'avgWatchSeconds', 'loggedInPlays', 'period', 'totalPlays', 'totalWatchSeconds'],
    )
    expect(body.data.period).toBe('7d')
    expect(mockGetOverview).toHaveBeenCalledWith('7d')
  })

  it('显式 period=90d → service 收 90d', async () => {
    mockGetOverview.mockResolvedValueOnce({ ...OVERVIEW, period: '90d' })
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview?period=90d', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(200)
    expect(mockGetOverview).toHaveBeenCalledWith('90d')
  })

  it('无 token → 401，service 不被调用', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview' })
    expect(res.statusCode).toBe(401)
    expect(mockGetOverview).not.toHaveBeenCalled()
  })

  it('viewer role → 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview', headers: { authorization: await tokenFor('viewer') } })
    expect(res.statusCode).toBe(403)
  })

  it('非法 period → 422 VALIDATION_ERROR，service 不被调用', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview?period=1y', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
    expect(mockGetOverview).not.toHaveBeenCalled()
  })

  it('空串 period= → 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview?period=', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
  })

  it('未知 query key（strict）→ 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview?limit=10', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect(mockGetOverview).not.toHaveBeenCalled()
  })

  // Codex 代码审 LOW-3：period enum 大小写敏感，7D（大写）非合法成员 → 422
  it('大写 period=7D → 422（enum 大小写敏感）', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/overview?period=7D', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect(mockGetOverview).not.toHaveBeenCalled()
  })
})

// ── trend ─────────────────────────────────────────────────────────
describe('GET /admin/analytics/video-plays/trend', () => {
  it('admin → 200 + {data:裸数组}，无 items/total 信封', async () => {
    mockGetTrend.mockResolvedValueOnce([
      { date: '2026-06-19', plays: 10, watchSeconds: 120, anonPlays: 6, loggedInPlays: 4 },
    ])
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/trend?period=30d', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: unknown[]; items?: unknown; total?: unknown }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.items).toBeUndefined()
    expect(body.total).toBeUndefined()
    expect(mockGetTrend).toHaveBeenCalledWith('30d')
  })

  it('非法 period → 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/trend?period=foo', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect(mockGetTrend).not.toHaveBeenCalled()
  })
})

// ── top-videos ────────────────────────────────────────────────────
describe('GET /admin/analytics/video-plays/top-videos', () => {
  it('admin 默认 → 200 + {data:裸数组}，service 收默认 7d + limit 20', async () => {
    mockGetTopVideos.mockResolvedValueOnce([
      { shortId: 'abCD1234', title: '热门', plays: 999, watchSeconds: 88000 },
    ])
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: unknown[]; items?: unknown; total?: unknown }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.items).toBeUndefined()
    expect(body.total).toBeUndefined()
    expect(mockGetTopVideos).toHaveBeenCalledWith('7d', 20)
  })

  it('显式 limit=50 → service 收 50', async () => {
    mockGetTopVideos.mockResolvedValueOnce([])
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos?limit=50', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(200)
    expect(mockGetTopVideos).toHaveBeenCalledWith('7d', 50)
  })

  it('limit 越界(101) → 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos?limit=101', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect(mockGetTopVideos).not.toHaveBeenCalled()
  })

  it('limit=0 → 422（min 1）', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos?limit=0', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
  })

  it('limit 非数字 → 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos?limit=abc', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
  })

  // Codex 代码审 LOW-3：coerce 边界——空串(→0)、小数(.int 拒)、未知键(.strict 拒) 均须 422
  it('limit 空串 → 422（coerce "" → 0 < min 1）', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos?limit=', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect(mockGetTopVideos).not.toHaveBeenCalled()
  })

  it('limit 小数 1.5 → 422（.int() 拒非整）', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos?limit=1.5', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect(mockGetTopVideos).not.toHaveBeenCalled()
  })

  it('未知 query key（strict）→ 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics/video-plays/top-videos?foo=1', headers: { authorization: await tokenFor('admin') } })
    expect(res.statusCode).toBe(422)
    expect(mockGetTopVideos).not.toHaveBeenCalled()
  })
})
