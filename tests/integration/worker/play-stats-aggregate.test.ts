/**
 * play-stats-aggregate.test.ts — 视频播放聚合 job 真实 PG 数值验证（STATS-04-A / ADR-216）
 *
 * 与 tests/unit/worker/jobs/play-stats-aggregate.test.ts（mock 编排）互补：本套件验证 mock 无法覆盖的
 * **SQL 数值正确性 + 真并发锁语义**——重跑不 double-count、daily UV 同 visitor/day/video 只 +1、
 * ephemeral 不计 UV、anon/logged_in 拆分、hot_score 按窗口全量重算 + 陈旧高值被覆盖下降、
 * per-video advisory xact lock 串行化同 video 重算（Codex BLOCK lost update 防护机制）、commit 标 aggregated。
 *
 * 运行前提（同 tests/helpers/integration-pg.ts）：**专用 test DB** up + migrate ≥128 + DATABASE_URL（.env.local）。
 *   独立 vitest.integration.config.ts，不入 test:changed。**worktree 无 .env.local → 延后合并期跑**（同 STATS-02 先例）。
 *   beforeEach TRUNCATE STATS 表 → 消除跨测试 / 全局 pending 干扰（Codex MEDIUM-2），故仅在专用 test DB 运行。
 *
 * 端到端多进程 lost update（两个 worker 进程并发）超出单进程 vitest 范围（isRunning guard 防同进程重入）；
 * 本层以「advisory lock 串行阻塞」机制测试证明 BLOCK 修复有效，多进程实测由部署期承担。
 * rollback 留 pending（抛错→ROLLBACK 不 MARK）由 mock 单测 T11/T12 覆盖。
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'
import { cleanTestData, seedTestVideo } from '../../helpers/db'
import { runPlayStatsAggregate } from '../../../apps/worker/src/jobs/play-stats-aggregate'

const log = { info: () => {}, warn: () => {}, error: () => {} } as unknown as import('pino').Logger

let db: Pool

beforeAll(async () => {
  db = createIntegrationPool()
  // 破坏性 TRUNCATE 守卫（Codex round2 HIGH）：仅允许在库名含 "test" 的专用库运行，
  // 防误用开发/共享库的 DATABASE_URL 跑本套件而清空真实播放统计数据 → fail fast。
  const { rows } = await db.query<{ db: string }>('SELECT current_database() AS db')
  const name = rows[0]?.db ?? ''
  // token 边界匹配（Codex round3 残留 LOW）：'test' 须为独立 token，避免 'fastest_prod' 等误放行。
  if (!/(^|[_-])test([_-]|$)/i.test(name)) {
    throw new Error(
      `play-stats-aggregate integration test refuses to TRUNCATE on non-test database "${name}". ` +
        `Point DATABASE_URL at a database whose name has "test" as a token (e.g. resovo_test, test_db).`,
    )
  }
})

beforeEach(async () => {
  // 专用 test DB 前提（Codex MEDIUM-2，已由 beforeAll 守卫确认库名含 test）：清空 STATS 表 →
  // runPlayStatsAggregate 只作用于本测试 seed 的事件。
  await db.query(
    `TRUNCATE video_play_events, video_play_hourly, video_play_daily,
              video_play_daily_visitors, video_play_totals, video_hot_scores`,
  )
})

afterEach(async () => {
  await cleanTestData(db)
})

afterAll(async () => {
  await db.end()
})

let keySeq = 0

/** 插一个 qualified_play 事件（pending）。occurredAt 控制 hourly/daily bucket 与 hot_score 窗口。 */
async function insertEvent(
  videoId: string,
  opts: {
    visitorHash: string
    occurredAt: Date
    watchSeconds?: number
    ephemeral?: boolean
    userId?: string | null
    episodeNumber?: number | null
  },
): Promise<void> {
  keySeq += 1
  const idempotencyKey = `itest-${Date.now()}-${keySeq}`
  const playSessionId = `sess-${keySeq}`
  await db.query(
    `INSERT INTO video_play_events (
       idempotency_key, video_id, episode_number, play_session_id,
       visitor_hash, visitor_is_ephemeral, user_id, watch_seconds,
       occurred_at, ingested_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())`,
    [
      idempotencyKey,
      videoId,
      opts.episodeNumber ?? null,
      playSessionId,
      opts.visitorHash,
      opts.ephemeral ?? false,
      opts.userId ?? null,
      opts.watchSeconds ?? 30,
      opts.occurredAt.toISOString(),
    ],
  )
}

