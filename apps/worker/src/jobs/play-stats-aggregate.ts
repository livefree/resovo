/**
 * play-stats-aggregate.ts — 视频级播放事件批量聚合 cron job（每 1min / STATS-04-A）
 *
 * 设计真源：
 *   - ADR-216 D-216-10：batch `LIMIT=500`、单批单事务、`FOR UPDATE SKIP LOCKED` 取
 *     `aggregated_at IS NULL ORDER BY ingested_at ASC`；单 tick 顺序执行 ≤ MAX_BATCHES_PER_TICK
 *     个**独立事务**（非一个大事务）→ 各批独立 commit，crash 仅当前批 pending、已 commit 批不回滚。
 *   - ADR-216 D-216-3：`hot_score = pc24×1.0 + pc7×0.3 + pc30×0.1`，从 `video_play_hourly`
 *     按窗口**全量重算（非增量累加）** → 旧事件滑出窗口后 hot_score/pc24 自然下降。
 *     窗口嵌套：7d⊃24h、30d⊃7d（FILTER 各自独立下界，累加加成）。
 *   - ADR-216 D-216-7：daily UV 仅对 `NOT visitor_is_ephemeral` 行写 video_play_daily_visitors
 *     + 计 unique_visitor_count（用实插行数增量，去重靠 (video_id,bucket_date,visitor_hash) 唯一约束）。
 *   - ADR-216 D-216-9：所有窗口查询显式 `bucket_hour <= NOW()` 防被注入的未来桶污染 hot_score。
 *   - ADR-107 §4：worker **禁止** import apps/api 内部任何文件 → SQL 全程内联（同 auto-retire-line 范式）。
 *   - 设计稿 video-play-stats-structure_20260624.md §Aggregation Worker step 1-8。
 *
 * 并发安全（Codex 对抗审 BLOCK/HIGH 吸收）：
 *   - 事件不重复：`FOR UPDATE SKIP LOCKED` 保多 worker 实例 / 多 tick 各取不同批；后续 upsert 按
 *     `id = ANY($ids)` 作用于已锁定批，不重查 `aggregated_at IS NULL`。
 *   - **hot_score lost update 防护**：`hot_scores` 全量覆盖（= EXCLUDED）下，两事务并发处理同一
 *     video 不同小时桶时，各自快照看不到对方未提交的 hourly 增量 → 后提交者覆盖前者、丢半批热度。
 *     故 step 2.5 对本批 affected video 取 **per-video 事务级 advisory lock**（按 video_id 排序防死锁）
 *     串行化同 video 的重算序列：后批 step 7 在前批 COMMIT 后执行 → 读到全部已提交 hourly 桶。
 *   - **同进程重入**：node-cron 不等上一轮 Promise → drain >60s 会同进程并发跑多轮、突破 ≤10 事务
 *     节流并放大 lost update。`isRunning` guard 保证本进程串行（多实例仍靠上面的 advisory lock）。
 *
 * 增量 vs 覆盖语义（关键不变量）：
 *   - hourly / daily / totals = **增量累加**（ON CONFLICT `col = 表.col + EXCLUDED.col`）：每批新事件加进既有桶。
 *   - hot_scores = **全量覆盖**（ON CONFLICT `col = EXCLUDED.col`）：按窗口重算，非累加，否则旧事件滑窗后无法递减。
 */

import type { Pool, PoolClient } from 'pg'
import type pino from 'pino'

/** D-216-3 hot_score 加权窗口常量（单一真源；近 24h 等效总权重 1.4 为刻意近期偏置）。 */
export const HOT_SCORE_W24 = 1.0
export const HOT_SCORE_W7 = 0.3
export const HOT_SCORE_W30 = 0.1

/** D-216-10：单批事件上限。 */
export const BATCH_LIMIT = 500
/** D-216-10：单 tick 最多顺序处理的独立事务批数（≈5000 events/min 容量上限，背压见 D-216-10 M3）。 */
export const MAX_BATCHES_PER_TICK = 10

/** per-video advisory lock key 前缀（防与其他 job 的 advisory 命名空间碰撞）。 */
const ADVISORY_LOCK_PREFIX = 'play_stats_agg:'

/** ROLLBACK 自身失败 → 事务状态未知，连接必须销毁而非归还池（Codex HIGH-1）。 */
class BatchRollbackError extends Error {
  constructor(
    readonly originalError: unknown,
    readonly rollbackError: unknown,
  ) {
    super('play-stats-aggregate: ROLLBACK failed after batch error; connection poisoned')
    this.name = 'BatchRollbackError'
  }
}

