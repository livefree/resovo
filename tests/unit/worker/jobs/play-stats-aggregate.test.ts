/**
 * tests/unit/worker/jobs/play-stats-aggregate.test.ts
 *
 * STATS-04-A-AGGREGATE / ADR-216 D-216-10/3/7/9 + ADR-107 §4（worker 内联 SQL）
 *
 * 本套件 = **编排单测**（mock PoolClient，可 worktree 跑、入 test:changed）：验证 drain 循环 /
 * 单批单事务序列 / 空批退出 / maxBatchesPerTick 上限 / per-video advisory lock 锁序 / 同进程重入 guard /
 * 错误 ROLLBACK + release / ROLLBACK 失败销毁连接 / 各 SQL 关键形状（FOR UPDATE SKIP LOCKED、
 * UV NOT ephemeral、hot_score EXCLUDED 覆盖 + bucket_hour<=NOW()、增量 += 语义）。
 *
 * SQL **数值正确性 + 真并发锁语义**（重跑不 double-count / UV 同 visitor·day·video 只 +1 / hot_score
 * 滑窗下降 / 并发不丢计数 / rollback 留 pending）需真 PG → tests/integration/worker/play-stats-aggregate.test.ts
 * （延后合并期跑，worktree 无 .env.local DB，同 STATS-02 schema 测试先例）。Codex LOW：mock 断 SQL 子串
 * 不能替代并发锁/RETURNING 真实行为证据，故并发与数值断言由 integration 层承担。
 *
 * STATS-06-B（ADR-216 D-216-4 / Codex 任务卡审 BLOCK 1+HIGH 1-3）追加「阶段二 ES 增量同步」套件：
 * drain（DB）完成、PG client 释放后 best-effort `es.bulk` partial-update ES play 字段。验证两阶段隔离
 * （client 在 bulk 前释放）/ es=null no-op / partial doc 字段值保 null / 404 item 跳过不抛 / bulk 抛错
 * warn 且聚合照常 / videoIds 去重透传。真实 PG↔ES ≤2min 收敛对拍延后合并期（需 live ES）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  runPlayStatsAggregate,
  BATCH_LIMIT,
  MAX_BATCHES_PER_TICK,
  HOT_SCORE_W24,
  HOT_SCORE_W7,
  HOT_SCORE_W30,
} from '../../../../apps/worker/src/jobs/play-stats-aggregate'

interface QueryCall {
  text: string
  values?: unknown[]
}

type QueryResponse = { rows: unknown[]; rowCount?: number }

/**
 * batchPlan：每次 batch SELECT 返回的 id 数组（按调用顺序）。
 * lockKeys：每批 affected 的 advisory lock key（驱动 advisory lock 次数）；默认 [111]。
 * throwOn：命中该关键字的 SQL 上抛错（模拟某 upsert 故障）。
 * rollbackThrows：ROLLBACK 自身抛错（模拟连接坏死 → BatchRollbackError）。
 */
function makePoolAndClient(plan: {
  batches: string[][]
  lockKeys?: number[]
  throwOn?: string
  rollbackThrows?: boolean
}) {
  const calls: QueryCall[] = []
  let batchIdx = 0
  const clientQuery = vi.fn(async (sql: string, values?: unknown[]): Promise<QueryResponse> => {
    calls.push({ text: sql, values })
    if (plan.throwOn && sql.includes(plan.throwOn)) {
      throw new Error(`Test-injected failure on: ${plan.throwOn}`)
    }
    if (sql.trim().startsWith('ROLLBACK')) {
      if (plan.rollbackThrows) throw new Error('Test-injected ROLLBACK failure (connection reset)')
      return { rows: [], rowCount: 0 }
    }
    if (sql.includes('FOR UPDATE SKIP LOCKED')) {
      const ids = plan.batches[batchIdx] ?? []
      batchIdx += 1
      return { rows: ids.map((id) => ({ id })), rowCount: ids.length }
    }
    if (sql.includes('lock_key') && sql.includes('ORDER BY lock_key')) {
      const keys = plan.lockKeys ?? [111]
      // STATS-06-B：affected query 现同返 video_id（drain 累积供阶段二 ES 同步）；既有断言只看 lock。
      return { rows: keys.map((lock_key) => ({ video_id: `v${lock_key}`, lock_key })), rowCount: keys.length }
    }
    return { rows: [], rowCount: 0 }
  })
  const release = vi.fn()
  const client = { query: clientQuery, release } as unknown as import('pg').PoolClient

  const poolConnect = vi.fn().mockResolvedValue(client)
  const poolQuery = vi.fn().mockRejectedValue(
    new Error('Test guard: runPlayStatsAggregate 必须用 client.query（事务），不用 pool.query'),
  )
  const pool = { connect: poolConnect, query: poolQuery } as unknown as import('pg').Pool

  return { pool, client, calls, clientQuery, release, poolConnect, poolQuery }
}

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as import('pino').Logger
}

