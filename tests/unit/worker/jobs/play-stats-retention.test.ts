/**
 * tests/unit/worker/jobs/play-stats-retention.test.ts
 *
 * STATS-04-B-RETENTION / ADR-216 D-216-6 + ADR-107 §4（worker 内联 SQL）
 *
 * 编排单测（mock PoolClient，可 worktree 跑、入 test:changed）：advisory lock 取/skip/unlock 失败销毁、
 * 三表删除顺序与参数、events 双谓词 `aggregated_at IS NOT NULL`（**未聚合永不删** 硬不变量）、
 * visitors bucket_date / hourly bucket_hour 谓词、批量循环满批继续/不满批停、daily/totals/hot_scores 不触碰、deleted metric。
 *
 * SQL 真实删除数值（仅删过期 aggregated、未聚合/近期保留、按 bucket_date 清 visitor）→
 * tests/integration/worker/play-stats-retention.test.ts（延后合并期，worktree 无专用 test DB，同 STATS-04-A 先例）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  runPlayStatsRetention,
  EVENTS_RETENTION_DAYS,
  DAILY_VISITORS_RETENTION_DAYS,
  HOURLY_RETENTION_DAYS,
  RETENTION_DELETE_BATCH,
} from '../../../../apps/worker/src/jobs/play-stats-retention'

interface QueryCall {
  text: string
  values?: unknown[]
}

type QueryResponse = { rows: unknown[]; rowCount?: number }

/**
 * plan：lockAcquired（默认 true）、unlockThrows、各表每批 rowCount 序列（默认 [0] = 一批空即停）。
 * 批量循环停止条件：rowCount < RETENTION_DELETE_BATCH。满批用 RETENTION_DELETE_BATCH 触发继续。
 */
function makePoolAndClient(plan: {
  lockAcquired?: boolean
  unlockThrows?: boolean
  eventsBatches?: number[]
  visitorsBatches?: number[]
  hourlyBatches?: number[]
}) {
  const calls: QueryCall[] = []
  const counters = { events: 0, visitors: 0, hourly: 0 }
  const nextBatch = (seq: number[] | undefined, key: keyof typeof counters): number => {
    const arr = seq ?? [0]
    const n = arr[counters[key]] ?? 0
    counters[key] += 1
    return n
  }
  const clientQuery = vi.fn(async (sql: string, values?: unknown[]): Promise<QueryResponse> => {
    calls.push({ text: sql, values })
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ acquired: plan.lockAcquired ?? true }], rowCount: 1 }
    }
    if (sql.includes('pg_advisory_unlock')) {
      if (plan.unlockThrows) throw new Error('Test-injected unlock failure (connection reset)')
      return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 }
    }
    if (sql.includes('DELETE FROM video_play_events')) {
      return { rows: [], rowCount: nextBatch(plan.eventsBatches, 'events') }
    }
    if (sql.includes('DELETE FROM video_play_daily_visitors')) {
      return { rows: [], rowCount: nextBatch(plan.visitorsBatches, 'visitors') }
    }
    if (sql.includes('DELETE FROM video_play_hourly')) {
      return { rows: [], rowCount: nextBatch(plan.hourlyBatches, 'hourly') }
    }
    return { rows: [], rowCount: 0 }
  })
  const release = vi.fn()
  const client = { query: clientQuery, release } as unknown as import('pg').PoolClient

  const poolConnect = vi.fn().mockResolvedValue(client)
  const poolQuery = vi.fn().mockRejectedValue(new Error('Test guard: 必须用 client.query 不用 pool.query'))
  const pool = { connect: poolConnect, query: poolQuery } as unknown as import('pg').Pool

  return { pool, client, calls, clientQuery, release, poolConnect, poolQuery }
}

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as import('pino').Logger
}

function findCall(calls: QueryCall[], needle: string): QueryCall | undefined {
  return calls.find((c) => c.text.includes(needle))
}

function deleteVerbs(calls: QueryCall[]): string[] {
  return calls
    .filter((c) => c.text.trim().startsWith('DELETE'))
    .map((c) => {
      if (c.text.includes('video_play_events')) return 'EVENTS'
      if (c.text.includes('video_play_daily_visitors')) return 'VISITORS'
      if (c.text.includes('video_play_hourly')) return 'HOURLY'
      return 'OTHER'
    })
}

