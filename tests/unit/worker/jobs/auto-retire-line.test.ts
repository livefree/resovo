/**
 * tests/unit/worker/jobs/auto-retire-line.test.ts
 *
 * CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B / Wave 4 #5-B
 * + Codex stop-time review FIX-3：撤 apps/api 跨 app import / ADR-107 §4 worker 自包含
 *
 * 测试 worker 内联 SQL + PoolClient 管理范式（与既有 advisory-lock.test.ts 同模）。
 * SQL 真源对照 apps/api/src/db/queries/auto-retire-line-queries.test.ts（10/10 case 含 Codex FIX-1/FIX-2）
 *
 * 覆盖 ≥ 8 case：
 *   T1 — 调用 connect 拿 client / 所有 query 用 client.query / 不调 pool.query / release 1 次
 *   T2 — 拿到锁 + 段 1+2 / 段 3 双独立 SQL 顺序：lock → maintain → retire → unlock
 *   T3 — 段 1+2 SQL 含 CTE + LEFT JOIN + vs.deleted_at IS NULL + vs.is_active=true + orphan 显式清 NULL
 *   T4 — 段 3 SQL 含 batch limit ORDER BY dead_since ASC + RETURNING
 *   T5 — 拿不到锁 → 跳过段 1+2/3 + log info + 仍 release client / 不调 unlock
 *   T6 — RETURNING N 行 → N 条 retired log + 1 条 batch_total
 *   T7 — RETURNING 空数组 → 仅 batch_total=0 / 不写 retired log
 *   T8 — 段 1+2 SQL 抛错 → release 调 1 次 / 不写日志 / 向上抛
 *   T9 — unlock 失败 → release(err) destroy connection + log.warn 'destroying connection'
 *   T10 — retired_at 共享同一 ISO 字符串
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAutoRetireLine } from '../../../../apps/worker/src/jobs/auto-retire-line'

interface QueryCall {
  text: string
  values?: unknown[]
}

type QueryResponse = { rows: unknown[]; rowCount?: number }

function makePoolAndClient(plan: {
  lockAcquired?: boolean
  retiredRows?: Array<{ source_site_key: string; source_name: string; dead_since: string }>
  unlockThrows?: boolean
  maintainThrows?: boolean
}) {
  const calls: QueryCall[] = []
  const clientQuery = vi.fn(async (sql: string, values?: unknown[]): Promise<QueryResponse> => {
    calls.push({ text: sql, values })
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ acquired: plan.lockAcquired ?? true }], rowCount: 1 }
    }
    if (sql.includes('pg_advisory_unlock')) {
      if (plan.unlockThrows) throw new Error('connection reset')
      return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 }
    }
    if (sql.includes('alias_dead_status AS')) {
      if (plan.maintainThrows) throw new Error('段 1+2 SQL 故障')
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
    new Error('Test guard: runAutoRetireLine 必须用 client.query 不用 pool.query (R-DEAD-3 / ADR-107)'),
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

describe('runAutoRetireLine — worker 自包含（CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B + Codex FIX-3 ADR-107 §4）', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── ADR-107 §4 + R-DEAD-3 同 client 守卫 ─────────────────────────

  it('T1 connect 拿 client / 所有 query 用 client.query / 不调 pool.query / release 1 次', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    expect(harness.poolConnect).toHaveBeenCalledTimes(1)
    expect(harness.poolQuery).not.toHaveBeenCalled()
    expect(harness.clientQuery.mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(harness.release).toHaveBeenCalledTimes(1)
  })

  it('T2 拿到锁 + 段 1+2 / 段 3 双独立 SQL 顺序：lock → maintain → retire → unlock', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    const sqlSeq = harness.calls.map((c) => {
      if (c.text.includes('pg_try_advisory_lock')) return 'lock'
      if (c.text.includes('pg_advisory_unlock')) return 'unlock'
      if (c.text.includes('alias_dead_status AS')) return 'maintain'
      if (c.text.includes('UPDATE source_line_aliases') && c.text.includes('retired_at') && c.text.includes('auto_retired')) return 'retire'
      return 'other'
    })
    expect(sqlSeq).toEqual(['lock', 'maintain', 'retire', 'unlock'])
  })

  // ── SQL 真源对照 -A queries（Codex FIX-1 deleted_at + Codex FIX-2 release(err)）──

  it('T3 段 1+2 SQL 含 CTE + LEFT JOIN + vs.deleted_at IS NULL + vs.is_active=true + orphan 显式清', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    const sql = harness.calls.find((c) => c.text.includes('alias_dead_status AS'))!.text
    // FIX-4 升级：从 LEFT JOIN video_sources → LEFT JOIN effective_sources（CTE 预计算 / 防 LEFT JOIN 退化）
    expect(sql).toMatch(/LEFT JOIN effective_sources/)
    expect(sql).toMatch(/FROM video_sources vs/)
    expect(sql).toMatch(/WHERE vs\.is_active = true AND vs\.deleted_at IS NULL/)
    expect(sql).toContain(`'all_dead'`)
    expect(sql).toContain(`'has_alive'`)
    expect(sql).toContain(`'orphan'`)
    expect(sql).toMatch(/orphan'\s+AND\s+sla\.dead_since\s+IS\s+NOT\s+NULL/)
    expect(sql).toMatch(/WHERE sla\.retired_at IS NULL/)
  })

  // ── WAVE4-VALIDATION-FIX-1 P1 + P1/P2（worker SQL 与 apps/api byte-identical 同步）──

  it('T11 段 1+2 必用 effective_sources CTE + site_key 比对在 ON 子句（P1 + FIX-4 防 LEFT JOIN 退化）', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    const sql = harness.calls.find((c) => c.text.includes('alias_dead_status AS'))!.text
    // FIX-4：用 effective_sources CTE 防 LEFT JOIN 退化（同 apps/api SQL byte-identical 同步）
    expect(sql).toMatch(/WITH effective_sources AS/)
    expect(sql).toMatch(/COALESCE\(vs\.source_site_key,\s*v\.site_key\)\s+AS effective_site_key/)
    expect(sql).toMatch(/LEFT JOIN videos v\s+ON v\.id = vs\.video_id/)
    expect(sql).toMatch(/LEFT JOIN effective_sources es[\s\S]+ON\s+es\.source_name\s+=\s+sla\.source_name[\s\S]+AND\s+es\.effective_site_key\s+=\s+sla\.source_site_key/)
    expect(sql).not.toMatch(/vs\.id IS NULL\s+OR\s+COALESCE/)
  })

  it('T12 段 3 必含 NOT EXISTS alive source + EXISTS active source 二次确认（P1/P2 防恢复后误退役）', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    const retireCall = harness.calls.find((c) =>
      c.text.includes('UPDATE source_line_aliases') &&
      c.text.includes('retired_at') &&
      c.text.includes('auto_retired'),
    )!
    const sql = retireCall.text
    expect(sql).toMatch(/UPDATE source_line_aliases sla_out/)
    expect(sql).toMatch(/NOT EXISTS \(/)
    expect(sql).toMatch(/NOT \(vs\.probe_status = 'dead' AND vs\.render_status = 'dead'\)/)
    expect(sql).toMatch(/AND EXISTS \(/)
    const coalesceMatches = sql.match(/COALESCE\(vs\.source_site_key,\s*v\.site_key\)/g) ?? []
    expect(coalesceMatches.length).toBeGreaterThanOrEqual(2)
    const videoJoins = sql.match(/LEFT JOIN videos v ON v\.id = vs\.video_id/g) ?? []
    expect(videoJoins.length).toBeGreaterThanOrEqual(2)
  })

  it('T4 段 3 SQL 含 batch limit + ORDER BY dead_since ASC + RETURNING', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    const retireCall = harness.calls.find((c) =>
      c.text.includes('UPDATE source_line_aliases') &&
      c.text.includes('retired_at') &&
      c.text.includes('auto_retired'),
    )!
    expect(retireCall.values).toEqual([180, 50]) // DEAD_THRESHOLD_DAYS + RETIRE_BATCH_LIMIT
    expect(retireCall.text).toMatch(/SET retired_at\s+=\s+NOW\(\)/)
    expect(retireCall.text).toMatch(/auto_retired\s+=\s+true/)
    expect(retireCall.text).toMatch(/ORDER BY dead_since ASC\s+LIMIT \$2/)
    // P1/P2 后 RETURNING 用 sla_out 别名
    expect(retireCall.text).toMatch(/RETURNING sla_out\.source_site_key,\s*sla_out\.source_name,\s*sla_out\.dead_since/)
  })

  // ── advisory lock 边界 ───────────────────────────────────────────

  it('T5 拿不到锁 → 跳过段 1+2/3 + log info + 仍 release client / 不调 unlock', async () => {
    const harness = makePoolAndClient({ lockAcquired: false })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    expect(harness.calls.length).toBe(1)
    expect(harness.calls[0]?.text).toContain('pg_try_advisory_lock')
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ lock_key: expect.stringContaining('worker:auto-retire-line') }),
      expect.stringContaining('another instance holds advisory lock'),
    )
    expect(harness.calls.some((c) => c.text.includes('pg_advisory_unlock'))).toBe(false)
    expect(harness.release).toHaveBeenCalledTimes(1)
    // 拿不到锁 → 仅 1 次 info（无 retired log / 无 batch_total log）
    expect((log.info as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(1)
  })

  // ── R-DEAD-4 结构化日志 ─────────────────────────────────────────

  it('T6 RETURNING N 行 → N 条 retired log + 1 条 batch_total', async () => {
    const retired = [
      { source_site_key: 'site_a', source_name: '线A', dead_since: '2025-09-01T00:00:00.000Z' },
      { source_site_key: 'site_b', source_name: '线B', dead_since: '2025-10-15T12:30:00.000Z' },
    ]
    const harness = makePoolAndClient({ retiredRows: retired })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    expect(log.info).toHaveBeenCalledTimes(3)
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
    expect(log.info).toHaveBeenNthCalledWith(
      3,
      { metric: 'auto_retire_line.batch_total', value: 2 },
      'auto-retire-line: job completed',
    )
  })

  it('T7 RETURNING 空数组 → 仅 batch_total=0 / 不写 retired log / 不抛错', async () => {
    const harness = makePoolAndClient({ retiredRows: [] })
    const log = makeLog()
    await expect(runAutoRetireLine(harness.pool, log)).resolves.toBeUndefined()
    expect(log.info).toHaveBeenCalledTimes(1)
    expect(log.info).toHaveBeenCalledWith(
      { metric: 'auto_retire_line.batch_total', value: 0 },
      'auto-retire-line: job completed',
    )
  })

  // ── 错误路径 ─────────────────────────────────────────────────────

  it('T8 段 1+2 抛错 → finally 仍调 unlock + release / 向上抛 / 不写 retired / batch_total log', async () => {
    const harness = makePoolAndClient({ maintainThrows: true })
    const log = makeLog()
    await expect(runAutoRetireLine(harness.pool, log)).rejects.toThrow('段 1+2 SQL 故障')

    // finally 必调 unlock + release
    expect(harness.calls.some((c) => c.text.includes('pg_advisory_unlock'))).toBe(true)
    expect(harness.release).toHaveBeenCalledTimes(1)
    // 错误中断 → 不写日志
    expect(log.info).not.toHaveBeenCalled()
  })

  it('T9 unlock 失败 → client.release(err) destroy connection + log.warn destroying', async () => {
    const harness = makePoolAndClient({ retiredRows: [], unlockThrows: true })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ lock_key: expect.stringContaining('worker:auto-retire-line') }),
      expect.stringContaining('destroying connection'),
    )
    expect(harness.release).toHaveBeenCalledTimes(1)
    const releaseArg = harness.release.mock.calls[0]?.[0]
    expect(releaseArg).toBeInstanceOf(Error)
  })

  // ── retired_at 时序一致性 ────────────────────────────────────────

  it('T10 retired_at 是同一 ISO 字符串（所有 row 共享一次 new Date().toISOString()）', async () => {
    const retired = [
      { source_site_key: 'site_a', source_name: '线A', dead_since: '2025-09-01T00:00:00.000Z' },
      { source_site_key: 'site_b', source_name: '线B', dead_since: '2025-09-01T00:00:00.000Z' },
    ]
    const harness = makePoolAndClient({ retiredRows: retired })
    const log = makeLog()
    await runAutoRetireLine(harness.pool, log)

    const infoCalls = (log.info as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const retiredAt1 = (infoCalls[0]?.[0] as { retired_at: string }).retired_at
    const retiredAt2 = (infoCalls[1]?.[0] as { retired_at: string }).retired_at
    expect(retiredAt1).toBe(retiredAt2)
  })
})