/**
 * Step 1：取一批 pending 事件 id（D-216-10）。
 * 仅取 id —— 后续所有聚合按 `id = ANY($ids)` 作用于本批锁定行（不复用本 SELECT 行集，避免大数组进内存）。
 */
const SQL_SELECT_BATCH = `
SELECT id
FROM video_play_events
WHERE aggregated_at IS NULL
ORDER BY ingested_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED
` as const

/**
 * Step 2.5a：本批受影响 video 的 advisory lock key（Codex round2 MEDIUM）。
 * 直接计算**实际锁资源** `hashtext(prefix || video_id)` 并 DISTINCT + `ORDER BY lock_key` —— 死锁规避要求
 * 所有并发事务按真实锁资源（而非映射前 video_id）一致排序；哈希碰撞时不同 video 落同 key 仅致偶尔多串行化，
 * 正确性不受损（同 key 互斥本就该串行）。prefix 参数化（$2）不拼接 SQL。
 */
const SQL_AFFECTED_LOCK_KEYS = `
SELECT DISTINCT hashtext($2 || video_id::text) AS lock_key
FROM video_play_events
WHERE id = ANY($1::bigint[])
ORDER BY lock_key
` as const

/** Step 2.5b：对单个 lock key 取事务级 advisory lock（COMMIT/ROLLBACK 自动释放）。 */
const SQL_ADVISORY_LOCK = `SELECT pg_advisory_xact_lock($1::bigint)` as const

/** Step 3：upsert video_play_hourly（增量累加；anon/logged_in 以 user_id IS NULL 拆分）。 */
const SQL_UPSERT_HOURLY = `
INSERT INTO video_play_hourly (
  video_id, bucket_hour, play_count, anon_play_count,
  logged_in_play_count, total_watch_seconds, updated_at
)
SELECT
  ve.video_id,
  date_trunc('hour', ve.occurred_at),
  COUNT(*),
  COUNT(*) FILTER (WHERE ve.user_id IS NULL),
  COUNT(*) FILTER (WHERE ve.user_id IS NOT NULL),
  COALESCE(SUM(ve.watch_seconds), 0),
  NOW()
FROM video_play_events ve
WHERE ve.id = ANY($1::bigint[])
GROUP BY ve.video_id, date_trunc('hour', ve.occurred_at)
ON CONFLICT (video_id, bucket_hour) DO UPDATE SET
  play_count = video_play_hourly.play_count + EXCLUDED.play_count,
  anon_play_count = video_play_hourly.anon_play_count + EXCLUDED.anon_play_count,
  logged_in_play_count = video_play_hourly.logged_in_play_count + EXCLUDED.logged_in_play_count,
  total_watch_seconds = video_play_hourly.total_watch_seconds + EXCLUDED.total_watch_seconds,
  updated_at = NOW()
` as const

/**
 * Step 4+5：daily_visitors 插入（仅 NOT ephemeral，D-216-7）+ daily upsert（增量）。
 * CTE new_visitors 用 (video_id,bucket_date,visitor_hash) 唯一约束去重，RETURNING 实插行 → uv_counts
 * 得每 (video,date) 新增 UV 数 → daily.unique_visitor_count 增量（同 visitor/day/video 跨批只 +1）。
 * DISTINCT ON 先去本批内同 (video,date,visitor) 重复（取最早 occurred_at 作 first_seen_at）。
 */
