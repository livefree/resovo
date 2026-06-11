import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import type pino from 'pino'
import { persistCircuitTransition } from '../../../../../apps/worker/src/jobs/source-health/host-health'

/**
 * SRCHEALTH-P3-3-B1：host_health 翻转事件落库（arch-reviewer 裁决 B）。
 * 不变式：仅翻转事件写库（null 不写）；UPSERT 幂等；落库失败不抛（探测主流程不阻断）。
 */

const mockQuery = vi.fn()
const pool = { query: mockQuery } as unknown as Pool
const warn = vi.fn()
const log = { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() } as unknown as pino.Logger

describe('persistCircuitTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 })
  })

  it('transition=null 不写库（逐次探测调用不产生写放大）', async () => {
    await persistCircuitTransition(pool, log, 'cdn.example.com', null)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('tripped：UPSERT 设置 cooldown_until + trip_count 累加', async () => {
    await persistCircuitTransition(pool, log, 'cdn.example.com', 'tripped')

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('INSERT INTO host_health')
    expect(sql).toContain('ON CONFLICT (hostname) DO UPDATE')
    expect(sql).toContain('cooldown_until = EXCLUDED.cooldown_until')
    expect(sql).toContain('trip_count = host_health.trip_count + 1')
    expect(sql).toContain('last_tripped_at')
    expect(params[0]).toBe('cdn.example.com')
    // cooldown 秒数来自 config.circuitBreaker.cooldownMs（30min）同一真源
    expect(params[1]).toBe(30 * 60)
  })

  it('recovered：UPSERT 清 cooldown_until + 刷 last_success_at', async () => {
    await persistCircuitTransition(pool, log, 'cdn.example.com', 'recovered')

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('cooldown_until = NULL')
    expect(sql).toContain('last_success_at = NOW()')
    expect(sql).not.toContain('trip_count = host_health.trip_count + 1')
    expect(params).toEqual(['cdn.example.com'])
  })

  it('落库失败 catch+warn 不抛（探测主流程不阻断）', async () => {
    mockQuery.mockRejectedValue(new Error('connection lost'))

    await expect(
      persistCircuitTransition(pool, log, 'cdn.example.com', 'tripped'),
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})
