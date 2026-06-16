/**
 * tests/unit/api/task-aggregator.test.ts —
 * ADR-147 / CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A TaskAggregator + endpoint 单测
 *
 * 覆盖（ADR-147 §6 测试 surface #8-10 + #14 / ADR-194 D-194-5 副源升级）：
 *   #8  CrawlerRun 映射：status=running → TaskItem.status='running'
 *   #9  CrawlerRun 映射：status=failed → TaskItem.status='failed' + errorMessage
 *   #10 bull 降级：Redis 不可用 → queueCounts 归零 + meta.degraded=true（task_runs/crawler 仍读 DB）
 *   #T1-T4 task_runs 副源映射（taskrun- 前缀 + status 6→4 态 + digest 透传 + 两源 union 排序）
 *   #14 端点 jobs：admin GET → 200 + data + meta.queueCounts
 *
 * 副源 mock：db.query 按 SQL 内容分支（含 'task_runs' → taskRunRows，否则 crawlerRows），
 *   order-independent（list 内 crawler_runs / task_runs 两次查询顺序无关）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  queryMock,
  crawlerGetJobCountsMock,
  maintGetJobCountsMock,
  otherGetJobCountsMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  crawlerGetJobCountsMock: vi.fn(),
  maintGetJobCountsMock: vi.fn(),
  otherGetJobCountsMock: vi.fn(),
}))

vi.mock('@/api/lib/postgres', () => ({ db: { query: queryMock } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))
vi.mock('@/api/lib/queue', () => {
  // 队列健康卡：fetchQueueCounts 现调全 9 队列 getJobCounts；crawler/maintenance 保留专属 mock，
  // 其余 7 队列共用 otherGetJobCountsMock（断言聚焦 crawler/maintenance + enrichment 代表项）。
  const other = { getJobCounts: () => otherGetJobCountsMock() }
  return {
    crawlerQueue: { getJobCounts: () => crawlerGetJobCountsMock() },
    maintenanceQueue: { getJobCounts: () => maintGetJobCountsMock() },
    verifyQueue: other,
    enrichmentQueue: other,
    imageHealthQueue: other,
    identityCandidateQueue: other,
    homeAutofillQueue: other,
    doubanCollectionsQueue: other,
    bangumiCollectionsQueue: other,
  }
})

import { TaskAggregator, buildTaskResultDigest } from '@/api/services/TaskAggregator'
import { db } from '@/api/lib/postgres'

let crawlerRows: Array<Record<string, unknown>>
let taskRunRows: Array<Record<string, unknown>>
let dismissedRows: Array<Record<string, unknown>>

beforeEach(() => {
  vi.clearAllMocks()
  crawlerRows = []
  taskRunRows = []
  dismissedRows = []
  // NTLG-NTF-DISMISS-B3：notification_dismissals（selectDismissedKeys）/ task_runs / crawler_runs 三源按 SQL 分流
  queryMock.mockReset().mockImplementation((sql: unknown) => {
    const s = typeof sql === 'string' ? sql : ''
    const rows = s.includes('notification_dismissals') ? dismissedRows
      : s.includes('task_runs') ? taskRunRows
        : crawlerRows
    return Promise.resolve({ rows })
  })
  const zero = { waiting: 0, active: 0, completed: 0, failed: 0 }
  crawlerGetJobCountsMock.mockReset().mockResolvedValue(zero)
  maintGetJobCountsMock.mockReset().mockResolvedValue(zero)
  otherGetJobCountsMock.mockReset().mockResolvedValue(zero)
})

describe('TaskAggregator.list — CrawlerRun 映射', () => {
  it('#8 status=running → TaskItem.status="running"', async () => {
    crawlerRows = [{
      id: 'run-1',
      crawl_mode: 'batch',
      trigger_type: 'single',
      status: 'running',
      started_at: new Date('2026-05-20T10:00:00Z'),
      finished_at: null,
      created_at: new Date('2026-05-20T10:00:00Z'),
      summary: null,
    }]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.items[0]?.status).toBe('running')
    expect(result.items[0]?.id).toBe('run-1')
  })

  it('#9 status=failed → status="failed" + errorMessage', async () => {
    crawlerRows = [{
      id: 'run-2',
      crawl_mode: 'batch',
      trigger_type: 'schedule',
      status: 'failed',
      started_at: new Date('2026-05-20T09:00:00Z'),
      finished_at: new Date('2026-05-20T09:05:00Z'),
      created_at: new Date('2026-05-20T09:00:00Z'),
      summary: { error: 'API timeout' },
    }]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.items[0]?.status).toBe('failed')
    expect(result.items[0]?.errorMessage).toBe('API timeout')
    expect(result.items[0]?.finishedAt).toBeDefined()
  })

  it('#10 Redis 不可用 → degraded=true + queueCounts 全 9 队列归零（DB 数据仍返回）', async () => {
    crawlerGetJobCountsMock.mockRejectedValueOnce(new Error('Redis ECONNREFUSED'))
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.degraded).toBe(true)
    const zero = { waiting: 0, active: 0, completed: 0, failed: 0 }
    expect(result.queueCounts).toEqual({
      crawler: zero, verify: zero, enrichment: zero, imageHealth: zero, maintenance: zero,
      identityCandidate: zero, homeAutofill: zero, doubanCollections: zero, bangumiCollections: zero,
    })
  })

  it('#10b 队列健康卡：queueCounts 含全 9 队列 + waiting/active/completed/failed 四计数', async () => {
    crawlerGetJobCountsMock.mockResolvedValueOnce({ waiting: 3, active: 1, completed: 10, failed: 2 })
    otherGetJobCountsMock.mockResolvedValue({ waiting: 5, active: 2, completed: 200, failed: 50 })
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.degraded).toBe(false)
    expect(Object.keys(result.queueCounts)).toHaveLength(9)
    expect(result.queueCounts.crawler).toEqual({ waiting: 3, active: 1, completed: 10, failed: 2 })
    // enrichment 走 otherGetJobCountsMock —— 验证回填队列计数已暴露（completed/failed 封顶值如实透传）
    expect(result.queueCounts.enrichment).toEqual({ waiting: 5, active: 2, completed: 200, failed: 50 })
  })
})

describe('TaskAggregator.list — task_runs 副源映射 (ADR-194 D-194-5)', () => {
  it('#T1 running task_run → id="taskrun-N" + status running + progress', async () => {
    taskRunRows = [{
      id: '42',
      kind: 'maintenance',
      title: '暂存自动发布',
      ref: 'job-9',
      status: 'running',
      progress: 65,
      digest: null,
      error: null,
      startedAt: new Date('2026-05-20T11:00:00Z'),
      finishedAt: null,
      createdAt: new Date('2026-05-20T11:00:00Z'),
    }]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.degraded).toBe(false)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe('taskrun-42')
    expect(result.items[0]?.title).toBe('暂存自动发布')
    expect(result.items[0]?.status).toBe('running')
    expect(result.items[0]?.progress).toBe(65)
  })

  it('#T2 cancelled→failed / cancelling→running 状态映射 + error 透传', async () => {
    taskRunRows = [
      {
        id: '7', kind: 'maintenance', title: '搜索索引校准', ref: 'j7', status: 'cancelled',
        progress: null, digest: null, error: '手动取消',
        startedAt: new Date('2026-05-20T10:00:00Z'), finishedAt: new Date('2026-05-20T10:02:00Z'),
        createdAt: new Date('2026-05-20T10:00:00Z'),
      },
      {
        id: '8', kind: 'maintenance', title: '已发布源校验', ref: 'j8', status: 'cancelling',
        progress: 30, digest: null, error: null,
        startedAt: new Date('2026-05-20T09:00:00Z'), finishedAt: null,
        createdAt: new Date('2026-05-20T09:00:00Z'),
      },
    ]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    const byId = Object.fromEntries(result.items.map((i) => [i.id, i]))
    expect(byId['taskrun-7']?.status).toBe('failed')
    expect(byId['taskrun-7']?.errorMessage).toBe('手动取消')
    expect(byId['taskrun-8']?.status).toBe('running')
  })

  it('#T3 success + digest → digest 透传挂载（path B finish 落库）', async () => {
    taskRunRows = [{
      id: '9', kind: 'maintenance', title: '采集流水清理', ref: 'j9', status: 'success',
      progress: null,
      digest: { summary: '已删除 120', metrics: [{ key: 'deleted', label: '已删除', value: 120, tone: 'ok' }] },
      error: null,
      startedAt: new Date('2026-05-20T08:00:00Z'), finishedAt: new Date('2026-05-20T08:01:00Z'),
      createdAt: new Date('2026-05-20T08:00:00Z'),
    }]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.items[0]?.status).toBe('success')
    expect(result.items[0]?.digest?.summary).toBe('已删除 120')
    expect(result.items[0]?.finishedAt).toBeDefined()
  })

  it('#T4 两源 union 按 startedAt 倒序合并', async () => {
    crawlerRows = [{
      id: 'run-old', crawl_mode: 'batch', trigger_type: 'single', status: 'success',
      started_at: new Date('2026-05-20T07:00:00Z'), finished_at: new Date('2026-05-20T07:30:00Z'),
      created_at: new Date('2026-05-20T07:00:00Z'), summary: null,
    }]
    taskRunRows = [{
      id: '99', kind: 'maintenance', title: '暂存源校验', ref: 'j99', status: 'success',
      progress: null, digest: null, error: null,
      startedAt: new Date('2026-05-20T12:00:00Z'), finishedAt: new Date('2026-05-20T12:05:00Z'),
      createdAt: new Date('2026-05-20T12:00:00Z'),
    }]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-05-17T00:00:00Z' })
    expect(result.items.map((i) => i.id)).toEqual(['taskrun-99', 'run-old'])
  })
})

describe('GET /admin/system/jobs endpoint', () => {
  it('#14 admin GET → 200 + data + meta.queueCounts', async () => {
    crawlerRows = [{
      id: 'run-x',
      crawl_mode: 'keyword',
      trigger_type: 'single',
      status: 'success',
      started_at: new Date('2026-05-20T07:00:00Z'),
      finished_at: new Date('2026-05-20T07:10:00Z'),
      created_at: new Date('2026-05-20T07:00:00Z'),
      summary: null,
    }]
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
    crawlerRows = [{
      id: 'run-d',
      crawl_mode: 'batch',
      trigger_type: 'all',
      status: 'success',
      started_at: new Date('2026-06-09T07:00:00Z'),
      finished_at: new Date('2026-06-09T07:30:00Z'),
      created_at: new Date('2026-06-09T07:00:00Z'),
      summary: { videosUpserted: 12, sourcesUpserted: 3, failed: 0, errors: 0 },
    }]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-06-06T00:00:00Z' })
    expect(result.items[0]?.digest?.metrics.map((m) => m.key)).toEqual(['videos_added', 'sources_added'])
    expect(result.items[0]?.digest?.summary).toBe('新增 12 视频 · 3 线路')
  })

  it('summary=null（如 running 态未回填）→ 无 digest 字段（向后兼容）', async () => {
    crawlerRows = [{
      id: 'run-n',
      crawl_mode: 'keyword',
      trigger_type: 'single',
      status: 'running',
      started_at: new Date('2026-06-09T08:00:00Z'),
      finished_at: null,
      created_at: new Date('2026-06-09T08:00:00Z'),
      summary: null,
    }]
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-06-06T00:00:00Z' })
    expect(result.items[0]?.digest).toBeUndefined()
  })
})

describe('TaskAggregator.list — dismiss 过滤（ADR-197 D-197-4 / NTLG-NTF-DISMISS-B3）', () => {
  const terminalRun = (id: string, title: string) => ({
    id, kind: 'maintenance', title, ref: null, status: 'success', progress: 100, digest: null, error: null,
    startedAt: new Date(`2026-06-09T${id.padStart(2, '0')}:00:00Z`), finishedAt: new Date(`2026-06-09T${id.padStart(2, '0')}:05:00Z`),
    createdAt: new Date(`2026-06-09T${id.padStart(2, '0')}:00:00Z`),
  })

  it('#T-dismiss 终态 taskrun 项被 dismiss → 内存 anti-set 过滤排除', async () => {
    taskRunRows = [terminalRun('10', '保留'), terminalRun('11', '移除')]
    dismissedRows = [{ itemKey: 'taskrun-11' }] // item.id = taskrun-<id>
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-06-01T00:00:00Z', userId: 'admin-1' })
    expect(result.items.find((t) => t.id === 'taskrun-10')).toBeDefined()
    expect(result.items.find((t) => t.id === 'taskrun-11')).toBeUndefined()
  })

  it('#T-dismiss-2 userId 省略 → 不查 dismissals、不过滤', async () => {
    taskRunRows = [terminalRun('12', 'X')]
    dismissedRows = [{ itemKey: 'taskrun-12' }] // 有 dismissal 但不传 userId
    const svc = new TaskAggregator(db)
    const result = await svc.list({ limit: 20, since: '2026-06-01T00:00:00Z' })
    expect(result.items.find((t) => t.id === 'taskrun-12')).toBeDefined()
  })
})