describe('runPlayStatsRetention — 视频播放统计 retention 清理（STATS-04-B / ADR-216 D-216-6）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('T1 取到 advisory lock → connect / unlock / 正常 release / 不用 pool.query', async () => {
    const h = makePoolAndClient({})
    await runPlayStatsRetention(h.pool, makeLog())

    expect(h.poolConnect).toHaveBeenCalledTimes(1)
    expect(findCall(h.calls, 'pg_try_advisory_lock')).toBeDefined()
    expect(findCall(h.calls, 'pg_advisory_unlock')).toBeDefined()
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release.mock.calls[0][0]).toBeUndefined()
    expect(h.poolQuery).not.toHaveBeenCalled()
  })

  it('T2 三表删除顺序 events → visitors → hourly + 参数（days + BATCH）', async () => {
    const h = makePoolAndClient({})
    await runPlayStatsRetention(h.pool, makeLog())

    expect(deleteVerbs(h.calls)).toEqual(['EVENTS', 'VISITORS', 'HOURLY'])
    expect(findCall(h.calls, 'DELETE FROM video_play_events')?.values).toEqual([
      EVENTS_RETENTION_DAYS,
      RETENTION_DELETE_BATCH,
    ])
    expect(findCall(h.calls, 'DELETE FROM video_play_daily_visitors')?.values).toEqual([
      DAILY_VISITORS_RETENTION_DAYS,
      RETENTION_DELETE_BATCH,
    ])
    expect(findCall(h.calls, 'DELETE FROM video_play_hourly')?.values).toEqual([
      HOURLY_RETENTION_DAYS,
      RETENTION_DELETE_BATCH,
    ])
    expect([EVENTS_RETENTION_DAYS, DAILY_VISITORS_RETENTION_DAYS, HOURLY_RETENTION_DAYS]).toEqual([90, 400, 90])
  })

  it('T3 拿不到锁 → skip + 仍 release + 不执行任何 DELETE', async () => {
    const h = makePoolAndClient({ lockAcquired: false })
    const log = makeLog()
    await runPlayStatsRetention(h.pool, log)

    expect(deleteVerbs(h.calls)).toEqual([])
    expect(findCall(h.calls, 'pg_advisory_unlock')).toBeUndefined() // 未拿锁不 unlock
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ lock_key: 'worker:play-stats-retention' }),
      expect.stringContaining('skipping'),
    )
  })

  it('T4 events SQL 双谓词：aggregated_at IS NOT NULL（未聚合永不删）+ aggregated_at < NOW()-days', async () => {
    const h = makePoolAndClient({})
    await runPlayStatsRetention(h.pool, makeLog())

    const ev = findCall(h.calls, 'DELETE FROM video_play_events')
    expect(ev?.text).toMatch(/aggregated_at IS NOT NULL/)
    expect(ev?.text).toMatch(/aggregated_at < NOW\(\) - \(\$1 \|\| ' days'\)::INTERVAL/)
    // 负向（Codex LOW）：绝无 OR / 'aggregated_at IS NULL' 删除旁路（未聚合永不删硬不变量）
    expect(ev?.text).not.toContain('aggregated_at IS NULL')
    expect(ev?.text).not.toMatch(/\bOR\b/)
  })

  it('T5 visitors 按 bucket_date（CURRENT_DATE - int）+ hourly 按 bucket_hour', async () => {
    const h = makePoolAndClient({})
    await runPlayStatsRetention(h.pool, makeLog())

    expect(findCall(h.calls, 'DELETE FROM video_play_daily_visitors')?.text).toMatch(
      /bucket_date < CURRENT_DATE - \$1::int/,
    )
    expect(findCall(h.calls, 'DELETE FROM video_play_hourly')?.text).toMatch(
      /bucket_hour < NOW\(\) - \(\$1 \|\| ' days'\)::INTERVAL/,
    )
  })

  it('T6 批量循环：满批继续、不满批停（events [BATCH, BATCH, 300] → 3 次 DELETE）', async () => {
    const h = makePoolAndClient({
      eventsBatches: [RETENTION_DELETE_BATCH, RETENTION_DELETE_BATCH, 300],
    })
    const log = makeLog()
    await runPlayStatsRetention(h.pool, log)

    const eventDeletes = h.calls.filter((c) => c.text.includes('DELETE FROM video_play_events'))
    expect(eventDeletes).toHaveLength(3) // 两满批继续 + 第三批 300<BATCH 停
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'play_stats_retention.deleted',
        events: RETENTION_DELETE_BATCH * 2 + 300,
      }),
      expect.any(String),
    )
  })

  it('T7 unlock 失败 → release 带 Error 销毁连接', async () => {
    const h = makePoolAndClient({ unlockThrows: true })
    const log = makeLog()
    await runPlayStatsRetention(h.pool, log)

    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ lock_key: 'worker:play-stats-retention' }),
      expect.stringContaining('destroying connection'),
    )
  })

  it('T8 deleted metric 汇总 events/visitors/hourly 删除数', async () => {
    const h = makePoolAndClient({ eventsBatches: [5], visitorsBatches: [3], hourlyBatches: [2] })
    const log = makeLog()
    await runPlayStatsRetention(h.pool, log)

    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_retention.deleted', events: 5, visitors: 3, hourly: 2 }),
      expect.any(String),
    )
  })

  it('T9 daily/totals/hot_scores 永久不动（无对应 DELETE）', async () => {
    const h = makePoolAndClient({})
    await runPlayStatsRetention(h.pool, makeLog())

    for (const c of h.calls) {
      expect(c.text).not.toContain('video_play_totals')
      expect(c.text).not.toContain('video_hot_scores')
      expect(c.text).not.toMatch(/DELETE FROM video_play_daily[^_]/) // 裸 daily 表（非 _visitors）
    }
  })
})
