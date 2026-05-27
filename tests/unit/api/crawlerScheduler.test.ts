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

describe('checkDaily（ADR-155 D-155-6 EP-1C-1b 多 dailyTime + marks 防重）', () => {
  // ADR-155 D-155-6 / EP-1C-CLEANUP-B3a：#5 dailyTime alias 兼容路径已随 checkDaily fallback 删除
  // （fallback `[config.dailyTime || '03:00']` 不再存在 / 类型 required + 反序列化兜底非空保证）

  it('#6 W3-FIX HOTFIX-D: current 在 dailyTime 后 1 分钟（catch-up window 内）→ 触发 + matchedTime 是原 dailyTime', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 1, 0)  // 03:01（dailyTime=03:00 后 1 分钟）
    // catch-up window 5 分钟内未触发 → 补触发；matchedTime 仍是原 dailyTime（写 marks 用）
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, {})).toEqual({
      shouldTrigger: true,
      matchedTime: '03:00',
    })
  })

  it('#7 marks 含今天该时间 → shouldTrigger=false（防重）', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 0, 0)  // 03:00
    const marks = { '2026-05-25 03:00': '2026-05-25T03:00:00.000Z' }
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, marks)).toEqual({
      shouldTrigger: false,
      matchedTime: null,
    })
  })

  // ── ADR-155 D-155-6 EP-1C-1b 新增 case ──
  it('#7b 多 dailyTime 任一匹配 → shouldTrigger=true + matchedTime 正确识别', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const config = { dailyTimes: ['03:00', '04:00', '05:00'] }
    // 03:00 匹配
    expect(checkDaily(config, new Date(2026, 4, 25, 3, 0, 0), {})).toEqual({
      shouldTrigger: true, matchedTime: '03:00',
    })
    // 04:00 匹配
    expect(checkDaily(config, new Date(2026, 4, 25, 4, 0, 0), {})).toEqual({
      shouldTrigger: true, matchedTime: '04:00',
    })
    // 03:30 不匹配
    expect(checkDaily(config, new Date(2026, 4, 25, 3, 30, 0), {})).toEqual({
      shouldTrigger: false, matchedTime: null,
    })
  })

  it('#7c 同日不同 dailyTime 各触发一次（3am 已触发不阻塞 4am）', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const config = { dailyTimes: ['03:00', '04:00'] }
    // marks 仅含 03:00 → 04:00 仍可触发
    const marks = { '2026-05-25 03:00': '2026-05-25T03:00:00.000Z' }
    expect(checkDaily(config, new Date(2026, 4, 25, 4, 0, 0), marks)).toEqual({
      shouldTrigger: true, matchedTime: '04:00',
    })
    // marks 同时含 03:00 + 04:00 → 都不触发
    const marksBoth = {
      '2026-05-25 03:00': '2026-05-25T03:00:00.000Z',
      '2026-05-25 04:00': '2026-05-25T04:00:00.000Z',
    }
    expect(checkDaily(config, new Date(2026, 4, 25, 3, 0, 0), marksBoth)).toEqual({
      shouldTrigger: false, matchedTime: null,
    })
    expect(checkDaily(config, new Date(2026, 4, 25, 4, 0, 0), marksBoth)).toEqual({
      shouldTrigger: false, matchedTime: null,
    })
  })

  // ADR-155 D-155-6 / EP-1C-CLEANUP-B3a：#7d dailyTimes 空数组兜底 case 已随 fallback 删除
  // （类型 required + 反序列化兜底永远输出非空数组 / zod transform refine 守门）

  // ── W3-FIX HOTFIX-D：catch-up window 边界 ──────────────────────
  it('#8a HOTFIX-D: diffMs=0（精确匹配）→ 触发', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 0, 0)  // 03:00:00
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, {})).toEqual({
      shouldTrigger: true, matchedTime: '03:00',
    })
  })

  it('#8b HOTFIX-D: diffMs=60s（1 分钟 catch-up）→ 触发', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 1, 0)  // 03:01（dailyTime=03:00 后 1 分钟）
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, {})).toEqual({
      shouldTrigger: true, matchedTime: '03:00',
    })
  })

  it('#8c HOTFIX-D: diffMs=300s（5 分钟边界 / 仍在窗口内）→ 触发', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 5, 0)  // 03:05（dailyTime=03:00 后 5 分钟整）
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, {})).toEqual({
      shouldTrigger: true, matchedTime: '03:00',
    })
  })

  it('#8d HOTFIX-D: diffMs=301s（超 5 分钟边界）→ 不触发', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 5, 1)  // 03:05:01
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, {})).toEqual({
      shouldTrigger: false, matchedTime: null,
    })
  })

  it('#8e HOTFIX-D: diffMs<0（target 在未来 / now=02:59）→ 不触发', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 2, 59, 0)  // 02:59（dailyTime=03:00 前 1 分钟）
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, {})).toEqual({
      shouldTrigger: false, matchedTime: null,
    })
  })

  it('#8f HOTFIX-D: 跨午夜不补昨日 dailyTime（now=00:05 / dailyTime=23:59）→ 不触发', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 26, 0, 5, 0)  // 00:05（次日凌晨）
    // dailyTime=23:59 今天的 target=2026-05-26 23:59 → 在未来 → 不触发
    // 这防止 server 跨午夜重启误补昨夜（旧行为）
    expect(checkDaily({ dailyTimes: ['23:59'] }, now, {})).toEqual({
      shouldTrigger: false, matchedTime: null,
    })
  })

  it('#8g HOTFIX-D: catch-up 内但 marks 已含 → 不重触发（防重叠加 catch-up）', async () => {
    const { checkDaily } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 3, 3, 0)  // 03:03（dailyTime=03:00 后 3 分钟 / 窗口内）
    const marks = { '2026-05-25 03:00': '2026-05-25T03:00:00.000Z' }
    expect(checkDaily({ dailyTimes: ['03:00'] }, now, marks)).toEqual({
      shouldTrigger: false, matchedTime: null,
    })
  })
})

