/**
 * video-play-analytics.test.ts — 后台播放分析 analytics query 真实 PG 集成（ADR-217 / STATS-07-A）
 *
 * 防回归（mock 单测盲区）：generate_series(...)::date LEFT JOIN zero-fill、to_char YYYY-MM-DD、
 *   INNER JOIN videos deleted_at、确定性 tie-break、CURRENT_DATE 窗口在真实 PG 的可执行性 + 不变量。
 *   结构错/类型推断错（参 BUGFIX-RENDERCHECK-PLAYBACK-SQL-CAST 教训）mock 全程隐藏。
 *
 * 时区同源守护（D-217-2 / Codex 卡审 MEDIUM-5 + 代码审 HIGH-1）双层：
 *   (a) 静态层（tests/unit/api/video-play-analytics-guards.test.ts）——断言 api `lib/postgres.ts` +
 *       worker `lib/db.ts` 两侧真实 pool 构造源均无 `SET TIME ZONE` / options timezone（反单边漂移、反自证）。
 *   (b) DB 层（本文件）——**实开 api + worker 两侧真实 pool 模块**，各跑 `SHOW timezone` 断言相等。
 *       (a) 静态文本门看不见 env/连接串层漂移（`PGTZ` / connectionString `options=-c timezone=`），
 *       (b) 在真实连接上直接核对相等，二者互补不互替（Codex 代码审 HIGH-1）。
 *
 * 只读（不写 dev DB 数据，对齐 integration-pg 约定）；空库时退化为可执行性 + 结构不变量断言。
 *
 * 运行前提（同 tests/helpers/integration-pg.ts）：dev DB up + migrate ≥128 + DATABASE_URL（.env.local）。
 *   独立 vitest.integration.config.ts，不入 test:changed / 单测门。worktree 无 DB → 落盘、实跑延后至合并期。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'
import {
  getVideoPlaysOverview,
  getVideoPlaysTrend,
  getTopVideosByPlays,
} from '@/api/db/queries/videoPlayStats'
// HIGH-1（Codex 代码审）：时区同源 DB 层升「真池相等门」——import 两侧**真实** pool 模块（非在测内重构，
//   重构会与真配置漂移而假绿），各跑 SHOW timezone 断言相等。
import { db as apiPool } from '@/api/lib/postgres'
import { db as workerPool } from '../../../apps/worker/src/lib/db'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
  await apiPool.end()
  await workerPool.end()
})

describe('getVideoPlaysOverview（真实 PG 可执行 + 不变量）', () => {
  it('恒返单行；totalPlays === anonPlays + loggedInPlays（聚合互补不变量）', async () => {
    const row = await getVideoPlaysOverview(db, 7)
    expect(row).toBeDefined()
    const total = Number(row.total_plays)
    const anon = Number(row.anon_plays)
    const logged = Number(row.logged_in_plays)
    expect(Number.isNaN(total)).toBe(false)
    expect(total).toBe(anon + logged)
  })
})

describe('getVideoPlaysTrend（zero-fill + date 格式）', () => {
  it('period=7d → 恰好 7 个有序日点，date 严格 YYYY-MM-DD 升序', async () => {
    const rows = await getVideoPlaysTrend(db, 7)
    expect(rows).toHaveLength(7)
    let prev = ''
    for (const r of rows) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.date).not.toContain('T')
      expect(r.date > prev).toBe(true) // 升序
      prev = r.date
      expect(Number.isNaN(Number(r.plays))).toBe(false)
    }
  })

  it('period=30d → 30 点 / 90d → 90 点', async () => {
    expect(await getVideoPlaysTrend(db, 30)).toHaveLength(30)
    expect(await getVideoPlaysTrend(db, 90)).toHaveLength(90)
  })
})

describe('getTopVideosByPlays（存活视频 + tie-break + limit）', () => {
  it('limit 生效（≤ N）+ plays 降序 + 仅存活视频（deleted_at IS NULL，由 INNER JOIN 保证）', async () => {
    const limit = 5
    const rows = await getTopVideosByPlays(db, 90, limit)
    expect(rows.length).toBeLessThanOrEqual(limit)
    let prevPlays = Infinity
    for (const r of rows) {
      const plays = Number(r.plays)
      expect(plays).toBeLessThanOrEqual(prevPlays) // SUM(play_count) DESC
      prevPlays = plays
      expect(typeof r.short_id).toBe('string')
      expect(typeof r.title).toBe('string')
    }
    // 已删视频不应出现：逐项核验 videos.deleted_at IS NULL
    for (const r of rows) {
      const check = await db.query<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM videos WHERE short_id = $1',
        [r.short_id],
      )
      expect(check.rows[0]?.deleted_at).toBeNull()
    }
  })
})

describe('时区同源 DB 层（D-217-2 / Codex 代码审 HIGH-1：真池相等门）', () => {
  it('api pool 与 worker pool 的 SHOW timezone 非空且相等（挡 env/连接串 timezone 漂移）', async () => {
    const apiRes = await apiPool.query<{ TimeZone: string }>('SHOW timezone')
    const workerRes = await workerPool.query<{ TimeZone: string }>('SHOW timezone')
    const apiZone = apiRes.rows[0]?.TimeZone
    const workerZone = workerRes.rows[0]?.TimeZone
    expect(apiZone).toBeTruthy()
    expect(workerZone).toBeTruthy()
    // 核心不变量：聚合写端（worker）occurred_at::date 与 analytics 读端（api）CURRENT_DATE 必须同 session TZ
    expect(apiZone).toBe(workerZone)
  })
})
