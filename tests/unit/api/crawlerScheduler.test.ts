/**
 * crawlerScheduler.test.ts — ADR-154 Fix-D5 单测（CW2-C-EP-A）
 *
 * 覆盖：
 *   #1  checkInterval：首次触发（lastTriggerAt=null）→ true
 *   #2  checkInterval：未到期 → false
 *   #3  checkInterval：刚好到期（dueAt === now）→ true
 *   #4  checkInterval：超过到期时间 → true
 *   #5  checkDaily：current === dailyTime 且今天未触发 → true
 *   #6  checkDaily：current !== dailyTime → false
 *   #7  checkDaily：已触发过今天 → false
 *   #8  deserializeAutoCrawlConfig：无 intervalMinutes 键 → 默认 60
 *   #9  deserializeAutoCrawlConfig：scheduleType='interval' → 正确反序列化
 *   #10 setAutoCrawlConfig：写入 scheduleType + intervalMinutes（解除写死）
 *   #11 R-154-1 锚点时序：checkInterval 判断到期 + autoConfig scheduleType=interval
 *         → 单测不含 createRun（集成验证），只验证纯函数语义正确
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock DB ───────────────────────────────────────────────────────
const mockQuery = vi.fn()
const mockClientQuery = vi.fn()
const mockRelease = vi.fn()
const mockClient = { query: mockClientQuery, release: mockRelease }
const mockConnect = vi.fn().mockResolvedValue(mockClient)

vi.mock('@/api/lib/postgres', () => ({ db: { query: mockQuery, connect: mockConnect } }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/lib/config', () => ({
  config: { DATABASE_URL: 'postgres://test' },
}))
vi.mock('@/api/lib/logger', () => {
  const makeMockLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => makeMockLogger() })
  return {
    baseLogger: makeMockLogger(),
    createLogger: () => makeMockLogger(),
  }
})

// ── Tests: checkInterval（纯函数，无 IO）──────────────────────────

describe('checkInterval（ADR-154 D-154-5）', () => {
  const config = { intervalMinutes: 60 }

  it('#1 首次触发（lastTriggerAt=null）→ true', async () => {
    const { checkInterval } = await import('@/api/workers/crawlerScheduler')
    expect(checkInterval(config, new Date(), null)).toBe(true)
  })

  it('#2 未到期 → false（59 分钟后）', async () => {
    const { checkInterval } = await import('@/api/workers/crawlerScheduler')
    const now = new Date()
    const lastTriggerAt = new Date(now.getTime() - 59 * 60_000)
    expect(checkInterval(config, now, lastTriggerAt)).toBe(false)
  })

  it('#3 刚好到期（dueAt === now）→ true', async () => {
    const { checkInterval } = await import('@/api/workers/crawlerScheduler')
    const now = new Date()
    const lastTriggerAt = new Date(now.getTime() - 60 * 60_000)
    expect(checkInterval(config, now, lastTriggerAt)).toBe(true)
  })

  it('#4 超过到期时间 → true（90 分钟后）', async () => {
    const { checkInterval } = await import('@/api/workers/crawlerScheduler')
    const now = new Date()
    const lastTriggerAt = new Date(now.getTime() - 90 * 60_000)
    expect(checkInterval(config, now, lastTriggerAt)).toBe(true)
  })

  it('#4b intervalMinutes=5（最短间隔）边界 → 刚好到期为 true', async () => {
    const { checkInterval } = await import('@/api/workers/crawlerScheduler')
    const cfg = { intervalMinutes: 5 }
    const now = new Date()
    const lastTriggerAt = new Date(now.getTime() - 5 * 60_000)
    expect(checkInterval(cfg, now, lastTriggerAt)).toBe(true)
    // 4 分钟：未到期
    const lastTriggerAt2 = new Date(now.getTime() - 4 * 60_000)
    expect(checkInterval(cfg, now, lastTriggerAt2)).toBe(false)
  })
})

// ── Tests: checkDaily（纯函数，无 IO）────────────────────────────

describe('checkDaily（ADR-154 D-154-5）', () => {
  it('#5 current === dailyTime 且今天未触发 → true', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 0, 0)  // 03:00
    expect(checkDaily({ dailyTime: '03:00' }, now, '2026-05-24')).toBe(true)  // 昨天
    expect(checkDaily({ dailyTime: '03:00' }, now, null)).toBe(true)           // 从未触发
  })

  it('#6 current !== dailyTime → false', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 1, 0)  // 03:01
    expect(checkDaily({ dailyTime: '03:00' }, now, null)).toBe(false)
  })

  it('#7 已触发过今天 → false', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 0, 0)  // 03:00
    expect(checkDaily({ dailyTime: '03:00' }, now, '2026-05-25')).toBe(false)
  })
})

// ── Tests: deserializeAutoCrawlConfig──────────────────────────────

describe('deserializeAutoCrawlConfig（ADR-154 D-154-1 向后兼容）', () => {
  it('#8 无 intervalMinutes 键 → 默认 60', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')

    const raw: Record<string, string> = {
      auto_crawl_enabled: 'true',
      auto_crawl_daily_time: '03:00',
      auto_crawl_default_mode: 'incremental',
      // 无 auto_crawl_interval_minutes
    }

    const config = deserializeAutoCrawlConfig(raw)
    expect(config.intervalMinutes).toBe(60)
    expect(config.scheduleType).toBe('daily')  // 无 schedule_type 键 → 默认 daily
  })

  it('#9 scheduleType=interval → 正确反序列化', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')

    const raw: Record<string, string> = {
      auto_crawl_enabled: 'true',
      auto_crawl_schedule_type: 'interval',
      auto_crawl_interval_minutes: '120',
      auto_crawl_daily_time: '03:00',
      auto_crawl_default_mode: 'incremental',
    }

    const config = deserializeAutoCrawlConfig(raw)
    expect(config.scheduleType).toBe('interval')
    expect(config.intervalMinutes).toBe(120)
  })

  it('#9b intervalMinutes 边界钳值：< 5 → 5', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')

    const raw: Record<string, string> = {
      auto_crawl_enabled: 'true',
      auto_crawl_schedule_type: 'interval',
      auto_crawl_interval_minutes: '2',  // 低于 min=5
    }

    const config = deserializeAutoCrawlConfig(raw)
    expect(config.intervalMinutes).toBe(5)  // 钳为最小值
  })
})

// ── Tests: setAutoCrawlConfig 写 scheduleType + intervalMinutes ──

describe('setAutoCrawlConfig（ADR-154 D-154-1 写入解除写死）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    mockConnect.mockResolvedValue(mockClient)
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    mockRelease.mockReturnValue(undefined)
  })

  it('#10 scheduleType=interval + intervalMinutes=120 → 写入两个新键', async () => {
    const { setAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')

    const db = { query: mockQuery, connect: mockConnect } as never
    await setAutoCrawlConfig(db, {
      globalEnabled: true,
      scheduleType: 'interval',
      intervalMinutes: 120,
      dailyTime: '03:00',
      defaultMode: 'incremental',
      onlyEnabledSites: true,
      conflictPolicy: 'skip_running',
      perSiteOverrides: {},
    })

    // 验证 client.query 被调用（setManySettings 内部 INSERT INTO ... ON CONFLICT DO UPDATE）
    expect(mockClientQuery).toHaveBeenCalled()
    // setManySettings 使用参数化 SQL：`INSERT ... VALUES ($1, $2, ...)`
    // key 在 c[1][0]（第一个参数），value 在 c[1][1]（第二个参数）
    const scheduleTypeCall = mockClientQuery.mock.calls.find(
      (c) => Array.isArray(c[1]) && c[1][0] === 'auto_crawl_schedule_type'
    )
    expect(scheduleTypeCall).toBeTruthy()
    expect(scheduleTypeCall![1][1]).toBe('interval')

    const intervalMinutesCall = mockClientQuery.mock.calls.find(
      (c) => Array.isArray(c[1]) && c[1][0] === 'auto_crawl_interval_minutes'
    )
    expect(intervalMinutesCall).toBeTruthy()
    expect(intervalMinutesCall![1][1]).toBe('120')
  })
})