function findCall(calls: QueryCall[], needle: string): QueryCall | undefined {
  return calls.find((c) => c.text.includes(needle))
}

/** 提取每条 query 的 verb 用于顺序断言（HOT 先于 AFFECTED 判定，避免 hot CTE 的 DISTINCT video_id 误判）。 */
function verbs(calls: QueryCall[]): string[] {
  return calls.map((c) => {
    const t = c.text.trim()
    if (t.startsWith('BEGIN')) return 'BEGIN'
    if (t.startsWith('COMMIT')) return 'COMMIT'
    if (t.startsWith('ROLLBACK')) return 'ROLLBACK'
    if (t.includes('FOR UPDATE SKIP LOCKED')) return 'SELECT_BATCH'
    if (t.includes('pg_advisory_xact_lock')) return 'LOCK'
    if (t.includes('INTO video_play_hourly')) return 'HOURLY'
    if (t.includes('INTO video_play_daily_visitors')) return 'DAILY'
    if (t.includes('INTO video_play_totals')) return 'TOTALS'
    if (t.includes('INTO video_hot_scores')) return 'HOT'
    if (t.includes('SET aggregated_at')) return 'MARK'
    if (t.includes('lock_key')) return 'AFFECTED'
    return 'OTHER'
  })
}

describe('runPlayStatsAggregate — 视频播放事件批量聚合编排（STATS-04-A / ADR-216）', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── 事务 / client 管理 ──────────────────────────────────────────────

  it('T1 单 client：connect 1 次 / 正常 release 1 次 / 全程不用 pool.query', async () => {
    const h = makePoolAndClient({ batches: [['1', '2'], []] })
    await runPlayStatsAggregate(h.pool, makeLog())

    expect(h.poolConnect).toHaveBeenCalledTimes(1)
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release.mock.calls[0][0]).toBeUndefined() // 正常归还（无 error）
    expect(h.poolQuery).not.toHaveBeenCalled()
  })

  it('T2 单批全流程顺序：BEGIN→SELECT→AFFECTED→LOCK→HOURLY→DAILY→TOTALS→HOT→MARK→COMMIT（第二批空停）', async () => {
    const h = makePoolAndClient({ batches: [['1', '2'], []] })
    await runPlayStatsAggregate(h.pool, makeLog())

    expect(verbs(h.calls)).toEqual([
      'BEGIN',
      'SELECT_BATCH',
      'AFFECTED',
      'LOCK', // 默认 1 个 affected video
      'HOURLY',
      'DAILY',
      'TOTALS',
      'HOT',
      'MARK',
      'COMMIT',
      'BEGIN',
      'SELECT_BATCH',
      'ROLLBACK',
    ])
  })

  it('T3 空批：BEGIN→SELECT(空)→ROLLBACK，不跑 lock / upsert', async () => {
    const h = makePoolAndClient({ batches: [[]] })
    await runPlayStatsAggregate(h.pool, makeLog())

    expect(verbs(h.calls)).toEqual(['BEGIN', 'SELECT_BATCH', 'ROLLBACK'])
    expect(findCall(h.calls, 'pg_advisory_xact_lock')).toBeUndefined()
    expect(findCall(h.calls, 'INTO video_play_hourly')).toBeUndefined()
    expect(findCall(h.calls, 'COMMIT')).toBeUndefined()
  })

  // ── D-216-10 batch / drain ─────────────────────────────────────────

  it('T4 batch SELECT 含 FOR UPDATE SKIP LOCKED + ORDER BY ingested_at ASC + LIMIT=BATCH_LIMIT', async () => {
    const h = makePoolAndClient({ batches: [['1'], []] })
    await runPlayStatsAggregate(h.pool, makeLog())

    const sel = findCall(h.calls, 'FOR UPDATE SKIP LOCKED')
    expect(sel).toBeDefined()
    expect(sel?.text).toMatch(/aggregated_at IS NULL/)
    expect(sel?.text).toMatch(/ORDER BY ingested_at ASC/)
    expect(sel?.values).toEqual([BATCH_LIMIT])
    expect(BATCH_LIMIT).toBe(500)
  })

  it('T5 drain 上限：持续满批时恰好处理 MAX_BATCHES_PER_TICK 批后停', async () => {
    const many = Array.from({ length: MAX_BATCHES_PER_TICK + 5 }, () => ['x'])
    const h = makePoolAndClient({ batches: many })
    await runPlayStatsAggregate(h.pool, makeLog())

    expect(verbs(h.calls).filter((v) => v === 'COMMIT')).toHaveLength(MAX_BATCHES_PER_TICK)
    expect(verbs(h.calls).filter((v) => v === 'SELECT_BATCH')).toHaveLength(MAX_BATCHES_PER_TICK)
    expect(MAX_BATCHES_PER_TICK).toBe(10)
  })

  // ── BLOCK 修复：per-video advisory lock 串行化重算 ──────────────────

  it('T6 advisory xact lock：按实际 lock key 排序（hashtext + ORDER BY lock_key 防碰撞死锁）+ 每 key 一次 lock + 在 upsert 前', async () => {
    const h = makePoolAndClient({ batches: [['1', '2'], []], lockKeys: [101, 202] })
    await runPlayStatsAggregate(h.pool, makeLog())

    // affected SQL：hashtext(prefix||video_id) AS lock_key + ORDER BY lock_key（按真实锁资源排序）
    const aff = h.calls.find(
      (c) => c.text.includes('lock_key') && c.text.includes('ORDER BY lock_key'),
    )
    expect(aff).toBeDefined()
    expect(aff?.text).toMatch(/hashtext/)
    expect(aff?.values).toEqual([['1', '2'], 'play_stats_agg:']) // ids + 参数化 prefix（不拼接 SQL）

    // 每个 lock key 一次 advisory lock（参数为 lock key 数值）
    const locks = h.calls.filter((c) => c.text.includes('pg_advisory_xact_lock'))
    expect(locks).toHaveLength(2)
    expect(locks[0].values).toEqual([101])
    expect(locks[1].values).toEqual([202])

    // lock 必须在所有 upsert 之前
    const v = verbs(h.calls)
    expect(v.indexOf('LOCK')).toBeLessThan(v.indexOf('HOURLY'))
    expect(v.lastIndexOf('LOCK')).toBeLessThan(v.indexOf('HOT'))
  })

  // ── D-216-7 UV / D-216-3 hot_score / 增量语义 ───────────────────────

  it('T7 daily SQL：UV 仅 NOT ephemeral（visitor_is_ephemeral = false）+ unique_visitor_count 增量', async () => {
    const h = makePoolAndClient({ batches: [['1'], []] })
    await runPlayStatsAggregate(h.pool, makeLog())

    const daily = findCall(h.calls, 'INTO video_play_daily_visitors')
    expect(daily).toBeDefined()
    expect(daily?.text).toMatch(/visitor_is_ephemeral = false/)
    expect(daily?.text).toMatch(/ON CONFLICT \(video_id, bucket_date, visitor_hash\) DO NOTHING/)
    expect(daily?.text).toMatch(
      /unique_visitor_count = video_play_daily\.unique_visitor_count \+ EXCLUDED\.unique_visitor_count/,
    )
  })

  it('T8 hot_score 全量重算：EXCLUDED 覆盖（非累加）+ bucket_hour<=NOW() 防未来桶 + 权重参数', async () => {
    const h = makePoolAndClient({ batches: [['1'], []] })
    await runPlayStatsAggregate(h.pool, makeLog())

    const hot = findCall(h.calls, 'INTO video_hot_scores')
    expect(hot).toBeDefined()
    expect(hot?.text).toMatch(/h\.bucket_hour <= NOW\(\)/)
    expect(hot?.text).toMatch(/hot_score = EXCLUDED\.hot_score/)
    expect(hot?.text).not.toMatch(/hot_score = video_hot_scores\.hot_score \+/)
    expect(hot?.text).toMatch(/INTERVAL '24 hours'/)
    expect(hot?.text).toMatch(/INTERVAL '7 days'/)
    expect(hot?.text).toMatch(/INTERVAL '30 days'/)
    expect(hot?.values?.[1]).toBe(HOT_SCORE_W24)
    expect(hot?.values?.[2]).toBe(HOT_SCORE_W7)
    expect(hot?.values?.[3]).toBe(HOT_SCORE_W30)
    expect([HOT_SCORE_W24, HOT_SCORE_W7, HOT_SCORE_W30]).toEqual([1.0, 0.3, 0.1])
  })

  it('T9 hourly/daily/totals 为增量累加（ON CONFLICT col = 表.col + EXCLUDED.col）', async () => {
    const h = makePoolAndClient({ batches: [['1'], []] })
    await runPlayStatsAggregate(h.pool, makeLog())

    expect(findCall(h.calls, 'INTO video_play_hourly')?.text).toMatch(
      /play_count = video_play_hourly\.play_count \+ EXCLUDED\.play_count/,
    )
    const totals = findCall(h.calls, 'INTO video_play_totals')
    expect(totals?.text).toMatch(
      /total_play_count = video_play_totals\.total_play_count \+ EXCLUDED\.total_play_count/,
    )
    expect(totals?.text).toMatch(/last_played_at = GREATEST/)
  })

  it('T10 mark + 所有 upsert 参数首位 = 本批 id 数组（id = ANY 作用于锁定批）', async () => {
    const ids = ['7', '8', '9']
    const h = makePoolAndClient({ batches: [ids, []] })
    await runPlayStatsAggregate(h.pool, makeLog())

    const mark = findCall(h.calls, 'SET aggregated_at')
    expect(mark?.text).toMatch(/UPDATE video_play_events/)
    expect(mark?.text).toMatch(/aggregated_at = NOW\(\)/)
    expect(mark?.values).toEqual([ids])

    for (const needle of [
      'INTO video_play_hourly',
      'INTO video_play_daily_visitors',
      'INTO video_play_totals',
      'INTO video_hot_scores',
    ]) {
      expect(findCall(h.calls, needle)?.values?.[0]).toEqual(ids)
    }
  })

  // ── 错误处理（crash 留 pending；HIGH-1 连接污染） ───────────────────

  it('T11 某 upsert 抛错 → ROLLBACK + 上抛 + 正常 release（非销毁）、不 COMMIT/MARK', async () => {
    const h = makePoolAndClient({ batches: [['1', '2'], []], throwOn: 'INTO video_play_totals' })

    await expect(runPlayStatsAggregate(h.pool, makeLog())).rejects.toThrow('Test-injected failure')

    const v = verbs(h.calls)
    expect(v).toContain('ROLLBACK')
    expect(v).not.toContain('COMMIT')
    expect(findCall(h.calls, 'SET aggregated_at')).toBeUndefined()
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release.mock.calls[0][0]).toBeUndefined() // 正常归还
  })

  it('T12 ROLLBACK 自身失败 → 销毁连接（release 带 Error，防污染连接归还池）', async () => {
    const h = makePoolAndClient({
      batches: [['1'], []],
      throwOn: 'INTO video_play_totals',
      rollbackThrows: true,
    })

    await expect(runPlayStatsAggregate(h.pool, makeLog())).rejects.toThrow(/ROLLBACK failed|poisoned/)

    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release.mock.calls[0][0]).toBeInstanceOf(Error) // 销毁连接
  })

  // ── HIGH-2：同进程重入 guard ────────────────────────────────────────

  it('T13 同进程重入：上一轮 drain 未完成时第二次调用跳过（不并发跑）', async () => {
    let openGate: () => void = () => {}
    const gate = new Promise<void>((r) => {
      openGate = r
    })
    let firstBatch = true
    const clientQuery = vi.fn(async (sql: string): Promise<QueryResponse> => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        if (firstBatch) {
          firstBatch = false
          await gate // 第一批卡住，模拟 drain 进行中
          return { rows: [{ id: '1' }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('lock_key') && sql.includes('ORDER BY lock_key')) {
        return { rows: [{ video_id: 'v1', lock_key: 1 }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })
    const client = { query: clientQuery, release: vi.fn() } as unknown as import('pg').PoolClient
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(),
    } as unknown as import('pg').Pool

    const log2 = makeLog()
    const p1 = runPlayStatsAggregate(pool, makeLog()) // 卡在 gate
    await new Promise((r) => setTimeout(r, 0)) // 让 p1 进入 isRunning
    await runPlayStatsAggregate(pool, log2) // isRunning=true → 跳过

    expect(log2.info).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_aggregate.skipped_overlap' }),
      expect.any(String),
    )

    openGate() // 释放 p1，跑完归还 isRunning
    await p1
  })

  it('T14 完成后写 processed metric 日志', async () => {
    const h = makePoolAndClient({ batches: [['1', '2', '3'], []] })
    const log = makeLog()
    await runPlayStatsAggregate(h.pool, log)

    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_aggregate.processed', value: 3, batches: 1 }),
      expect.any(String),
    )
  })

  it('T15 既有 2-arg 调用（es 默认 null）→ 阶段二完全跳过：不查 pool、不依赖 ELASTICSEARCH_URL', async () => {
    const h = makePoolAndClient({ batches: [['1'], []] })
    await runPlayStatsAggregate(h.pool, makeLog()) // 不传 es → 默认 null
    // 阶段二仅在 es!=null 时 pool.query 取 play 字段；es=null → 不触碰 pool.query（guard 不被触发）
    expect(h.poolQuery).not.toHaveBeenCalled()
  })
})