describe('gcOldMarks（ADR-155 D-155-6 EP-1C-1b Y-155-2）', () => {
  it('#7e 清理 7 天前的 keys（datePart < cutoff）', async () => {
    const { gcOldMarks } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 12, 0, 0)  // 2026-05-25
    // cutoff = 2026-05-18（now - 7d）
    const marks = {
      '2026-05-18 03:00': 'iso-1',  // 临界（保留）
      '2026-05-17 03:00': 'iso-2',  // 7+ 天前（清理）
      '2026-05-25 03:00': 'iso-3',  // 今天（保留）
      '2026-05-10 04:00': 'iso-4',  // 远过期（清理）
    }
    const result = gcOldMarks(marks, now)
    expect(result).toEqual({
      '2026-05-18 03:00': 'iso-1',
      '2026-05-25 03:00': 'iso-3',
    })
  })

  it('#7f retentionDays 参数自定义（如 3 天）', async () => {
    const { gcOldMarks } = await import('@/api/workers/crawlerScheduler')
    const now = new Date(2026, 4, 25, 0, 0, 0)
    const marks = {
      '2026-05-22 03:00': 'iso-1',  // 3 天前临界（保留）
      '2026-05-21 03:00': 'iso-2',  // 4 天前（清理）
    }
    const result = gcOldMarks(marks, now, 3)
    expect(result).toEqual({ '2026-05-22 03:00': 'iso-1' })
  })

  it('#7g 空 marks → 空对象', async () => {
    const { gcOldMarks } = await import('@/api/workers/crawlerScheduler')
    expect(gcOldMarks({}, new Date())).toEqual({})
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
      dailyTimes: ['03:00'],         // ADR-155 D-155-6 / EP-1C-CLEANUP-B1：主字段
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

// ── Tests: parseDailyTimes 3 路径兼容（ADR-155 D-155-6 / EP-1C-1a R-155-3）──

describe('parseDailyTimes（ADR-155 D-155-6 KV 3 路径兼容）', () => {
  beforeEach(() => {
    // 避免前序 describe 的 client.query mock 调用残留
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    mockConnect.mockResolvedValue(mockClient)
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    mockRelease.mockReturnValue(undefined)
  })

  it('#11 旧裸单字符串 "03:00" → ["03:00"]（最常见历史值）', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')
    const config = deserializeAutoCrawlConfig({
      auto_crawl_enabled: 'true',
      auto_crawl_daily_time: '03:00',
    })
    expect(config.dailyTimes).toEqual(['03:00'])
    // CLEANUP-C：dailyTime alias 已删，仅验证 dailyTimes
  })

  it('#12 JSON 字符串值 \'"03:00"\' → ["03:00"]', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')
    const config = deserializeAutoCrawlConfig({
      auto_crawl_enabled: 'true',
      auto_crawl_daily_time: '"03:00"',
    })
    expect(config.dailyTimes).toEqual(['03:00'])
  })

  it('#13 JSON 数组（新格式）\'["03:00","04:00"]\' → ["03:00","04:00"]', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')
    const config = deserializeAutoCrawlConfig({
      auto_crawl_enabled: 'true',
      auto_crawl_daily_time: '["03:00","04:00"]',
    })
    expect(config.dailyTimes).toEqual(['03:00', '04:00'])
    // CLEANUP-C：dailyTime alias 已删，仅验证 dailyTimes
  })

  it('#14 空 / undefined → ["03:00"] 兜底', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')
    const config = deserializeAutoCrawlConfig({
      auto_crawl_enabled: 'true',
      // 无 auto_crawl_daily_time 键
    })
    expect(config.dailyTimes).toEqual(['03:00'])
  })

  it('#15 非法格式 / 含非 HH:MM 项 → 过滤后兜底（["03:00"] 或合法子集）', async () => {
    const { deserializeAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')
    // 数组含合法 + 非法混合 → 仅保留合法
    const config = deserializeAutoCrawlConfig({
      auto_crawl_enabled: 'true',
      auto_crawl_daily_time: '["03:00","invalid","25:99","04:00"]',
    })
    expect(config.dailyTimes).toEqual(['03:00', '04:00'])
    // 全非法 → 兜底
    const config2 = deserializeAutoCrawlConfig({
      auto_crawl_enabled: 'true',
      auto_crawl_daily_time: 'not-a-time',
    })
    expect(config2.dailyTimes).toEqual(['03:00'])
  })

  it('#16 setAutoCrawlConfig 写入 → auto_crawl_daily_time = JSON.stringify(dailyTimes)（Y-155-1）', async () => {
    const { setAutoCrawlConfig } = await import('@/api/db/queries/systemSettings')

    const db = { query: mockQuery, connect: mockConnect } as never
    await setAutoCrawlConfig(db, {
      globalEnabled: true,
      scheduleType: 'daily',
      intervalMinutes: 60,
      dailyTimes: ['03:00', '04:00'],  // 新主字段
      dailyTime: '03:00',               // alias
      defaultMode: 'incremental',
      onlyEnabledSites: true,
      conflictPolicy: 'skip_running',
      perSiteOverrides: {},
    })

    const dailyTimeCall = mockClientQuery.mock.calls.find(
      (c) => Array.isArray(c[1]) && c[1][0] === 'auto_crawl_daily_time'
    )
    expect(dailyTimeCall).toBeTruthy()
    // 写入值是 JSON 数组字符串
    expect(dailyTimeCall![1][1]).toBe('["03:00","04:00"]')
  })

  // ADR-155 D-155-6 / EP-1C-CLEANUP-B3a：#17 setAutoCrawlConfig 仅传 dailyTime 兜底 case 已删除
  // （类型 required + zod transform refine 守门 / setAutoCrawlConfig 直接 config.dailyTimes.map(parseDailyTime)）
})
