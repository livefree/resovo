/**
 * play-stats-retention.test.ts — 视频播放统计 retention 真实 PG 数值验证（STATS-04-B / ADR-216 D-216-6）
 *
 * 与 tests/unit/worker/jobs/play-stats-retention.test.ts（mock 编排）互补：验证 SQL 真实删除行为——
 * events 仅删【过期 aggregated】（未聚合含很旧 + 近期 aggregated 保留，**未聚合永不删** 硬不变量）、
 * visitors 按 bucket_date 清理、hourly 按 bucket_hour 清理、daily/totals/hot_scores 永久不动。
 *
 * 运行前提（同 STATS-04-A）：**专用 test DB**（库名含 test token）+ migrate ≥128 + DATABASE_URL（.env.local）。
 *   独立 vitest.integration.config.ts，不入 test:changed。**worktree 无 .env.local → 延后合并期跑**。
 *   beforeAll 守卫库名含 test token；beforeEach TRUNCATE 隔离全局数据（retention 全表删，断言按 video_id）。
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'
import { cleanTestData, seedTestVideo } from '../../helpers/db'
import { runPlayStatsRetention } from '../../../apps/worker/src/jobs/play-stats-retention'

const log = { info: () => {}, warn: () => {}, error: () => {} } as unknown as import('pino').Logger

let db: Pool

beforeAll(async () => {
  db = createIntegrationPool()
  const { rows } = await db.query<{ db: string }>('SELECT current_database() AS db')
  const name = rows[0]?.db ?? ''
  if (!/(^|[_-])test([_-]|$)/i.test(name)) {
    throw new Error(
      `play-stats-retention integration test refuses to TRUNCATE on non-test database "${name}". ` +
        `Point DATABASE_URL at a database whose name has "test" as a token.`,
    )
  }
})

beforeEach(async () => {
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

/** 插一个事件：aggregatedDaysAgo=null → 未聚合（aggregated_at IS NULL）；否则 aggregated_at = NOW()-N 天。 */
async function insertEvent(
  videoId: string,
  opts: { aggregatedDaysAgo: number | null; occurredDaysAgo: number; visitorHash: string },
): Promise<void> {
  keySeq += 1
  await db.query(
    `INSERT INTO video_play_events (
       idempotency_key, video_id, play_session_id, visitor_hash, watch_seconds,
       occurred_at, ingested_at, aggregated_at
     ) VALUES (
       $1, $2, $3, $4, 30,
       NOW() - ($5 || ' days')::interval, NOW(),
       CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() - ($6 || ' days')::interval END
     )`,
    [`ret-${keySeq}`, videoId, `sess-${keySeq}`, opts.visitorHash, opts.occurredDaysAgo, opts.aggregatedDaysAgo],
  )
}

async function insertVisitor(videoId: string, daysAgo: number, visitorHash: string): Promise<void> {
  await db.query(
    `INSERT INTO video_play_daily_visitors (video_id, bucket_date, visitor_hash, first_seen_at)
     VALUES ($1, CURRENT_DATE - $2::int, $3, NOW())`,
    [videoId, daysAgo, visitorHash],
  )
}

async function insertHourly(videoId: string, daysAgo: number): Promise<void> {
  await db.query(
    `INSERT INTO video_play_hourly (video_id, bucket_hour, play_count)
     VALUES ($1, date_trunc('hour', NOW() - ($2 || ' days')::interval), 1)`,
    [videoId, daysAgo],
  )
}

async function count(table: string, videoId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE video_id = $1`,
    [videoId],
  )
  return parseInt(rows[0].n, 10)
}

describe('runPlayStatsRetention — 真实 PG retention 数值（STATS-04-B / ADR-216 D-216-6）', () => {
  it('events 仅删过期 aggregated；未聚合（含很旧）+ 近期 aggregated 保留', async () => {
    const v = await seedTestVideo(db, { title: '测试Ret-events' })
    await insertEvent(v.id, { aggregatedDaysAgo: 100, occurredDaysAgo: 100, visitorHash: 'expired' }) // 删
    await insertEvent(v.id, { aggregatedDaysAgo: null, occurredDaysAgo: 200, visitorHash: 'pending' }) // 未聚合很旧 → 永不删
    await insertEvent(v.id, { aggregatedDaysAgo: 10, occurredDaysAgo: 10, visitorHash: 'recent' }) // 近期 aggregated → 保留

    await runPlayStatsRetention(db, log)

    expect(await count('video_play_events', v.id)).toBe(2)
    const { rows } = await db.query<{ visitor_hash: string }>(
      `SELECT visitor_hash FROM video_play_events WHERE video_id = $1 ORDER BY visitor_hash`,
      [v.id],
    )
    expect(rows.map((r) => r.visitor_hash)).toEqual(['pending', 'recent']) // expired 已删，未聚合 pending 保留
  })

  it('events 近边界：91d aggregated 删、89d aggregated 保留（严格 < 保守语义，Codex LOW）', async () => {
    const v = await seedTestVideo(db, { title: '测试Ret-boundary' })
    await insertEvent(v.id, { aggregatedDaysAgo: 91, occurredDaysAgo: 91, visitorHash: 'over' }) // >90d → 删
    await insertEvent(v.id, { aggregatedDaysAgo: 89, occurredDaysAgo: 89, visitorHash: 'under' }) // <90d → 保留

    await runPlayStatsRetention(db, log)

    const { rows } = await db.query<{ visitor_hash: string }>(
      `SELECT visitor_hash FROM video_play_events WHERE video_id = $1`,
      [v.id],
    )
    expect(rows.map((r) => r.visitor_hash)).toEqual(['under'])
  })

  it('visitors 按 bucket_date 清理（>400d 删、近期保留）', async () => {
    const v = await seedTestVideo(db, { title: '测试Ret-visitors' })
    await insertVisitor(v.id, 500, 'old') // >400d → 删
    await insertVisitor(v.id, 100, 'recent') // <400d → 保留

    await runPlayStatsRetention(db, log)

    expect(await count('video_play_daily_visitors', v.id)).toBe(1)
  })

  it('hourly 按 bucket_hour 清理（>90d 删、近期保留）', async () => {
    const v = await seedTestVideo(db, { title: '测试Ret-hourly' })
    await insertHourly(v.id, 100) // >90d → 删
    await insertHourly(v.id, 10) // <90d → 保留

    await runPlayStatsRetention(db, log)

    expect(await count('video_play_hourly', v.id)).toBe(1)
  })

  it('daily/totals/hot_scores 永久不动（即使极旧）', async () => {
    const v = await seedTestVideo(db, { title: '测试Ret-permanent' })
    await db.query(
      `INSERT INTO video_play_daily (video_id, bucket_date, play_count) VALUES ($1, CURRENT_DATE - 9999, 5)`,
      [v.id],
    )
    await db.query(`INSERT INTO video_play_totals (video_id, total_play_count) VALUES ($1, 5)`, [v.id])
    await db.query(`INSERT INTO video_hot_scores (video_id, hot_score) VALUES ($1, 1.5)`, [v.id])

    await runPlayStatsRetention(db, log)

    expect(await count('video_play_daily', v.id)).toBe(1)
    expect(await count('video_play_totals', v.id)).toBe(1)
    expect(await count('video_hot_scores', v.id)).toBe(1)
  })
})
