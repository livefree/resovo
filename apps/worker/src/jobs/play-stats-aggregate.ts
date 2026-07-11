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
import type { Client } from '@elastic/elasticsearch'
import { ES_INDEX } from '../lib/elasticsearch'

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

/** STATS-06-B：单次 `es.bulk` partial-update 的最大 video 数（限请求体大小，Codex BLOCK 1）。 */
const ES_BULK_CHUNK = 1000
/** STATS-06-B：ES bulk 单次请求超时（best-effort，超时 → warn 不挂 job）。 */
const ES_BULK_TIMEOUT_MS = 10_000
/**
 * STATS-06-B（Codex 实现审 HIGH 3）：阶段二 ES 同步**总时限**（半个 1min tick）。
 * 慢/不可达 ES 下 isRunning 被钉死会使后续聚合 tick 被跳过 → DB 吞吐反受 ES 拖累；
 * 超此时限即停（剩余 video 顺延下 tick / 24h reconcile），保最坏 isRunning < tick 周期、聚合不停。
 */
const ES_SYNC_DEADLINE_MS = 30_000

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
 *
 * STATS-06-B（Codex 任务卡审 HIGH 1）：同次 query 额外返回 `video_id` 供 commit 后 ES 增量同步——
 * 复用本 SQL（**不新增 txn 内 query**，verb 序列 'AFFECTED' 零破坏）；`video_id → lock_key` 确定性，
 * `DISTINCT (video_id, lock_key)` ≡ `DISTINCT video_id`（每 video 一行）；哈希碰撞 → 同 lock_key 多 video
 * 行 → advisory lock 同 key 取多次（事务内可重入，无害，与原 per-video 串行意图一致）。
 */
const SQL_AFFECTED_LOCK_KEYS = `
SELECT DISTINCT video_id::text AS video_id, hashtext($2 || video_id::text) AS lock_key
FROM video_play_events
WHERE id = ANY($1::bigint[])
ORDER BY lock_key
` as const

/**
 * STATS-06-B 阶段二：取本 tick affected video 的物化 play 字段（commit 后、txn 外、用 pool 短连接）。
 * `unnest` 驱动左连——无聚合行的 video（理论上 affected video 必有 totals/hot_scores 行）值为 null，
 * `toNullableNumber` 保 null（对齐 STATS-06-A NULLS LAST / ES missing:_last，非 `?? 0`）。
 */
