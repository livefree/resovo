/**
 * tests/unit/api/auto-retire-line-queries.test.ts
 *
 * CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A / Wave 4 #5-A / ADR-164 D-164-8
 * + Codex stop-time review FIX-1（lock 同 client + deleted_at 过滤）
 *
 * 覆盖（arch-reviewer Opus 评审 ≥ 7 case + Codex FIX-1 2 case）：
 *   T1 — alias 全 dead 且 dead_since IS NULL → 上升沿 SQL 写 NOW()
 *   T2 — alias 当前有非 dead source → 下降沿 SQL 清 NULL（R-DEAD-2 下降沿）
 *   T3 — 孤儿 alias（无 source）且 dead_since IS NOT NULL → 显式清 NULL（R-DEAD-2 关键）
 *   T4 — dead_since < NOW() - 180 days → 段 3 触发 retire UPDATE + RETURNING 行
 *   T5 — 待退役 alias > 50 → batch limit + ORDER BY dead_since ASC（防雪崩）
 *   T6 — pg_try_advisory_lock 返回 false → 段 1+2/3 跳过 + 返回 [] + log info（R-DEAD-3）
 *   T7 — 全部既有 retired_at IS NOT NULL → 段 1 CTE WHERE retired_at IS NULL 过滤
 *   T8 — advisory unlock 必在 finally 调用（防泄漏 / R-DEAD-3 unlock 不漏）
 *   T9 — 所有 query 调用必在同一 PoolClient 上（Codex FIX-1 / session-level lock 关键）
 *   T10 — CTE LEFT JOIN 必含 vs.deleted_at IS NULL 守卫（Codex FIX-1 / 软删过滤）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  autoRetireLineByDeadCheck,
  DEAD_THRESHOLD_DAYS,
  RETIRE_BATCH_LIMIT,
  type RetiredAliasRow,
} from '@/api/db/queries/auto-retire-line'

interface QueryCall {
  text: string
  values?: unknown[]
}

type QueryResponse = { rows: unknown[]; rowCount?: number }

function makePoolAndClient(plan: {
  lockAcquired?: boolean
  retiredRows?: RetiredAliasRow[]
}) {
  const calls: QueryCall[] = []
  const clientQuery = vi.fn(async (sql: string, values?: unknown[]): Promise<QueryResponse> => {
    calls.push({ text: sql, values })
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ acquired: plan.lockAcquired ?? true }], rowCount: 1 }
    }
    if (sql.includes('pg_advisory_unlock')) {
      return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 }
    }
    if (sql.includes('WITH alias_dead_status')) {
      return { rows: [], rowCount: 3 }
    }
    if (sql.startsWith('\nUPDATE source_line_aliases')) {
      const rows = plan.retiredRows ?? []
      return { rows, rowCount: rows.length }
    }
    return { rows: [], rowCount: 0 }
  })
  const release = vi.fn()
  const client = { query: clientQuery, release } as unknown as import('pg').PoolClient

  const poolConnect = vi.fn().mockResolvedValue(client)
  const poolQuery = vi.fn().mockRejectedValue(
    new Error('Test guard: autoRetireLineByDeadCheck 必须用 client.query 不用 pool.query (R-DEAD-3 FIX-1)'),
  )
  const pool = { connect: poolConnect, query: poolQuery } as unknown as import('pg').Pool

  return { pool, client, calls, clientQuery, release, poolConnect, poolQuery }
}

function makeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as import('pino').Logger
}

describe('autoRetireLineByDeadCheck — query 层（CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A + Codex FIX-1）', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── R-DEAD-3 / Codex FIX-1 同 client 守卫 ──────────────────────────

  it('T6 advisory lock 拿不到 → 跳过段 1+2/3 + 返回 [] + log info + 仍 release client', async () => {
    const harness = makePoolAndClient({ lockAcquired: false })
    const log = makeLog()
    const result = await autoRetireLineByDeadCheck(harness.pool, log)

    expect(result).toEqual([])
    expect(harness.calls.length).toBe(1)
    expect(harness.calls[0]?.text).toContain('pg_try_advisory_lock')
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ lock_key: expect.stringContaining('worker:auto-retire-line') }),
      expect.stringContaining('another instance holds advisory lock'),
    )
    // 拿不到锁 → 不调 unlock（防 PG NOTICE 噪音）
    const unlockCalled = harness.calls.some((c) => c.text.includes('pg_advisory_unlock'))
    expect(unlockCalled).toBe(false)
    // 但 client 仍 release（防 PoolClient 泄漏）
    expect(harness.release).toHaveBeenCalledTimes(1)
  })

  it('T8 advisory unlock + release 必在 finally（即使段 1+2 SQL 抛错也调）', async () => {
    const calls: QueryCall[] = []
    const clientQuery = vi.fn(async (sql: string): Promise<QueryResponse> => {
      calls.push({ text: sql })
      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired: true }], rowCount: 1 }
      }
      if (sql.includes('pg_advisory_unlock')) {
        return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 }
      }
      throw new Error('段 1+2 SQL 故障')
    })
    const release = vi.fn()
    const client = { query: clientQuery, release } as unknown as import('pg').PoolClient
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockRejectedValue(new Error('should not be called')),
    } as unknown as import('pg').Pool
    const log = makeLog()

    await expect(autoRetireLineByDeadCheck(pool, log)).rejects.toThrow('段 1+2 SQL 故障')

    const unlockCall = calls.find((c) => c.text.includes('pg_advisory_unlock'))
    expect(unlockCall).toBeTruthy()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('T9 所有 query 必在同一 client（Codex FIX-1 / lock + unlock 同 connection / 不调 pool.query）', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await autoRetireLineByDeadCheck(harness.pool, log)

    // pool.connect 仅调 1 次
    expect(harness.poolConnect).toHaveBeenCalledTimes(1)
    // pool.query 一次都不调（防 cross-connection unlock 失败 / lock 永久泄漏）
    expect(harness.poolQuery).not.toHaveBeenCalled()
    // 所有 4 段 query 都通过 client.query
    expect(harness.clientQuery.mock.calls.length).toBeGreaterThanOrEqual(4)
    // release 必调 1 次
    expect(harness.release).toHaveBeenCalledTimes(1)
  })

  // ── 段 1+2 维护 dead_since 状态机 + Codex FIX-1 deleted_at 守卫 ──────

  it('T1+T2+T3+T7 段 1+2 SQL 必含 CTE + LEFT JOIN + classified CASE + 三态守卫 WHERE', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await autoRetireLineByDeadCheck(harness.pool, log)

    const maintainCall = harness.calls.find((c) => c.text.includes('WITH alias_dead_status'))
    expect(maintainCall).toBeDefined()
    const sql = maintainCall!.text
    // T1 上升沿守卫
    expect(sql).toContain(`'all_dead'`)
    expect(sql).toContain('NOW()')
    // T2 下降沿守卫
    expect(sql).toContain(`'has_alive'`)
    // T3 孤儿状态 + 显式清 NULL（R-DEAD-2 关键 / 防 source 被删后 dead_since 卡死）
    expect(sql).toContain(`'orphan'`)
    expect(sql).toMatch(/orphan'\s+AND\s+sla\.dead_since\s+IS\s+NOT\s+NULL/)
    // T7 retired_at IS NULL 过滤
    expect(sql).toMatch(/WHERE sla\.retired_at IS NULL/)
    // R-DEAD-2 必须 LEFT JOIN
    expect(sql).toMatch(/LEFT JOIN video_sources/)
  })

  it('T10 CTE LEFT JOIN 必含 vs.deleted_at IS NULL 守卫（Codex FIX-1 / 软删过滤）', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await autoRetireLineByDeadCheck(harness.pool, log)

    const maintainCall = harness.calls.find((c) => c.text.includes('WITH alias_dead_status'))
    expect(maintainCall).toBeDefined()
    const sql = maintainCall!.text
    // 软删 source 必须排除（否则 dead_count + source_count 含已弃用 source / 误判 state）
    expect(sql).toMatch(/AND\s+vs\.deleted_at\s+IS\s+NULL/)
    // 与 is_active = true 共存
    expect(sql).toMatch(/AND\s+vs\.is_active\s+=\s+true/)
  })

  // ── 段 3 检测 + 退役 ────────────────────────────────────────────

  it('T4 段 3 检测到 dead_since < NOW() - 180 days → UPDATE + RETURNING 行', async () => {
    const retiredRows: RetiredAliasRow[] = [
      { source_site_key: 'site_a', source_name: '线A', dead_since: '2025-09-01T00:00:00Z' },
    ]
    const harness = makePoolAndClient({ retiredRows })
    const log = makeLog()
    const result = await autoRetireLineByDeadCheck(harness.pool, log)

    expect(result).toEqual(retiredRows)

    const retireCall = harness.calls.find((c) =>
      c.text.includes('UPDATE source_line_aliases') &&
      c.text.includes('retired_at') &&
      c.text.includes('auto_retired'),
    )
    expect(retireCall).toBeDefined()
    expect(retireCall!.values).toEqual([DEAD_THRESHOLD_DAYS, RETIRE_BATCH_LIMIT])
    expect(retireCall!.text).toMatch(/SET retired_at\s+=\s+NOW\(\)/)
    expect(retireCall!.text).toMatch(/auto_retired\s+=\s+true/)
    expect(retireCall!.text).toContain('RETURNING source_site_key, source_name, dead_since')
  })

  it('T5 batch limit + ORDER BY dead_since ASC（防雪崩 + 优先退役最老）', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await autoRetireLineByDeadCheck(harness.pool, log)

    const retireCall = harness.calls.find((c) =>
      c.text.includes('UPDATE source_line_aliases') &&
      c.text.includes('retired_at') &&
      c.text.includes('auto_retired'),
    )
    expect(retireCall).toBeDefined()
    expect(retireCall!.text).toMatch(/ORDER BY dead_since ASC\s+LIMIT \$2/)
    expect(retireCall!.values?.[1]).toBe(RETIRE_BATCH_LIMIT)
    expect(RETIRE_BATCH_LIMIT).toBe(50)
  })

  // ── R-DEAD-1 段 2 / 段 3 必须独立 SQL ─────────────────────────────

  it('R-DEAD-1：段 1+2 维护 SQL 与 段 3 退役 SQL 是两个独立 query 调用', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await autoRetireLineByDeadCheck(harness.pool, log)

    // 调用序列：lock → 段 1+2 UPDATE → 段 3 UPDATE → unlock
    const sqlSeq = harness.calls.map((c) => {
      if (c.text.includes('pg_try_advisory_lock')) return 'lock'
      if (c.text.includes('pg_advisory_unlock')) return 'unlock'
      if (c.text.includes('WITH alias_dead_status')) return 'maintain'
      if (c.text.includes('UPDATE source_line_aliases') && c.text.includes('retired_at') && c.text.includes('auto_retired')) return 'retire'
      return 'other'
    })
    expect(sqlSeq).toEqual(['lock', 'maintain', 'retire', 'unlock'])
  })
})
