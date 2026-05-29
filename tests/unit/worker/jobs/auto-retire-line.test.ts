/**
 * tests/unit/worker/jobs/auto-retire-line.test.ts
 *
 * CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B / Wave 4 #5-B / ADR-164 D-164-8
 *
 * 覆盖（arch-reviewer §8.2 -B 子卡 ≥ 5 case）：
 *   T1 — runAutoRetireLine 调 autoRetireLineByDeadCheck + 写结构化日志
 *   T2 — queries 返回空数组 → 仅写 batch_total=0 / 不抛错 / 不写 retired log
 *   T3 — queries 返回 N 行 → N 条 auto_retire_line.retired log + 1 条 batch_total
 *   T4 — queries 抛错 → 向上抛 / 由调用方 runWithLogger 既有 try/catch 包
 *   T5 — log payload metric / retired_at ISO 字符串 / source_site_key + source_name + dead_since 字段正确
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock query 模块：vi.hoisted 保证 vi.mock 工厂前初始化
const { mockAutoRetireLineByDeadCheck } = vi.hoisted(() => ({
  mockAutoRetireLineByDeadCheck: vi.fn(),
}))

vi.mock('../../../../apps/api/src/db/queries/auto-retire-line', () => ({
  autoRetireLineByDeadCheck: mockAutoRetireLineByDeadCheck,
}))

import { runAutoRetireLine } from '../../../../apps/worker/src/jobs/auto-retire-line'

function makeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as import('pino').Logger
}

function makePool() {
  return { query: vi.fn(), connect: vi.fn() } as unknown as import('pg').Pool
}

describe('runAutoRetireLine — apps/worker job 入口（CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('T1+T5 调 query 函数 + 每条 retire 结构化日志 + batch_total 日志', async () => {
    const retired = [
      { source_site_key: 'site_a', source_name: '线A', dead_since: '2025-09-01T00:00:00.000Z' },
      { source_site_key: 'site_b', source_name: '线B', dead_since: '2025-10-15T12:30:00.000Z' },
    ]
    mockAutoRetireLineByDeadCheck.mockResolvedValueOnce(retired)
    const pool = makePool()
    const log = makeLog()

    await runAutoRetireLine(pool, log)

    // 调 query 函数
    expect(mockAutoRetireLineByDeadCheck).toHaveBeenCalledWith(pool, log)
    expect(mockAutoRetireLineByDeadCheck).toHaveBeenCalledTimes(1)

    // 每条 retire log + batch_total log = 3 次 info
    expect(log.info).toHaveBeenCalledTimes(3)

    // 第 1 行 retire log
    expect(log.info).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        metric: 'auto_retire_line.retired',
        value: 1,
        source_site_key: 'site_a',
        source_name: '线A',
        dead_since: '2025-09-01T00:00:00.000Z',
        retired_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      }),
      'auto-retire-line: alias auto-retired',
    )

    // 第 2 行 retire log
    expect(log.info).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        metric: 'auto_retire_line.retired',
        source_site_key: 'site_b',
        source_name: '线B',
        dead_since: '2025-10-15T12:30:00.000Z',
      }),
      'auto-retire-line: alias auto-retired',
    )

    // 第 3 行 batch_total log
    expect(log.info).toHaveBeenNthCalledWith(
      3,
      { metric: 'auto_retire_line.batch_total', value: 2 },
      'auto-retire-line: job completed',
    )
  })

  it('T2 queries 返回空数组 → 仅 batch_total=0 不写 retired log / 不抛错', async () => {
    mockAutoRetireLineByDeadCheck.mockResolvedValueOnce([])
    const pool = makePool()
    const log = makeLog()

    await expect(runAutoRetireLine(pool, log)).resolves.toBeUndefined()

    expect(log.info).toHaveBeenCalledTimes(1)
    expect(log.info).toHaveBeenCalledWith(
      { metric: 'auto_retire_line.batch_total', value: 0 },
      'auto-retire-line: job completed',
    )
  })

  it('T3 queries 返回 N 行 → N 条 retired log + 1 条 batch_total（N=5 边界）', async () => {
    const retired = Array.from({ length: 5 }, (_, i) => ({
      source_site_key: `site_${i}`,
      source_name: `线${i}`,
      dead_since: `2025-${String(i + 1).padStart(2, '0')}-01T00:00:00.000Z`,
    }))
    mockAutoRetireLineByDeadCheck.mockResolvedValueOnce(retired)
    const pool = makePool()
    const log = makeLog()

    await runAutoRetireLine(pool, log)

    // 5 retired + 1 batch_total = 6 次 info
    expect(log.info).toHaveBeenCalledTimes(6)
    // 最后一次 batch_total value=5
    const lastCall = (log.info as unknown as { mock: { calls: unknown[][] } }).mock.calls[5]
    expect(lastCall?.[0]).toEqual({ metric: 'auto_retire_line.batch_total', value: 5 })
  })

  it('T4 queries 抛错 → 向上抛 / 由调用方 runWithLogger 既有 try/catch 包', async () => {
    const queryError = new Error('connection reset')
    mockAutoRetireLineByDeadCheck.mockRejectedValueOnce(queryError)
    const pool = makePool()
    const log = makeLog()

    await expect(runAutoRetireLine(pool, log)).rejects.toThrow('connection reset')

    // 不应吞错 + 不应写 batch_total（错误中断）
    expect(log.info).not.toHaveBeenCalled()
  })

  it('T5b retired_at 是同一 ISO 字符串（所有 row 共享一次 new Date().toISOString()）', async () => {
    const retired = [
      { source_site_key: 'site_a', source_name: '线A', dead_since: '2025-09-01T00:00:00.000Z' },
      { source_site_key: 'site_b', source_name: '线B', dead_since: '2025-09-01T00:00:00.000Z' },
    ]
    mockAutoRetireLineByDeadCheck.mockResolvedValueOnce(retired)
    const pool = makePool()
    const log = makeLog()

    await runAutoRetireLine(pool, log)

    const calls = (log.info as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const retiredAt1 = (calls[0]?.[0] as { retired_at: string }).retired_at
    const retiredAt2 = (calls[1]?.[0] as { retired_at: string }).retired_at
    expect(retiredAt1).toBe(retiredAt2)
  })
})