const SQL_FETCH_PLAY_FIELDS = `
SELECT v.id::text AS id,
       vpt.total_play_count,
       vhs.play_count_7d,
       vhs.hot_score
FROM unnest($1::uuid[]) AS v(id)
LEFT JOIN video_play_totals vpt ON vpt.video_id = v.id
LEFT JOIN video_hot_scores vhs ON vhs.video_id = v.id
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
  video_id: string
  lock_key: number
}

/** 单批聚合结果：处理事件数 + 本批 affected video_id（供阶段二 ES 同步；HIGH 1）。 */
interface BatchResult {
  processed: number
  videoIds: string[]
}

/** 阶段二 ES 同步读取的物化 play 字段行（node-pg：BIGINT/NUMERIC → string）。 */
interface PlayFieldsRow {
  id: string
  total_play_count: string | null
  play_count_7d: string | null
  hot_score: string | null
}

/** node-pg BIGINT/NUMERIC 为 string；ES 需 number。保留 null（不 `?? 0`，对齐 missing:_last）。 */
function toNullableNumber(value: string | null): number | null {
  return value == null ? null : Number(value)
}

/**
 * @elastic v8 bulk item 错误判别：**文档缺失**（partial `doc` 更新落到不存在文档）。
 * 仅认 `error.type === 'document_missing_exception'`——不靠裸 `status === 404`（Codex 实现审 HIGH 1：
 * 404 也可能是 `index_not_found_exception` 等索引/配置故障，误判 missing 会静默隐藏坏索引，
 * 且 reconcile 未必能修）。其余错误（含其它 404）一律计 failed + warn。
 */
function isDocumentMissing(errorType: string | undefined): boolean {
  return errorType === 'document_missing_exception'
}

/** node-cron 不等上一轮 Promise → 本进程重入 guard（Codex HIGH-2）。 */
let isRunning = false

/**
 * 聚合单批：一个独立事务（BEGIN→8 步→COMMIT）。返回处理事件数 + 本批 affected video_id（HIGH 1）。
 * processed=0 → 无 pending。任一步抛错 → ROLLBACK + 上抛（本批 pending 保留；已 commit 批不受影响）。
 * ROLLBACK 自身失败 → 抛 BatchRollbackError（连接污染信号，调用方销毁连接）。
 */
async function aggregateOneBatch(client: PoolClient): Promise<BatchResult> {
  await client.query('BEGIN')
  try {
    const batch = await client.query<BatchIdRow>(SQL_SELECT_BATCH, [BATCH_LIMIT])
    const ids = batch.rows.map((r) => r.id)
    if (ids.length === 0) {
      await client.query('ROLLBACK')
      return { processed: 0, videoIds: [] }
    }

    // Step 2.5：per-video advisory xact lock（按实际 lock key 排序逐个取，防碰撞下交错死锁 + 串行化同 video 重算）；
    // 同次取 affected video_id 供阶段二 ES 同步（HIGH 1，事务内捕获、不 commit 后反查 events）。
    const affected = await client.query<AffectedLockRow>(SQL_AFFECTED_LOCK_KEYS, [ids, ADVISORY_LOCK_PREFIX])
    for (const row of affected.rows) {
      await client.query(SQL_ADVISORY_LOCK, [row.lock_key])
    }
    const videoIds = affected.rows.map((r) => r.video_id)

    await client.query(SQL_UPSERT_HOURLY, [ids])
    await client.query(SQL_UPSERT_DAILY, [ids])
    await client.query(SQL_UPSERT_TOTALS, [ids])
    await client.query(SQL_RECOMPUTE_HOT, [ids, HOT_SCORE_W24, HOT_SCORE_W7, HOT_SCORE_W30])
    await client.query(SQL_MARK_AGGREGATED, [ids])

    await client.query('COMMIT')
    return { processed: ids.length, videoIds }
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
 * 阶段二（STATS-06-B / Codex BLOCK 1）：drain 完成、**PG client 已释放后**，对本 tick affected video
 * 批量 partial-update ES play 字段（best-effort）。两阶段隔离保证：ES 慢/失败不占 DB 连接、不拖垮聚合吞吐。
 *
 * - `es == null`（未配置）或无 affected → no-op（不查 DB 不调 ES）。
 * - 用 `pool` 短连接读物化 play 字段 → `es.bulk` partial doc（仅 3 字段，幂等不清其余 doc 字段）；分块限请求体。
 * - 逐 item：`document_missing`(404) → 跳过（doc 未入索引，由 24h reconcile 兜底，HIGH 3）；其余 item error → warn。
 * - 整段 try/catch 包裹：ES/读取任何失败 → warn 不抛（聚合已 commit，reconcile 周期兜底覆盖漂移）。
 */
async function syncPlayFieldsToEs(
  pool: Pool,
  es: Client | null,
  videoIds: string[],
  log: pino.Logger,
): Promise<void> {
  if (!es || videoIds.length === 0) return
  try {
    const { rows } = await pool.query<PlayFieldsRow>(SQL_FETCH_PLAY_FIELDS, [videoIds])
    let synced = 0
    let missing = 0
    let failed = 0
    const startedAt = Date.now()

    for (let i = 0; i < rows.length; i += ES_BULK_CHUNK) {
      // 总时限护栏（HIGH 3）：超时即停，剩余 video 顺延下 tick / reconcile，避免钉死 isRunning。
      if (Date.now() - startedAt > ES_SYNC_DEADLINE_MS) {
        log.warn(
          { metric: 'play_stats_es_sync.deadline', remaining: rows.length - i, synced, missing, failed },
          'play-stats ES partial-update deadline exceeded; remaining videos rely on 24h reconcile (next tick only re-covers on new events)',
        )
        break
      }
      const chunk = rows.slice(i, i + ES_BULK_CHUNK)
      const operations = chunk.flatMap((r) => [
        { update: { _index: ES_INDEX, _id: r.id } },
        {
          doc: {
            play_count_total: toNullableNumber(r.total_play_count),
            play_count_7d: toNullableNumber(r.play_count_7d),
            hot_score: toNullableNumber(r.hot_score),
          },
        },
      ])
      // maxRetries:0（HIGH 3）：best-effort 路径快失败，不让 ES 重试风暴拖长聚合 tick。
      const res = await es.bulk({ operations }, { requestTimeout: ES_BULK_TIMEOUT_MS, maxRetries: 0 })
      if (!res.errors) {
        synced += chunk.length
        continue
      }
      for (const item of res.items) {
        const u = item.update
        if (!u) continue
        if (u.error) {
          if (isDocumentMissing(u.error.type)) missing += 1
          else failed += 1
        } else {
          synced += 1
        }
      }
    }

    if (failed > 0) {
      log.warn(
        { metric: 'play_stats_es_sync.result', synced, missing, failed },
        'play-stats ES partial-update completed with item errors; reconcile will backfill',
      )
    } else {
      log.info(
        { metric: 'play_stats_es_sync.result', synced, missing, failed },
        'play-stats ES partial-update completed',
      )
    }
  } catch (err) {
    // ES bulk / play 字段读取整体失败：best-effort，聚合已 commit、reconcile 周期兜底 → warn 不抛。
    log.warn(
      { err, metric: 'play_stats_es_sync.error', affected: videoIds.length },
      'play-stats ES partial-update failed; reconcile will backfill',
    )
  }
}

/**
 * runPlayStatsAggregate — cron job 入口（每 1min）。
 * 同进程重入 guard（isRunning）→ **阶段一** 单 client drain 循环：顺序处理 ≤ MAX_BATCHES_PER_TICK 个
 * 独立事务，空批即停，跨批累积 affected video_id；批内抛错向上传播（由 runWithLogger 包，不挂 worker），
 * 正常归还 client，ROLLBACK 失败（BatchRollbackError）→ release(err) 销毁污染连接。
 * **阶段二**（client 已释放后）：best-effort `es.bulk` partial-update ES play 字段（STATS-06-B）——
 * **无论 drain 成功或中途失败都对已累积的 affected video 执行**（HIGH 2：已 commit 批不漏同步），
 * 之后若有 drainError 再 rethrow 保既有错误语义。
 *
 * @param es worker 自包含 ES client（`null` = 未配置 → 阶段二 no-op；显式注入、默认 null 不依赖环境，
 *           保既有单测确定性，Codex 任务卡审 MEDIUM 1）。
 */
export async function runPlayStatsAggregate(
  pool: Pool,
  log: pino.Logger,
  es: Client | null = null,
): Promise<void> {
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
    let drainError: unknown = null
    const affectedVideoIds = new Set<string>()
    try {
      for (let i = 0; i < MAX_BATCHES_PER_TICK; i++) {
        let result: BatchResult
        try {
          result = await aggregateOneBatch(client)
        } catch (err) {
          // 捕获不立抛（HIGH 2）：先在阶段二同步**已 commit 批**的 affected video，再 rethrow。
          if (err instanceof BatchRollbackError) poisoned = true
          drainError = err
          break
        }
        if (result.processed === 0) break
        totalProcessed += result.processed
        batches += 1
        for (const id of result.videoIds) affectedVideoIds.add(id)
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

    if (!drainError) {
      log.info(
        { metric: 'play_stats_aggregate.processed', value: totalProcessed, batches },
        'play-stats-aggregate: batch aggregation completed',
      )
    }

    // 阶段二：PG client 已释放 → best-effort ES 增量同步（不占 DB 连接，ES 失败不挂 job）。
    // drain 中途失败时仍同步已 commit 批的 video（HIGH 2），随后 rethrow 保 T11/T12 错误语义。
    await syncPlayFieldsToEs(pool, es, [...affectedVideoIds], log)

    if (drainError) throw drainError
  } finally {
    isRunning = false
  }
}
