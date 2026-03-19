/**
 * tests/unit/api/performance.test.ts
 * CHG-32: GET /admin/performance/stats — stats 响应结构、权限检查
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))

const { mockRedisGet } = vi.hoisted(() => ({
  mockRedisGet: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: mockRedisGet },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))
vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import { setupMetrics, clearMetricsStore } from '@/api/plugins/metrics'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

async function buildApp() {
  const { adminPerformanceRoutes } = await import('@/api/routes/admin/performance')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  setupMetrics(app)
  await app.register(adminPerformanceRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

describe('GET /admin/performance/stats (CHG-32)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    clearMetricsStore()
    mockRedisGet.mockResolvedValue(null)
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/performance/stats' })
    expect(res.statusCode).toBe(401)
  })

  it('moderator 返回 403（admin only）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/performance/stats',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin 返回 200，响应包含完整结构', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/performance/stats',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)

    const body = res.json<{
      data: {
        requests: { perMinute: number; total24h: number }
        latency: { avgMs: number; p95Ms: number }
        memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number }
        uptime: number
        slowRequests: unknown[]
      }
    }>()

    expect(typeof body.data.requests.perMinute).toBe('number')
    expect(typeof body.data.requests.total24h).toBe('number')
    expect(typeof body.data.latency.avgMs).toBe('number')
    expect(typeof body.data.latency.p95Ms).toBe('number')
    expect(typeof body.data.memory.heapUsedMb).toBe('number')
    expect(typeof body.data.memory.heapTotalMb).toBe('number')
    expect(typeof body.data.memory.rssMb).toBe('number')
    expect(typeof body.data.uptime).toBe('number')
    expect(Array.isArray(body.data.slowRequests)).toBe(true)
  })

  it('内存指标为正数', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/performance/stats',
      headers: authHeader('admin'),
    })
    const { data } = res.json<{ data: { memory: { heapUsedMb: number; rssMb: number } } }>()
    expect(data.memory.heapUsedMb).toBeGreaterThan(0)
    expect(data.memory.rssMb).toBeGreaterThan(0)
  })

  it('uptime 为非负整数', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/performance/stats',
      headers: authHeader('admin'),
    })
    const { data } = res.json<{ data: { uptime: number } }>()
    expect(data.uptime).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(data.uptime)).toBe(true)
  })
})