const SQL_UPSERT_DAILY = `
WITH new_visitors AS (
  INSERT INTO video_play_daily_visitors (video_id, bucket_date, visitor_hash, first_seen_at)
  SELECT DISTINCT ON (ve.video_id, ve.occurred_at::date, ve.visitor_hash)
    ve.video_id, ve.occurred_at::date, ve.visitor_hash, ve.occurred_at
  FROM video_play_events ve
  WHERE ve.id = ANY($1::bigint[])
    AND ve.visitor_is_ephemeral = false
  ORDER BY ve.video_id, ve.occurred_at::date, ve.visitor_hash, ve.occurred_at ASC
  ON CONFLICT (video_id, bucket_date, visitor_hash) DO NOTHING
  RETURNING video_id, bucket_date
),
uv_counts AS (
  SELECT video_id, bucket_date, COUNT(*) AS new_uv
  FROM new_visitors
  GROUP BY video_id, bucket_date
),
play_counts AS (
  SELECT
    ve.video_id,
    ve.occurred_at::date AS bucket_date,
    COUNT(*) AS play_count,
    COUNT(*) FILTER (WHERE ve.user_id IS NULL) AS anon_play_count,
    COUNT(*) FILTER (WHERE ve.user_id IS NOT NULL) AS logged_in_play_count,
    COALESCE(SUM(ve.watch_seconds), 0) AS total_watch_seconds
  FROM video_play_events ve
  WHERE ve.id = ANY($1::bigint[])
  GROUP BY ve.video_id, ve.occurred_at::date
)
INSERT INTO video_play_daily (
  video_id, bucket_date, play_count, unique_visitor_count,
  anon_play_count, logged_in_play_count, total_watch_seconds, updated_at
)
SELECT
  pc.video_id, pc.bucket_date, pc.play_count, COALESCE(uv.new_uv, 0),
  pc.anon_play_count, pc.logged_in_play_count, pc.total_watch_seconds, NOW()
FROM play_counts pc
LEFT JOIN uv_counts uv ON uv.video_id = pc.video_id AND uv.bucket_date = pc.bucket_date
ON CONFLICT (video_id, bucket_date) DO UPDATE SET
  play_count = video_play_daily.play_count + EXCLUDED.play_count,
  unique_visitor_count = video_play_daily.unique_visitor_count + EXCLUDED.unique_visitor_count,
  anon_play_count = video_play_daily.anon_play_count + EXCLUDED.anon_play_count,
  logged_in_play_count = video_play_daily.logged_in_play_count + EXCLUDED.logged_in_play_count,
  total_watch_seconds = video_play_daily.total_watch_seconds + EXCLUDED.total_watch_seconds,
  updated_at = NOW()
` as const

/** Step 6：upsert video_play_totals（增量；last_played_at = GREATEST，PG GREATEST 忽略 NULL）。 */
const SQL_UPSERT_TOTALS = `
INSERT INTO video_play_totals (video_id, total_play_count, last_played_at, updated_at)
SELECT
  ve.video_id, COUNT(*), MAX(ve.occurred_at), NOW()
FROM video_play_events ve
WHERE ve.id = ANY($1::bigint[])
GROUP BY ve.video_id
ON CONFLICT (video_id) DO UPDATE SET
  total_play_count = video_play_totals.total_play_count + EXCLUDED.total_play_count,
  last_played_at = GREATEST(video_play_totals.last_played_at, EXCLUDED.last_played_at),
  updated_at = NOW()
` as const

/**
 * Step 7：hot_scores **全量重算**（D-216-3）。对本批 affected video_id 从已更新的 video_play_hourly
 * 按嵌套窗口重算 pc24/pc7/pc30 + hot_score 快照。`bucket_hour <= NOW()` 防未来桶（D-216-9）；
 * 下界 `>= NOW() - 30d` 限制扫描。ON CONFLICT 覆盖（= EXCLUDED）非累加 → 旧桶滑出窗口后 score 下降。
 * 并发正确性由 step 2.5 per-video advisory lock 保证（同 video 重算串行，读到全部已提交桶）。
 * 注：仅本批 affected video 被重算；无新事件的 video 短期 hot_score stale 为 ADR-216 v1 已知边界。
 */
const SQL_RECOMPUTE_HOT = `
WITH affected AS (
  SELECT DISTINCT video_id
  FROM video_play_events
  WHERE id = ANY($1::bigint[])
),
windowed AS (
  SELECT
    a.video_id,
    COALESCE(SUM(h.play_count) FILTER (WHERE h.bucket_hour >= NOW() - INTERVAL '24 hours'), 0) AS pc24,
    COALESCE(SUM(h.play_count) FILTER (WHERE h.bucket_hour >= NOW() - INTERVAL '7 days'), 0) AS pc7,
    COALESCE(SUM(h.play_count) FILTER (WHERE h.bucket_hour >= NOW() - INTERVAL '30 days'), 0) AS pc30
  FROM affected a
  LEFT JOIN video_play_hourly h
    ON h.video_id = a.video_id
   AND h.bucket_hour <= NOW()
   AND h.bucket_hour >= NOW() - INTERVAL '30 days'
  GROUP BY a.video_id
)
INSERT INTO video_hot_scores (
  video_id, hot_score, play_count_24h, play_count_7d, play_count_30d, computed_at
)
SELECT
  video_id,
  pc24 * $2 + pc7 * $3 + pc30 * $4,
  pc24, pc7, pc30, NOW()
FROM windowed
ON CONFLICT (video_id) DO UPDATE SET
  hot_score = EXCLUDED.hot_score,
  play_count_24h = EXCLUDED.play_count_24h,
  play_count_7d = EXCLUDED.play_count_7d,
  play_count_30d = EXCLUDED.play_count_30d,
  computed_at = NOW()
` as const

