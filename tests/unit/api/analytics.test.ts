/**
 * tests/unit/api/analytics.test.ts
 * ADMIN-05: 数据看板统计数据聚合逻辑
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null) },
}))
vi.mock('@/api/lib/elasticsearch', () => ({
  es: { count: vi.fn().mockResolvedValue({ count: 0 }) },
  ES_INDEX: 'resovo_videos',
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))
vi.mock('@/api/db/queries/crawlerTasks', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}))

import * as authLib from '@/api/lib/auth'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'

const mockListTasks = crawlerTasksQueries.listTasks as ReturnType<typeof vi.fn>

// ── Mock db.query ─────────────────────────────────────────────────

const mockDbQuery = vi.fn()
vi.mock('@/api/lib/postgres', () => ({
  db: {
    query: mockDbQuery,
  },
}))

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_CRAWLER_TASKS = {
  rows: [
    {
      id: 'task-1',
      sourceSite: 'site-a',
      targetUrl: 'http://site-a.com',
      status: 'done',
      retryCount: 0,
      result: null,
      scheduledAt: '2026-03-15T00:00:00Z',
      finishedAt: '2026-03-15T01:00:00Z',
    },
  ],
  total: 1,
}

// ── 辅助函数 ──────────────────────────────────────────────────────

async function buildAnalyticsApp() {
  const { adminAnalyticsRoutes } = await import('@/api/routes/admin/analytics')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminAnalyticsRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

// 设置默认 mock 返回值（各 query 调用顺序）
function setupDefaultMocks() {
  mockDbQuery
    // 视频统计
    .mockResolvedValueOnce({ rows: [{ total: '100', published: '80', pending: '20' }] })
    // 播放源统计
    .mockResolvedValueOnce({ rows: [{ total: '200', active: '180', inactive: '20' }] })
    // 用户统计
    .mockResolvedValueOnce({ rows: [{ total: '500', today_new: '5', banned: '3' }] })
    // 投稿待审数
    .mockResolvedValueOnce({ rows: [{ count: '7' }] })
    // 字幕待审数
    .mockResolvedValueOnce({ rows: [{ count: '3' }] })
}

// ── GET /v1/admin/analytics ───────────────────────────────────────

describe('GET /v1/admin/analytics', () => {
  let app: Awaited<ReturnType<typeof buildAnalyticsApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockListTasks.mockResolvedValue(MOCK_CRAWLER_TASKS)
    setupDefaultMocks()
    app = await buildAnalyticsApp()
  })
  afterEach(() => app.close())

  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/analytics' })
    expect(res.statusCode).toBe(401)
  })

  it('moderator 访问返回 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin 访问返回 200 且含正确数据结构', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toBeDefined()
    expect(body.data.videos).toBeDefined()
    expect(body.data.sources).toBeDefined()
    expect(body.data.users).toBeDefined()
    expect(body.data.queues).toBeDefined()
    expect(body.data.crawlerTasks).toBeDefined()
  })

  it('视频统计数字正确', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('admin'),
    })
    const { videos } = res.json().data
    expect(videos.total).toBe(100)
    expect(videos.published).toBe(80)
    expect(videos.pending).toBe(20)
  })

  it('播放源统计与失效率计算正确', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('admin'),
    })
    const { sources } = res.json().data
    expect(sources.total).toBe(200)
    expect(sources.active).toBe(180)
    expect(sources.inactive).toBe(20)
    // failRate = 20/200 = 0.1
    expect(sources.failRate).toBeCloseTo(0.1)
  })

  it('用户统计数字正确', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('admin'),
    })
    const { users } = res.json().data
    expect(users.total).toBe(500)
    expect(users.todayNew).toBe(5)
    expect(users.banned).toBe(3)
  })

  it('队列待处理数量正确', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('admin'),
    })
    const { queues } = res.json().data
    expect(queues.submissions).toBe(7)
    expect(queues.subtitles).toBe(3)
  })

  it('爬虫任务快照包含最近记录', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('admin'),
    })
    const { crawlerTasks } = res.json().data
    expect(crawlerTasks.recent).toHaveLength(1)
    expect(crawlerTasks.recent[0].status).toBe('done')
  })

  it('无播放源时失效率为 0', async () => {
    vi.resetAllMocks()
    mockListTasks.mockResolvedValue({ rows: [], total: 0 })
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ total: '0', published: '0', pending: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', active: '0', inactive: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', today_new: '0', banned: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics',
      headers: authHeader('admin'),
    })
    expect(res.json().data.sources.failRate).toBe(0)
  })
})