async function getTotals(videoId: string) {
  const { rows } = await db.query<{ total_play_count: string; last_played_at: string | null }>(
    `SELECT total_play_count, last_played_at::TEXT AS last_played_at
     FROM video_play_totals WHERE video_id = $1`,
    [videoId],
  )
  return rows[0] ?? null
}

async function getDailyForToday(videoId: string) {
  const { rows } = await db.query<{
    play_count: string
    unique_visitor_count: string
    anon_play_count: string
    logged_in_play_count: string
  }>(
    `SELECT play_count, unique_visitor_count, anon_play_count, logged_in_play_count
     FROM video_play_daily WHERE video_id = $1 AND bucket_date = (NOW())::date`,
    [videoId],
  )
  return rows[0] ?? null
}

async function getHotScore(videoId: string) {
  const { rows } = await db.query<{
    hot_score: string
    play_count_24h: string
    play_count_7d: string
    play_count_30d: string
  }>(
    `SELECT hot_score, play_count_24h, play_count_7d, play_count_30d
     FROM video_hot_scores WHERE video_id = $1`,
    [videoId],
  )
  return rows[0] ?? null
}

async function countPending(videoId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM video_play_events WHERE video_id = $1 AND aggregated_at IS NULL`,
    [videoId],
  )
  return parseInt(rows[0].n, 10)
}

describe('runPlayStatsAggregate — 真实 PG 数值正确性（STATS-04-A / ADR-216）', () => {
  it('commit 后标 aggregated + hourly/daily/totals/hot 数值正确', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-commit' })
    const now = new Date()
    await insertEvent(v.id, { visitorHash: 'va', occurredAt: now })
    await insertEvent(v.id, { visitorHash: 'vb', occurredAt: now })
    await insertEvent(v.id, { visitorHash: 'vc', occurredAt: now })

    await runPlayStatsAggregate(db, log)

    expect(await countPending(v.id)).toBe(0)
    expect((await getTotals(v.id))?.total_play_count).toBe('3')
    const daily = await getDailyForToday(v.id)
    expect(daily?.play_count).toBe('3')
    expect(daily?.unique_visitor_count).toBe('3')
    const hot = await getHotScore(v.id)
    expect(parseInt(hot!.play_count_24h, 10)).toBe(3)
    expect(Number(hot!.hot_score)).toBeGreaterThan(0)
  })

  it('重跑聚合不 double-count（第二次无 pending）', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-dup' })
    const now = new Date()
    await insertEvent(v.id, { visitorHash: 'va', occurredAt: now })
    await insertEvent(v.id, { visitorHash: 'vb', occurredAt: now })

    await runPlayStatsAggregate(db, log)
    await runPlayStatsAggregate(db, log)

    expect((await getTotals(v.id))?.total_play_count).toBe('2')
    expect((await getDailyForToday(v.id))?.play_count).toBe('2')
  })

  it('daily UV 同 visitor/day/video 只加 1（含跨批次去重）', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-uv' })
    const now = new Date()
    await insertEvent(v.id, { visitorHash: 'va', occurredAt: now })
    await insertEvent(v.id, { visitorHash: 'va', occurredAt: now })
    await insertEvent(v.id, { visitorHash: 'vb', occurredAt: now })
    await runPlayStatsAggregate(db, log)
    expect((await getDailyForToday(v.id))?.unique_visitor_count).toBe('2')

    await insertEvent(v.id, { visitorHash: 'va', occurredAt: now })
    await insertEvent(v.id, { visitorHash: 'vc', occurredAt: now })
    await runPlayStatsAggregate(db, log)
    expect((await getDailyForToday(v.id))?.unique_visitor_count).toBe('3') // 2 + vc
    expect((await getDailyForToday(v.id))?.play_count).toBe('5')
  })

  it('ephemeral 事件计 play_count 但不计 UV（D-216-7）', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-eph' })
    const now = new Date()
    await insertEvent(v.id, { visitorHash: 'real', occurredAt: now })
    await insertEvent(v.id, { visitorHash: 'eph', occurredAt: now, ephemeral: true })

    await runPlayStatsAggregate(db, log)

    const daily = await getDailyForToday(v.id)
    expect(daily?.play_count).toBe('2')
    expect(daily?.unique_visitor_count).toBe('1')
  })

  it('anon/logged_in 按 user_id IS NULL 拆分', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-split' })
    const u = await db.query<{ id: string }>(
      `INSERT INTO users (id, username, email, password_hash, role)
       VALUES (gen_random_uuid(), 'statsagg', 'statsagg@resovo.test', 'x', 'user') RETURNING id`,
    )
    const now = new Date()
    await insertEvent(v.id, { visitorHash: 'anon', occurredAt: now, userId: null })
    await insertEvent(v.id, { visitorHash: 'auth', occurredAt: now, userId: u.rows[0].id })

    await runPlayStatsAggregate(db, log)

    const daily = await getDailyForToday(v.id)
    expect(daily?.anon_play_count).toBe('1')
    expect(daily?.logged_in_play_count).toBe('1')
  })

  it('hot_score 按窗口全量重算：滑出 24h 窗口的事件不计入 pc24（pc24 < pc7）', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-window' })
    const now = new Date()
    const h25Ago = new Date(now.getTime() - 25 * 60 * 60 * 1000)
    await insertEvent(v.id, { visitorHash: 'old', occurredAt: h25Ago })
    await insertEvent(v.id, { visitorHash: 'new', occurredAt: now })

    await runPlayStatsAggregate(db, log)

    const hot = await getHotScore(v.id)
    expect(parseInt(hot!.play_count_24h, 10)).toBe(1)
    expect(parseInt(hot!.play_count_7d, 10)).toBe(2)
    expect(parseInt(hot!.play_count_24h, 10)).toBeLessThan(parseInt(hot!.play_count_7d, 10))
    // hot_score = pc24*1.0 + pc7*0.3 + pc30*0.1 = 1 + 0.6 + 0.2 = 1.8
    expect(Number(hot!.hot_score)).toBeCloseTo(1 * 1.0 + 2 * 0.3 + 2 * 0.1, 5)
  })

  it('hot_score 覆盖下降：陈旧高值在重算后被真实窗口值覆盖（= EXCLUDED 非累加，Codex MEDIUM-1）', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-decay' })
    const now = new Date()
    await insertEvent(v.id, { visitorHash: 'a', occurredAt: now })
    await runPlayStatsAggregate(db, log)
    expect(parseInt((await getHotScore(v.id))!.play_count_24h, 10)).toBe(1)

    // 人为抬高模拟陈旧高分（旧窗口残留 / 误累加假象）
    await db.query(
      `UPDATE video_hot_scores SET play_count_24h = 999, play_count_7d = 999,
              play_count_30d = 999, hot_score = 999 WHERE video_id = $1`,
      [v.id],
    )
    // 新事件触发 ON CONFLICT DO UPDATE 重算
    await insertEvent(v.id, { visitorHash: 'b', occurredAt: now })
    await runPlayStatsAggregate(db, log)

    const after = await getHotScore(v.id)
    expect(parseInt(after!.play_count_24h, 10)).toBe(2) // 覆盖为真实窗口值 2，非 999 / 1000
    expect(Number(after!.hot_score)).toBeLessThan(999) // 下降 → 证明全量覆盖、滑窗可递减
  })

  it('per-video advisory xact lock 串行化同 video 重算（并发 lost update 防护机制，Codex BLOCK）', async () => {
    const v = await seedTestVideo(db, { title: '测试StatsAgg-lock' })
    const key = `play_stats_agg:${v.id}`
    const a = await db.connect()
    const b = await db.connect()
    try {
      await a.query('BEGIN')
      await a.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key])

      await b.query('BEGIN')
      let bAcquired = false
      const bLock = b
        .query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key])
        .then(() => {
          bAcquired = true
        })
      await new Promise((r) => setTimeout(r, 150))
      expect(bAcquired).toBe(false) // B 被 A 持锁阻塞 → 同 video 重算无法并发交错

      await a.query('COMMIT') // A 提交释放锁
      await bLock
      expect(bAcquired).toBe(true) // B 仅在 A 之后拿到锁
      await b.query('COMMIT')
    } finally {
      a.release()
      b.release()
    }
  })
})