/** Step 8：标记本批 aggregated（不变量②：未聚合永不删 → retention 跳过 aggregated_at IS NULL）。 */
const SQL_MARK_AGGREGATED = `
UPDATE video_play_events
SET aggregated_at = NOW()
WHERE id = ANY($1::bigint[])
` as const

interface BatchIdRow {
  id: string // BIGSERIAL → string
}

interface AffectedLockRow {
  lock_key: number
}

/** node-cron 不等上一轮 Promise → 本进程重入 guard（Codex HIGH-2）。 */
let isRunning = false

/**
 * 聚合单批：一个独立事务（BEGIN→8 步→COMMIT）。返回处理事件数（0 = 无 pending）。
 * 任一步抛错 → ROLLBACK + 上抛（本批 pending 保留；已 commit 批不受影响）。
 * ROLLBACK 自身失败 → 抛 BatchRollbackError（连接污染信号，调用方销毁连接）。
 */
async function aggregateOneBatch(client: PoolClient): Promise<number> {
  await client.query('BEGIN')
  try {
    const batch = await client.query<BatchIdRow>(SQL_SELECT_BATCH, [BATCH_LIMIT])
    const ids = batch.rows.map((r) => r.id)
    if (ids.length === 0) {
      await client.query('ROLLBACK')
      return 0
    }

    // Step 2.5：per-video advisory xact lock（按实际 lock key 排序逐个取，防碰撞下交错死锁 + 串行化同 video 重算）
    const affected = await client.query<AffectedLockRow>(SQL_AFFECTED_LOCK_KEYS, [ids, ADVISORY_LOCK_PREFIX])
    for (const row of affected.rows) {
      await client.query(SQL_ADVISORY_LOCK, [row.lock_key])
    }

    await client.query(SQL_UPSERT_HOURLY, [ids])
    await client.query(SQL_UPSERT_DAILY, [ids])
    await client.query(SQL_UPSERT_TOTALS, [ids])
    await client.query(SQL_RECOMPUTE_HOT, [ids, HOT_SCORE_W24, HOT_SCORE_W7, HOT_SCORE_W30])
    await client.query(SQL_MARK_AGGREGATED, [ids])

    await client.query('COMMIT')
    return ids.length
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr) {
      throw new BatchRollbackError(err, rollbackErr)
    }
    throw err
  }
}

/**
 * runPlayStatsAggregate — cron job 入口（每 1min）。
 * 同进程重入 guard（isRunning）→ 单 client drain 循环：顺序处理 ≤ MAX_BATCHES_PER_TICK 个独立事务，空批即停。
 * 批内抛错向上传播（由调用方 runWithLogger try/catch 包，不挂 worker）；
 * 正常归还 client；ROLLBACK 失败（BatchRollbackError）→ release(err) 销毁污染连接。
 */
export async function runPlayStatsAggregate(pool: Pool, log: pino.Logger): Promise<void> {
  if (isRunning) {
    log.info(
      { metric: 'play_stats_aggregate.skipped_overlap', value: 1 },
      'play-stats-aggregate: previous tick still in progress, skipping',
    )
    return
  }
  isRunning = true
  try {
    const client = await pool.connect()
    let totalProcessed = 0
    let batches = 0
    let poisoned = false
    try {
      for (let i = 0; i < MAX_BATCHES_PER_TICK; i++) {
        let n: number
        try {
          n = await aggregateOneBatch(client)
        } catch (err) {
          if (err instanceof BatchRollbackError) poisoned = true
          throw err
        }
        if (n === 0) break
        totalProcessed += n
        batches += 1
      }
    } finally {
      if (poisoned) {
        client.release(
          new Error('play-stats-aggregate: connection poisoned by failed ROLLBACK; destroyed to avoid pool contamination'),
        )
      } else {
        client.release()
      }
    }

    log.info(
      { metric: 'play_stats_aggregate.processed', value: totalProcessed, batches },
      'play-stats-aggregate: batch aggregation completed',
    )
  } finally {
    isRunning = false
  }
}
