/**
 * play-stats-retention.ts — 视频播放统计 retention maintenance job（每日 / STATS-04-B）
 *
 * 设计真源：
 *   - ADR-216 D-216-6（retention v1 代码常量，不进 system settings）：
 *       · video_play_events        = aggregated 后 90 天（**未聚合永不删** → 双谓词 aggregated_at IS NOT NULL）
 *       · video_play_daily_visitors = 400 天（按 idx_video_play_daily_visitors_date(bucket_date) 索引清理）
 *       · video_play_hourly         = 90 天
 *       · video_play_daily / video_play_totals / video_hot_scores = **永久不动**
 *     独立 maintenance job，绝不删 aggregated_at IS NULL（不变量②：未聚合事件是可重放真源）。
 *   - ADR-107 §4：worker 禁 import apps/api → SQL 内联（同 auto-retire-line / play-stats-aggregate 范式）。
 *
 * 并发：删除幂等（删已删行无害），多 worker 实例并发不会产生错误数据；但用 job-level advisory lock
 *   （pg_try_advisory_lock，同 auto-retire-line）避免多实例重复全表扫描，省资源。unlock 失败 → release(err)
 *   销毁连接（session-level lock 随连接终结自动释放，防 lock 泄漏到 pool）。
 *
 * 批量删除：每表 ctid IN (SELECT ... LIMIT RETENTION_DELETE_BATCH) 循环至不满批，
 *   各批独立 autocommit（无显式事务）→ 短锁、crash 中断已删批保留。常量集中、可 amendment 转可配。
 */

import type { Pool, PoolClient } from 'pg'
import type pino from 'pino'

/** D-216-6 retention 常量（单一真源；amendment 可转 system settings）。 */
export const EVENTS_RETENTION_DAYS = 90
export const DAILY_VISITORS_RETENTION_DAYS = 400
export const HOURLY_RETENTION_DAYS = 90
/** 单批删除上限（控制锁时长 + 长事务）。 */
export const RETENTION_DELETE_BATCH = 1000
/** 防御性循环上限（正常删除会推进收敛；达此值记 warn 退出，防异常无限循环）。 */
const MAX_DELETE_ITERATIONS = 10_000

/** job-level advisory lock key（多实例并发 skip；区别于 play-stats-aggregate 的 per-video xact lock）。 */
const ADVISORY_LOCK_KEY = 'worker:play-stats-retention'

/**
 * events：仅删【已聚合且过期】行。双谓词 `aggregated_at IS NOT NULL` 是 D-216-6 硬不变量——
 * 未聚合事件（aggregated_at IS NULL）是可重放真源，retention 永不触碰。
 */
const SQL_DELETE_EVENTS = `
DELETE FROM video_play_events
WHERE ctid IN (
  SELECT ctid FROM video_play_events
  WHERE aggregated_at IS NOT NULL
    AND aggregated_at < NOW() - ($1 || ' days')::INTERVAL
  LIMIT $2
)
` as const

/** daily_visitors：按 bucket_date 清理（DATE - int = DATE，命中 idx_video_play_daily_visitors_date）。 */
const SQL_DELETE_VISITORS = `
DELETE FROM video_play_daily_visitors
WHERE ctid IN (
  SELECT ctid FROM video_play_daily_visitors
  WHERE bucket_date < CURRENT_DATE - $1::int
  LIMIT $2
)
` as const

/** hourly：按 bucket_hour 清理。 */
const SQL_DELETE_HOURLY = `
DELETE FROM video_play_hourly
WHERE ctid IN (
  SELECT ctid FROM video_play_hourly
  WHERE bucket_hour < NOW() - ($1 || ' days')::INTERVAL
  LIMIT $2
)
` as const

/**
 * 批量删除单表：循环 DELETE ... ctid IN (SELECT ... LIMIT batch) 直到不满批（删完）。
 * 各批独立 autocommit；返回累计删除行数。达 MAX_DELETE_ITERATIONS 防御性退出并记 warn。
 */
async function deleteInBatches(
  client: PoolClient,
  sql: string,
  days: number,
  label: string,
  log: pino.Logger,
): Promise<number> {
  let total = 0
  for (let i = 0; i < MAX_DELETE_ITERATIONS; i += 1) {
    const res = await client.query(sql, [days, RETENTION_DELETE_BATCH])
    const n = res.rowCount ?? 0
    total += n
    if (n < RETENTION_DELETE_BATCH) return total
  }
  log.warn(
    { table: label, deleted: total, max_iterations: MAX_DELETE_ITERATIONS },
    'play-stats-retention: hit max delete iterations; remaining rows deferred to next run',
  )
  return total
}

/**
 * runPlayStatsRetention — 每日 cron job 入口。
 * job-level advisory lock（多实例并发 skip）→ 顺序批量删 events / visitors / hourly；
 * daily/totals/hot_scores 永久不动。unlock 失败 → release(err) 销毁连接。
 */
export async function runPlayStatsRetention(pool: Pool, log: pino.Logger): Promise<void> {
  const client: PoolClient = await pool.connect()
  let acquired = false
  let unlockFailed = false

  try {
    const lockResult = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [ADVISORY_LOCK_KEY],
    )
    acquired = lockResult.rows[0]?.acquired === true
    if (!acquired) {
      log.info(
        { lock_key: ADVISORY_LOCK_KEY },
        'play-stats-retention: another instance holds advisory lock, skipping',
      )
      return
    }

    const events = await deleteInBatches(client, SQL_DELETE_EVENTS, EVENTS_RETENTION_DAYS, 'video_play_events', log)
    const visitors = await deleteInBatches(
      client,
      SQL_DELETE_VISITORS,
      DAILY_VISITORS_RETENTION_DAYS,
      'video_play_daily_visitors',
      log,
    )
    const hourly = await deleteInBatches(client, SQL_DELETE_HOURLY, HOURLY_RETENTION_DAYS, 'video_play_hourly', log)

    log.info(
      { metric: 'play_stats_retention.deleted', events, visitors, hourly },
      'play-stats-retention: completed',
    )
  } finally {
    if (acquired) {
      try {
        await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [ADVISORY_LOCK_KEY])
      } catch (err) {
        unlockFailed = true
        log.warn(
          { err, lock_key: ADVISORY_LOCK_KEY },
          'play-stats-retention: advisory_unlock failed; destroying connection to force lock release',
        )
      }
    }
    if (unlockFailed) {
      client.release(
        new Error('play-stats-retention: advisory_unlock failed; connection destroyed to release session-level lock'),
      )
    } else {
      client.release()
    }
  }
}
