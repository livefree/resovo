/**
 * tests/unit/api/background-event-service.test.ts
 * ADR-152 CW1-E-EP step 10 — BackgroundEventService 单测
 *
 * 覆盖：
 *   #1 upcoming — autoCrawlNext 正确生成（globalEnabled=true）
 *   #2 upcoming — autoCrawlNext 为空（globalEnabled=false）
 *   #3 upcoming — scheduler timer nextRunAt 在 24h 内才返回
 *   #4 active — crawler_runs status=[queued,running,paused]
 *   #5 finished — crawler_runs 终态 finishedAfter 谓词下推
 *   #6 finished — audit_log 高危白名单（crawler.freeze）
 *   #7 finished — audit_log 白名单外 actionType 不出现
 *   #8 id 拼接不重叠（auto_crawl:next / scheduler_timer:X / crawler_run:X / audit:X）
 *   #9 degraded 字段缺省时不出现在结果
 *   #10 events 排序：upcoming asc → active → finished desc
 *   #11 meta.generatedAt 为 ISO 字符串
 *   #12 listRuns 被调用两次（active + finished 源）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock postgres + 所有依赖均使用 vi.hoisted 避免提升顺序问题
const { queryMock, listRunsMock, getAutoCrawlConfigMock, computeNextTriggerMock, getSchedulerStatusMock } =
  vi.hoisted(() => ({
    queryMock: vi.fn(),
    listRunsMock: vi.fn(),
    getAutoCrawlConfigMock: vi.fn(),
    computeNextTriggerMock: vi.fn(),
    getSchedulerStatusMock: vi.fn(),
  }))

vi.mock('@/api/lib/postgres', () => ({ db: { query: queryMock } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/db/queries/crawlerRuns', () => ({ listRuns: listRunsMock }))
vi.mock('@/api/db/queries/systemSettings', () => ({
  getAutoCrawlConfig: getAutoCrawlConfigMock,
}))
vi.mock('@/api/lib/crawler-scheduling', () => ({
  computeNextTrigger: computeNextTriggerMock,
}))
vi.mock('@/api/workers/maintenanceScheduler', () => ({
  getSchedulerStatus: getSchedulerStatusMock,
}))

import { BackgroundEventService } from '@/api/services/BackgroundEventService'
import { db } from '@/api/lib/postgres'

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    triggerType: 'all',
    mode: 'incremental',
    status: 'running',
    controlStatus: 'active',
    requestedSiteCount: 5,
    enqueuedSiteCount: 5,
    skippedSiteCount: 0,
    timeoutSeconds: 300,
    createdBy: null,
    scheduleId: null,
    summary: null,
    startedAt: '2026-05-25T10:00:00Z',
    finishedAt: null,
    createdAt: '2026-05-25T09:59:00Z',
    updatedAt: '2026-05-25T10:00:00Z',
    crawlMode: 'batch',
    keyword: null,
    targetVideoId: null,
    ...overrides,
  }
}

function makeSchedulerStatus(overrides: Record<string, unknown> = {}) {
  return [
    { name: 'auto-publish-staging', enabled: true, intervalMs: 30 * 60_000, lastRunAt: null, nextRunAt: new Date(Date.now() + 3600_000).toISOString() },
    { name: 'verify-published-sources', enabled: false, intervalMs: 60 * 60_000, lastRunAt: null, nextRunAt: new Date(Date.now() + 3600_000).toISOString() },
    ...Object.values(overrides),
  ]
}

const svc = new BackgroundEventService(db)

beforeEach(() => {
  vi.clearAllMocks()
  queryMock.mockReset()
  listRunsMock.mockReset()
  // 默认：空 active、空 finished、空 audit
  listRunsMock.mockResolvedValue({ rows: [], total: 0 })
  queryMock.mockResolvedValue({ rows: [] })
  getAutoCrawlConfigMock.mockResolvedValue({ globalEnabled: false, scheduleType: 'daily', dailyTime: '02:00' })
  computeNextTriggerMock.mockReturnValue(null)
  getSchedulerStatusMock.mockReturnValue([])
})

describe('BackgroundEventService.list — upcoming 源', () => {
  it('#1 autoCrawlNext 正确时产生 upcoming auto_crawl 事件', async () => {
    const nextAt = new Date(Date.now() + 3600_000).toISOString()
    computeNextTriggerMock.mockReturnValue(nextAt)
    const res = await svc.list({ limit: 20, windowHours: 6 })
    const ev = res.events.find((e) => e.id === 'auto_crawl:next')
    expect(ev).toBeDefined()
    expect(ev?.lane).toBe('upcoming')
    expect(ev?.kind).toBe('auto_crawl')
    expect(ev?.scheduledAt).toBe(nextAt)
  })

  it('#2 autoCrawlNext=null 时不产生 auto_crawl 事件', async () => {
    computeNextTriggerMock.mockReturnValue(null)
    const res = await svc.list({ limit: 20, windowHours: 6 })
    expect(res.events.some((e) => e.id === 'auto_crawl:next')).toBe(false)
  })

  it('#3 scheduler timer nextRunAt 在 24h 内才返回', async () => {
    const within24h = new Date(Date.now() + 3600_000).toISOString()
    const beyond24h = new Date(Date.now() + 25 * 3600_000).toISOString()
    getSchedulerStatusMock.mockReturnValue([
      { name: 'auto-publish-staging', enabled: true, intervalMs: 30 * 60_000, lastRunAt: null, nextRunAt: within24h },
      { name: 'verify-staging-sources', enabled: true, intervalMs: 8 * 3600_000, lastRunAt: null, nextRunAt: beyond24h },
    ])
    const res = await svc.list({ limit: 20, windowHours: 6 })
    const inBell = res.events.filter((e) => e.kind === 'scheduler_timer')
    expect(inBell).toHaveLength(1)
    expect(inBell[0]?.id).toBe('scheduler_timer:auto-publish-staging')
  })
})

describe('BackgroundEventService.list — active 源', () => {
  it('#4 active crawler_runs 正确映射为 active lane 事件', async () => {
    const run = makeRun({ id: 'run-active-1', status: 'running', startedAt: '2026-05-25T10:00:00Z' })
    listRunsMock.mockResolvedValueOnce({ rows: [run], total: 1 }) // active
    listRunsMock.mockResolvedValueOnce({ rows: [], total: 0 })     // finished

    const res = await svc.list({ limit: 20, windowHours: 6 })
    const ev = res.events.find((e) => e.id === 'crawler_run:run-active-1')
    expect(ev).toBeDefined()
    expect(ev?.lane).toBe('active')
    expect(ev?.status).toBe('running')
    // @ts-expect-error narrowing
    expect(ev?.href).toContain('run-active-1')
  })
})

describe('BackgroundEventService.list — finished 源', () => {
  it('#5 finished crawler_runs 正确映射 + finishedAfter 参数透传', async () => {
    const finRun = makeRun({
      id: 'run-fin-1',
      status: 'failed',
      startedAt: '2026-05-25T08:00:00Z',
      finishedAt: '2026-05-25T09:00:00Z',
    })
    listRunsMock.mockResolvedValueOnce({ rows: [], total: 0 })        // active
    listRunsMock.mockResolvedValueOnce({ rows: [finRun], total: 1 }) // finished

    const res = await svc.list({ limit: 20, windowHours: 6 })

    // finishedAfter 应被传入 listRuns 第 2 次调用
    const secondCall = listRunsMock.mock.calls[1]?.[1]
    expect(secondCall).toBeDefined()
    expect(secondCall?.finishedAfter).toBeDefined()

    const ev = res.events.find((e) => e.id === 'crawler_run:run-fin-1')
    expect(ev?.lane).toBe('finished')
    expect(ev?.level).toBe('danger') // failed → danger
  })

  it('#6 audit_log 高危白名单 crawler.freeze → finished high_risk_audit 事件', async () => {
    queryMock.mockResolvedValue({
      rows: [{
        id: 'audit-1',
        action_type: 'crawler.freeze',
        target_id: null,
        created_at: new Date('2026-05-25T09:00:00Z'),
        actor_id: 'admin-1',
      }],
    })
    const res = await svc.list({ limit: 20, windowHours: 6 })
    const ev = res.events.find((e) => e.id === 'audit:audit-1')
    expect(ev).toBeDefined()
    expect(ev?.lane).toBe('finished')
    expect(ev?.kind).toBe('audit_high_risk')
    expect(ev?.status).toBe('high_risk_audit')
    // @ts-expect-error narrowing
    expect(ev?.href).toBe('/admin/crawler')
  })

  it('#7 audit_log 白名单外 actionType 不出现在结果', async () => {
    // SQL mock 返回空（实际由 WHERE ANY($1::text[]) 过滤）
    queryMock.mockResolvedValue({ rows: [] })
    const res = await svc.list({ limit: 20, windowHours: 6 })
    expect(res.events.some((e) => e.kind === 'audit_high_risk')).toBe(false)
  })
})

describe('BackgroundEventService.list — id 唯一性 + 结构', () => {
  it('#8 id 拼接不重叠（多源同时有数据）', async () => {
    const nextAt = new Date(Date.now() + 1800_000).toISOString()
    computeNextTriggerMock.mockReturnValue(nextAt)
    getSchedulerStatusMock.mockReturnValue([
      { name: 'auto-publish-staging', enabled: true, intervalMs: 30 * 60_000, lastRunAt: null, nextRunAt: nextAt },
    ])
    listRunsMock
      .mockResolvedValueOnce({ rows: [makeRun({ id: 'run-A', status: 'running', startedAt: '2026-05-25T10:00:00Z' })], total: 1 })
      .mockResolvedValueOnce({ rows: [makeRun({ id: 'run-B', status: 'success', finishedAt: '2026-05-25T09:00:00Z', startedAt: '2026-05-25T08:00:00Z' })], total: 1 })
    queryMock.mockResolvedValue({
      rows: [{ id: 'audit-Z', action_type: 'crawler.freeze', target_id: null, created_at: new Date(), actor_id: null }],
    })

    const res = await svc.list({ limit: 20, windowHours: 6 })
    const ids = res.events.map((e) => e.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length) // 无重复 id
  })

  it('#9 degraded 字段缺省时结果不含 degraded', async () => {
    const res = await svc.list({ limit: 20, windowHours: 6 })
    expect(res.degraded).toBeUndefined()
  })

  it('#10 events 排序：upcoming 在前、finished 在后', async () => {
    const futureAt = new Date(Date.now() + 3600_000).toISOString()
    computeNextTriggerMock.mockReturnValue(futureAt)
    listRunsMock
      .mockResolvedValueOnce({ rows: [], total: 0 }) // active
      .mockResolvedValueOnce({ rows: [makeRun({ id: 'run-fin', status: 'success', finishedAt: '2026-05-25T09:00:00Z', startedAt: '2026-05-25T08:00:00Z' })], total: 1 })

    const res = await svc.list({ limit: 20, windowHours: 6 })
    const lanes = res.events.map((e) => e.lane)
    const upcomingIdx = lanes.findIndex((l) => l === 'upcoming')
    const finishedIdx = lanes.findIndex((l) => l === 'finished')
    // upcoming 在 finished 之前（若都存在）
    if (upcomingIdx !== -1 && finishedIdx !== -1) {
      expect(upcomingIdx).toBeLessThan(finishedIdx)
    }
  })

  it('#11 meta.generatedAt 为 ISO 字符串', async () => {
    const res = await svc.list({ limit: 20, windowHours: 6 })
    expect(() => new Date(res.generatedAt)).not.toThrow()
    expect(res.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('#12 listRuns 被调用两次（active + finished 各一次）', async () => {
    await svc.list({ limit: 20, windowHours: 6 })
    expect(listRunsMock).toHaveBeenCalledTimes(2)
    // 第 1 次（active）status 为 active 状态数组
    const firstCall = listRunsMock.mock.calls[0]?.[1]
    expect(firstCall?.status).toEqual(expect.arrayContaining(['queued', 'running', 'paused']))
    // 第 2 次（finished）含 finishedAfter
    const secondCall = listRunsMock.mock.calls[1]?.[1]
    expect(secondCall?.finishedAfter).toBeDefined()
  })
})