// ── STATS-06-B：阶段二 ES 增量同步（ADR-216 D-216-4 / Codex BLOCK 1 + HIGH 1-3）─────────

interface PlayFieldsRow {
  id: string
  total_play_count: string | null
  play_count_7d: string | null
  hot_score: string | null
}

interface BulkItem {
  update?: { status?: number; error?: { type?: string } }
}

/**
 * ES-sync 专用 harness：
 *   - client.query 驱动 drain（SELECT_BATCH / affected 返回 video_id+lock_key / 其余 no-op）。
 *   - pool.query **允许**（既有聚合 harness 用 reject guard，本套件阶段二要真用 pool 取 play 字段）：
 *     命中 SQL_FETCH_PLAY_FIELDS（unnest + LEFT JOIN totals/hot_scores）→ 返回 playFields。
 *   - es.bulk 返回 bulkResult 或抛错（best-effort 路径）。
 */
function makeEsSyncHarness(opts: {
  batches: string[][]
  videoIdsByBatch: string[][]
  playFields?: PlayFieldsRow[]
  bulkResult?: { errors: boolean; items: BulkItem[] }
  bulkThrows?: boolean
  throwOn?: string
}) {
  let selectIdx = 0
  let affectedIdx = 0
  const clientQuery = vi.fn(async (sql: string): Promise<QueryResponse> => {
    if (sql.trim().startsWith('ROLLBACK')) return { rows: [], rowCount: 0 }
    // throwOn 仅在第 2 批起触发（selectIdx≥2 表示已过批1 SELECT）→ 批1 commit、后续批失败（S8 用）。
    if (opts.throwOn && selectIdx >= 2 && sql.includes(opts.throwOn)) {
      throw new Error(`Test-injected drain failure on: ${opts.throwOn}`)
    }
    if (sql.includes('FOR UPDATE SKIP LOCKED')) {
      const ids = opts.batches[selectIdx] ?? []
      selectIdx += 1
      return { rows: ids.map((id) => ({ id })), rowCount: ids.length }
    }
    if (sql.includes('lock_key') && sql.includes('ORDER BY lock_key')) {
      const vids = opts.videoIdsByBatch[affectedIdx] ?? []
      affectedIdx += 1
      return { rows: vids.map((video_id, i) => ({ video_id, lock_key: 100 + i })), rowCount: vids.length }
    }
    return { rows: [], rowCount: 0 } // BEGIN / COMMIT / advisory lock / upserts / mark
  })
  const release = vi.fn()
  const client = { query: clientQuery, release } as unknown as import('pg').PoolClient

  const poolConnect = vi.fn().mockResolvedValue(client)
  const poolQuery = vi.fn(async (sql: string, _values?: unknown[]): Promise<QueryResponse> => {
    if (sql.includes('FROM unnest') && sql.includes('LEFT JOIN video_play_totals')) {
      const rows = opts.playFields ?? []
      return { rows, rowCount: rows.length }
    }
    throw new Error(`Unexpected pool.query in ES-sync harness: ${sql}`)
  })
  const pool = { connect: poolConnect, query: poolQuery } as unknown as import('pg').Pool

  const bulk = vi.fn(async (_req: unknown) => {
    if (opts.bulkThrows) throw new Error('Test-injected ES bulk failure')
    return opts.bulkResult ?? { errors: false, items: [] }
  })
  const es = { bulk } as unknown as import('@elastic/elasticsearch').Client

  return { pool, es, bulk, release, poolQuery, clientQuery }
}

