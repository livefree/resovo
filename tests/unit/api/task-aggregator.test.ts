/**
 * tests/unit/api/task-aggregator.test.ts —
 * ADR-147 / CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A TaskAggregator + endpoint 单测
 *
 * 覆盖（ADR-147 §6 测试 surface #8-11 + #14）：
 *   #8  CrawlerRun 映射：status=running → TaskItem.status='running'
 *   #9  CrawlerRun 映射：status=failed → TaskItem.status='failed' + errorMessage
 *   #10 bull 降级：Redis 不可用 → 仅 CrawlerRun + meta.degraded=true
 *   #11 bull active job → TaskItem 含 progress（0-100 clamp）
 *   #14 端点 jobs：admin GET → 200 + data + meta.queueCounts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  queryMock,
  crawlerGetJobCountsMock,
  maintGetJobCountsMock,
  crawlerGetActiveMock,
  maintGetActiveMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  crawlerGetJobCountsMock: vi.fn(),
  maintGetJobCountsMock: vi.fn(),
  crawlerGetActiveMock: vi.fn(),
  maintGetActiveMock: vi.fn(),
}))

vi.mock('@/api/lib/postgres', () => ({ db: { query: queryMock } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))
vi.mock('@/api/lib/queue', () => ({
  crawlerQueue: {
    getJobCounts: () => crawlerGetJobCountsMock(),
    getActive: (a: number, b: number) => crawlerGetActiveMock(a, b),
  },
  maintenanceQueue: {
    getJobCounts: () => maintGetJobCountsMock(),
    getActive: (a: number, b: number) => maintGetActiveMock(a, b),
  },
  verifyQueue: {},
  enrichmentQueue: {},
  imageHealthQueue: {},
}))

import { TaskAggregator, buildTaskResultDigest } from '@/api/services/TaskAggregator'
import { db } from '@/api/lib/postgres'

beforeEach(() => {
  vi.clearAllMocks()
  queryMock.mockReset()
  crawlerGetJobCountsMock.mockReset().mockResolvedValue({ waiting: 0, active: 0 })
  maintGetJobCountsMock.mockReset().mockResolvedValue({ waiting: 0, active: 0 })
  crawlerGetActiveMock.mockReset().mockResolvedValue([])
  maintGetActiveMock.mockReset().mockResolvedValue([])
})

describe('TaskAggregator.list — CrawlerRun 映射', () => {
  it('#8 status=running → TaskItem.status="running"', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'run-1',
        crawl_mode: 'batch',
        trigger_type: 'single',
        status: 'running',
        started_at: new Date('2026-05-20T10:00:00Z'),
        finished_at: null,
        created_at: new Date('2026-05-20T10:00:00Z'),
        summary: null,
      }],
    })
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.items[0]?.status).toBe('running')
    expect(result.items[0]?.id).toBe('run-1')
  })

  it('#9 status=failed → status="failed" + errorMessage', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'run-2',
        crawl_mode: 'batch',
        trigger_type: 'schedule',
        status: 'failed',
        started_at: new Date('2026-05-20T09:00:00Z'),
        finished_at: new Date('2026-05-20T09:05:00Z'),
        created_at: new Date('2026-05-20T09:00:00Z'),
        summary: { error: 'API timeout' },
      }],
    })
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.items[0]?.status).toBe('failed')
    expect(result.items[0]?.errorMessage).toBe('API timeout')
    expect(result.items[0]?.finishedAt).toBeDefined()
  })

  it('#10 Redis 不可用 → degraded=true + 仅 CrawlerRun 数据', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    crawlerGetJobCountsMock.mockRejectedValueOnce(new Error('Redis ECONNREFUSED'))
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.degraded).toBe(true)
    expect(result.queueCounts).toEqual({
      crawler: { waiting: 0, active: 0 },
      maintenance: { waiting: 0, active: 0 },
    })
  })

  it('#11 bull active job → TaskItem 含 progress（id 前缀 + clamp）', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    crawlerGetActiveMock.mockResolvedValueOnce([
      {
        id: 42,
        progress: () => 65,
        processedOn: Date.parse('2026-05-20T11:00:00Z'),
      },
    ])
    crawlerGetJobCountsMock.mockResolvedValueOnce({ waiting: 1, active: 1 })
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.degraded).toBe(false)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe('bull-crawler-42')
    expect(result.items[0]?.progress).toBe(65)
    expect(result.items[0]?.status).toBe('running')
    expect(result.queueCounts.crawler).toEqual({ waiting: 1, active: 1 })
  })
})

describe('GET /admin/system/jobs endpoint', () => {
  it('#14 admin GET → 200 + data + meta.queueCounts', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'run-x',
        crawl_mode: 'keyword',
        trigger_type: 'single',
        status: 'success',
        started_at: new Date('2026-05-20T07:00:00Z'),
        finished_at: new Date('2026-05-20T07:10:00Z'),
        created_at: new Date('2026-05-20T07:00:00Z'),
        summary: null,
      }],
    })
    crawlerGetJobCountsMock.mockResolvedValueOnce({ waiting: 2, active: 1 })
    maintGetJobCountsMock.mockResolvedValueOnce({ waiting: 0, active: 0 })

    const authLib = await import('@/api/lib/auth')
    const verifyMock = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
    verifyMock.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })

    const Fastify = (await import('fastify')).default
    const cookie = (await import('@fastify/cookie')).default
    const { setupAuthenticate } = await import('@/api/plugins/authenticate')
    const { adminSystemJobsRoutes } = await import('@/api/routes/admin/system-jobs')
    const app = Fastify({ logger: false })
    await app.register(cookie, { secret: 'test-secret' })
    setupAuthenticate(app)
    await app.register(adminSystemJobsRoutes)
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/system/jobs',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: unknown[]
      meta: { total: number; limit: number; queueCounts: { crawler: { waiting: number; active: number } } }
    }
    expect(body.data).toHaveLength(1)
    expect(body.meta.queueCounts.crawler).toEqual({ waiting: 2, active: 1 })
    expect(body.meta.limit).toBe(20)
    await app.close()
  })
})

describe('buildTaskResultDigest — summary→metrics 投影 (ADR-193 D-193-4)', () => {
  it('全字段 >0 → 4 metrics（含 tone）+ 人读 summary；生命周期内部计数不投影', () => {
    const digest = buildTaskResultDigest({
      videosUpserted: 42, sourcesUpserted: 5, failed: 1, errors: 2,
      // 6 个生命周期内部计数 → 不投影
      total: 10, pending: 0, running: 0, paused: 0, done: 8, cancelled: 0,
    })
    expect(digest?.metrics).toEqual([
      { key: 'videos_added', label: '新增视频', value: 42, tone: 'ok' },
      { key: 'sources_added', label: '新增线路', value: 5, tone: 'ok' },
      { key: 'sites_failed', label: '站点失败', value: 1, tone: 'warn' },
      { key: 'errors', label: '错误', value: 2, tone: 'danger' },
    ])
    expect(digest?.summary).toBe('新增 42 视频 · 5 线路 · 1 站点失败 · 2 错误')
  })

  it('failed=0 / errors=0 → 省略该 metric（不展示 0 噪声）', () => {
    const digest = buildTaskResultDigest({ videosUpserted: 3, sourcesUpserted: 0, failed: 0, errors: 0 })
    expect(digest?.metrics.map((m) => m.key)).toEqual(['videos_added', 'sources_added'])
    expect(digest?.summary).toBe('新增 3 视频 · 0 线路')
  })

  it('videos/sources=0 恒展示（运营需知本次产出，即使为 0）', () => {
    const digest = buildTaskResultDigest({ videosUpserted: 0, sourcesUpserted: 0 })
    expect(digest?.metrics).toEqual([
      { key: 'videos_added', label: '新增视频', value: 0, tone: 'ok' },
      { key: 'sources_added', label: '新增线路', value: 0, tone: 'ok' },
    ])
  })

  it('summary=null → undefined', () => {
    expect(buildTaskResultDigest(null)).toBeUndefined()
  })

  it('仅生命周期内部计数（无产出字段）→ undefined（metrics 空不挂 digest）', () => {
    expect(buildTaskResultDigest({ total: 10, done: 8, running: 1, paused: 0, cancelled: 0 })).toBeUndefined()
  })

  it('非数字 / 非有限值 → num 守卫省略该 metric，不抛错', () => {
    const digest = buildTaskResultDigest({ videosUpserted: 'NaN-str', sourcesUpserted: 7, failed: Infinity })
    expect(digest?.metrics.map((m) => m.key)).toEqual(['sources_added'])
    expect(digest?.summary).toBe('7 线路')
  })
})

describe('TaskAggregator.list — digest 挂载 (ADR-193 D-193-4 path A)', () => {
  it('crawler run summary 有产出 → item.digest 投影挂载', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'run-d',
        crawl_mode: 'batch',
        trigger_type: 'all',
        status: 'success',
        started_at: new Date('2026-06-09T07:00:00Z'),
        finished_at: new Date('2026-06-09T07:30:00Z'),
        created_at: new Date('2026-06-09T07:00:00Z'),
        summary: { videosUpserted: 12, sourcesUpserted: 3, failed: 0, errors: 0 },
      }],
    })
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-06-06T00:00:00Z' })
    expect(result.items[0]?.digest?.metrics.map((m) => m.key)).toEqual(['videos_added', 'sources_added'])
    expect(result.items[0]?.digest?.summary).toBe('新增 12 视频 · 3 线路')
  })

  it('summary=null（如 running 态未回填）→ 无 digest 字段（向后兼容）', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'run-n',
        crawl_mode: 'keyword',
        trigger_type: 'single',
        status: 'running',
        started_at: new Date('2026-06-09T08:00:00Z'),
        finished_at: null,
        created_at: new Date('2026-06-09T08:00:00Z'),
        summary: null,
      }],
    })
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-06-06T00:00:00Z' })
    expect(result.items[0]?.digest).toBeUndefined()
  })
})