describe('runPlayStatsAggregate 阶段二 — ES play 字段增量同步（STATS-06-B / ADR-216 D-216-4）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('S1 drain 后 es.bulk partial-update：operations 为 affected video 的 {update}/{doc}，字段值经 toNullableNumber 保 null', async () => {
    const h = makeEsSyncHarness({
      batches: [['1', '2'], []],
      videoIdsByBatch: [['va', 'vb']],
      playFields: [
        { id: 'va', total_play_count: '100', play_count_7d: '50', hot_score: '78.5' },
        { id: 'vb', total_play_count: '0', play_count_7d: null, hot_score: null },
      ],
    })
    await runPlayStatsAggregate(h.pool, makeLog(), h.es)

    // 阶段二用 pool.query 取 play 字段（去重 video_id 数组）
    expect(h.poolQuery).toHaveBeenCalledTimes(1)
    expect(h.poolQuery.mock.calls[0][1]).toEqual([['va', 'vb']])

    // es.bulk 一次，operations = 交替 {update}/{doc}
    expect(h.bulk).toHaveBeenCalledTimes(1)
    const req = h.bulk.mock.calls[0][0] as { operations: Array<Record<string, unknown>> }
    const ops = req.operations
    expect(ops[0]).toEqual({ update: { _index: 'resovo_videos', _id: 'va' } })
    // 真实值 → number
    expect(ops[1]).toEqual({ doc: { play_count_total: 100, play_count_7d: 50, hot_score: 78.5 } })
    expect(ops[2]).toEqual({ update: { _index: 'resovo_videos', _id: 'vb' } })
    // 真实 0 → 0；缺聚合 → null（非 ?? 0，对齐 NULLS LAST / missing:_last）
    expect(ops[3]).toEqual({ doc: { play_count_total: 0, play_count_7d: null, hot_score: null } })
  })

  it('S2 es=null → 阶段二完全 no-op：不查 pool、不调 bulk', async () => {
    const h = makeEsSyncHarness({ batches: [['1'], []], videoIdsByBatch: [['va']] })
    await runPlayStatsAggregate(h.pool, makeLog(), null)

    expect(h.poolQuery).not.toHaveBeenCalled()
    expect(h.bulk).not.toHaveBeenCalled()
  })

  it('S3 两阶段隔离：client 在 es.bulk 之前已 release（ES 不占 DB 连接）', async () => {
    const h = makeEsSyncHarness({
      batches: [['1'], []],
      videoIdsByBatch: [['va']],
      playFields: [{ id: 'va', total_play_count: '1', play_count_7d: '1', hot_score: '1' }],
    })
    await runPlayStatsAggregate(h.pool, makeLog(), h.es)

    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.bulk).toHaveBeenCalledTimes(1)
    // release 调用次序早于 bulk（阶段一释放 → 阶段二同步）
    expect(h.release.mock.invocationCallOrder[0]).toBeLessThan(h.bulk.mock.invocationCallOrder[0])
  })

  it('S4 bulk item 404（document_missing）→ 计 missing 跳过、不抛、聚合照常完成', async () => {
    const h = makeEsSyncHarness({
      batches: [['1', '2'], []],
      videoIdsByBatch: [['va', 'vb']],
      playFields: [
        { id: 'va', total_play_count: '1', play_count_7d: '1', hot_score: '1' },
        { id: 'vb', total_play_count: '2', play_count_7d: '2', hot_score: '2' },
      ],
      bulkResult: {
        errors: true,
        items: [
          { update: { status: 404, error: { type: 'document_missing_exception' } } },
          { update: { status: 200 } },
        ],
      },
    })
    const log = makeLog()
    await expect(runPlayStatsAggregate(h.pool, log, h.es)).resolves.toBeUndefined()

    // missing=1（404 跳过）/ synced=1（200 无 error）/ failed=0 → info 级 result metric
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_es_sync.result', synced: 1, missing: 1, failed: 0 }),
      expect.any(String),
    )
    // 聚合完成日志仍写（阶段一不受阶段二影响）
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_aggregate.processed', value: 2 }),
      expect.any(String),
    )
  })

  it('S4b（HIGH 1）非 document_missing 的 404（如 index_not_found）→ 计 failed 非 missing，warn 不静默', async () => {
    const h = makeEsSyncHarness({
      batches: [['1'], []],
      videoIdsByBatch: [['va']],
      playFields: [{ id: 'va', total_play_count: '1', play_count_7d: '1', hot_score: '1' }],
      bulkResult: {
        errors: true,
        items: [{ update: { status: 404, error: { type: 'index_not_found_exception' } } }],
      },
    })
    const log = makeLog()
    await expect(runPlayStatsAggregate(h.pool, log, h.es)).resolves.toBeUndefined()

    // 404 但非 document_missing → failed=1 / missing=0（不被误当缺文档静默）
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_es_sync.result', synced: 0, missing: 0, failed: 1 }),
      expect.any(String),
    )
  })

  it('S5 bulk item 非 404 错误 → 计 failed、warn 级 result metric、仍不抛', async () => {
    const h = makeEsSyncHarness({
      batches: [['1'], []],
      videoIdsByBatch: [['va']],
      playFields: [{ id: 'va', total_play_count: '1', play_count_7d: '1', hot_score: '1' }],
      bulkResult: {
        errors: true,
        items: [{ update: { status: 500, error: { type: 'es_rejected_execution_exception' } } }],
      },
    })
    const log = makeLog()
    await expect(runPlayStatsAggregate(h.pool, log, h.es)).resolves.toBeUndefined()

    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_es_sync.result', synced: 0, missing: 0, failed: 1 }),
      expect.any(String),
    )
  })

  it('S6 es.bulk 抛错 → warn(error metric)、不挂 job、聚合（已 commit）照常完成', async () => {
    const h = makeEsSyncHarness({
      batches: [['1'], []],
      videoIdsByBatch: [['va']],
      playFields: [{ id: 'va', total_play_count: '1', play_count_7d: '1', hot_score: '1' }],
      bulkThrows: true,
    })
    const log = makeLog()
    await expect(runPlayStatsAggregate(h.pool, log, h.es)).resolves.toBeUndefined()

    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_es_sync.error' }),
      expect.any(String),
    )
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'play_stats_aggregate.processed', value: 1 }),
      expect.any(String),
    )
  })

  it('S7 videoIds 跨批去重透传：fetch 用去重后的并集（va,vb,vc）', async () => {
    const h = makeEsSyncHarness({
      batches: [['1'], ['2'], []],
      videoIdsByBatch: [
        ['va', 'vb'],
        ['vb', 'vc'],
      ],
      playFields: [],
    })
    await runPlayStatsAggregate(h.pool, makeLog(), h.es)

    expect(h.poolQuery).toHaveBeenCalledTimes(1)
    expect(h.poolQuery.mock.calls[0][1]).toEqual([['va', 'vb', 'vc']])
  })

  it('S8（HIGH 2）drain 中途失败：已 commit 批的 video 仍在阶段二同步，随后 rethrow drain 错误', async () => {
    // 批1 ['1']→commit（video va）；批2 ['2'] 在 TOTALS upsert 抛错 → ROLLBACK → drain 错误。
    const h = makeEsSyncHarness({
      batches: [['1'], ['2'], []],
      videoIdsByBatch: [['va'], ['vb']],
      playFields: [{ id: 'va', total_play_count: '5', play_count_7d: '3', hot_score: '8' }],
      throwOn: 'INTO video_play_totals',
    })
    const log = makeLog()

    // drain 错误最终 rethrow（保 T11/T12 错误语义）
    await expect(runPlayStatsAggregate(h.pool, log, h.es)).rejects.toThrow('Test-injected drain failure')

    // 但已 commit 批1 的 va 仍被同步（批2 的 vb 因 ROLLBACK 未提交、未加入 affected）
    expect(h.poolQuery).toHaveBeenCalledTimes(1)
    expect(h.poolQuery.mock.calls[0][1]).toEqual([['va']])
    expect(h.bulk).toHaveBeenCalledTimes(1)
    const req = h.bulk.mock.calls[0][0] as { operations: Array<Record<string, unknown>> }
    expect(req.operations[0]).toEqual({ update: { _index: 'resovo_videos', _id: 'va' } })
    expect(req.operations[1]).toEqual({ doc: { play_count_total: 5, play_count_7d: 3, hot_score: 8 } })
  })
})
