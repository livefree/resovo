/**
 * auto-retire-line.ts — apps/worker auto-retire-line cron job
 *
 * CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B / Wave 4 #5-B / SEQ-20260528-MOD-WAVE4
 * + Codex stop-time review FIX-3：worker 内联 SQL（撤销 apps/api 跨 app import / ADR-107 §4 硬约束）
 *
 * 设计真源：
 *   - ADR-107 §4 worker **禁止** import apps/api 内部任何文件 / 零跨 workspace 代码耦合
 *   - ADR-164 D-164-8（worker 自动退役 / 不写 admin audit / 不触发 R-MID-1 / 写 worker 日志）
 *   - arch-reviewer (claude-opus-4-7) Opus 评审 §6 工作流 + §2.2 SQL 草案
 *
 * SQL 真源对照（**跨包同步约束**）：
 *   `apps/api/src/db/queries/auto-retire-line.ts` 是 SQL 字面量的并行真源（CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A ship）
 *   - 该文件已 ship 10/10 单测（含 Codex FIX-1 deleted_at + FIX-2 release(err) 双层修复）
 *   - 本文件 SQL 必须与之 byte-identical / 维护时双侧同步改 / 评审报告 §2.2 §6 为共同源头
 *   - 既有 worker job (level1-probe / level2-render / feedback-driven) 内联 SQL 是 ADR-107 §4 范式
 *
 * 红线吸收（同 -A）：
 *   - R-DEAD-1：段 1+2 / 段 3 拆两条独立 SQL 语句（NOW() 同事务等值风险规避）
 *   - R-DEAD-2：CTE LEFT JOIN + vs.deleted_at IS NULL + 'orphan' 显式清 NULL
 *   - R-DEAD-3：pg_try_advisory_lock 非阻塞 + pool.connect() 同 client + finally unlock + 失败 release(err) destroy connection
 *   - R-DEAD-4：RETURNING 段 3 退役清单 + 结构化日志 per row（在本文件 runAutoRetireLine 中实现）
 */

import type { Pool, PoolClient } from 'pg'
import type pino from 'pino'

/** ADR-164 plan §10.5：全 dead 持续 180 天阈值 */
export const DEAD_THRESHOLD_DAYS = 180

/** arch-reviewer Opus Q3：单次 cron run 最多 retire 50 条 / 防雪崩 + 优先退役最老 alias */
export const RETIRE_BATCH_LIMIT = 50

/** advisory lock key（hashtext 哈希）— job-level / 多 worker 实例并发安全 */
const ADVISORY_LOCK_KEY = 'worker:auto-retire-line'

/**
 * 自动退役结果行（RETURNING + 结构化日志输入）
 * 字段与 apps/api/src/db/queries/auto-retire-line.ts RetiredAliasRow 保持同名
 */
interface RetiredAliasRow {
  readonly source_site_key: string
  readonly source_name: string
  readonly dead_since: string
}

/**
 * SQL 段 1+2：维护 dead_since 状态机
 * **SQL 真源对照**：apps/api/src/db/queries/auto-retire-line.ts SQL_MAINTAIN_DEAD_SINCE
 *   - 必须 byte-identical / 跨包同步改 / Codex FIX-1 vs.deleted_at IS NULL 已落地
 */
/**
 * SQL 段 1+2 / WAVE4-VALIDATION-FIX-4 P1 升级（同 apps/api 真源对照）：
 *
 * 旧实现 site_key 比对在 WHERE 是 post-join 过滤 → LEFT JOIN 退化为 INNER JOIN 语义
 * 反例：alias_A (siteA, '线路1') 孤儿 + video_sources 含 (siteB, '线路1', ok) 同名其他站
 * → LEFT JOIN match 后 WHERE 过滤 → alias_A 整行消失 → 不参与 classified 'orphan' → dead_since 永远不清理
 *
 * 修复：用 effective_sources CTE 预计算 effective_site_key + 把 site_key 比对放 LEFT JOIN ON 子句
 * SQL 真源对照 apps/api/src/db/queries/auto-retire-line.ts SQL_MAINTAIN_DEAD_SINCE（byte-identical）
 */
const SQL_MAINTAIN_DEAD_SINCE = `
WITH effective_sources AS (
  -- 预计算 effective_site_key（COALESCE fallback）+ 过滤 is_active / deleted_at
  SELECT
    vs.id,
    vs.source_name,
    vs.probe_status,
    vs.render_status,
    COALESCE(vs.source_site_key, v.site_key) AS effective_site_key
  FROM video_sources vs
  LEFT JOIN videos v ON v.id = vs.video_id
  WHERE vs.is_active = true AND vs.deleted_at IS NULL
),
alias_dead_status AS (
  SELECT
    sla.source_site_key,
    sla.source_name,
    sla.dead_since AS prev_dead_since,
    COUNT(es.id)                                                AS source_count,
    COUNT(*) FILTER (
      WHERE es.probe_status = 'dead' AND es.render_status = 'dead'
    )                                                            AS dead_count
  FROM source_line_aliases sla
  LEFT JOIN effective_sources es
    ON es.source_name        = sla.source_name
   AND es.effective_site_key = sla.source_site_key
  WHERE sla.retired_at IS NULL
  GROUP BY sla.source_site_key, sla.source_name, sla.dead_since
),
classified AS (
  SELECT
    source_site_key,
    source_name,
    prev_dead_since,
    CASE
      WHEN source_count = 0                  THEN 'orphan'
      WHEN dead_count = source_count         THEN 'all_dead'
      ELSE 'has_alive'
    END AS state
  FROM alias_dead_status
)
UPDATE source_line_aliases sla
SET dead_since = CASE
                   WHEN c.state = 'all_dead'  AND sla.dead_since IS NULL     THEN NOW()
                   WHEN c.state = 'has_alive'                                 THEN NULL
                   WHEN c.state = 'orphan'    AND sla.dead_since IS NOT NULL THEN NULL
                   ELSE sla.dead_since
                 END,
    updated_at = NOW()
FROM classified c
WHERE sla.source_site_key = c.source_site_key
  AND sla.source_name     = c.source_name
  AND (
       (c.state = 'all_dead'  AND sla.dead_since IS NULL)
    OR (c.state = 'has_alive' AND sla.dead_since IS NOT NULL)
    OR (c.state = 'orphan'    AND sla.dead_since IS NOT NULL)
  )
` as const

/**
 * SQL 段 3：检测 + 退役
 * **SQL 真源对照**：apps/api/src/db/queries/auto-retire-line.ts SQL_RETIRE_DEAD_LINES
 *   - 必须 byte-identical / 跨包同步改
 *
 * WAVE4-VALIDATION-FIX-1 P1/P2：段 3 加二次确认「当前仍全 dead」
 *   - 段 1+2 → 段 3 间隙若 probe/render/feedback 写回恢复 status，按旧 dead_since 退役会误退役活跃源
 *   - NOT EXISTS (alive source) 防恢复后误退役 / EXISTS (still has source) 防孤儿误退役
 *   - 两个子查询同样含 COALESCE(vs.source_site_key, v.site_key) source_site_key fallback（P1）
 */
const SQL_RETIRE_DEAD_LINES = `
UPDATE source_line_aliases sla_out
SET retired_at   = NOW(),
    auto_retired = true,
    updated_at   = NOW()
WHERE sla_out.retired_at IS NULL
  AND sla_out.dead_since IS NOT NULL
  AND sla_out.dead_since < NOW() - ($1 || ' days')::INTERVAL
  AND (sla_out.source_site_key, sla_out.source_name) IN (
    SELECT source_site_key, source_name
    FROM source_line_aliases
    WHERE retired_at IS NULL
      AND dead_since IS NOT NULL
      AND dead_since < NOW() - ($1 || ' days')::INTERVAL
    ORDER BY dead_since ASC
    LIMIT $2
  )
  -- WAVE4-VALIDATION-FIX-1 P1/P2：二次确认仍全 dead（防段 1+2 → 段 3 间隙恢复误退役）
  AND NOT EXISTS (
    SELECT 1
    FROM video_sources vs
    LEFT JOIN videos v ON v.id = vs.video_id
    WHERE vs.source_name = sla_out.source_name
      AND vs.is_active   = true
      AND vs.deleted_at  IS NULL
      AND COALESCE(vs.source_site_key, v.site_key) = sla_out.source_site_key
      AND NOT (vs.probe_status = 'dead' AND vs.render_status = 'dead')
  )
  AND EXISTS (
    SELECT 1
    FROM video_sources vs
    LEFT JOIN videos v ON v.id = vs.video_id
    WHERE vs.source_name = sla_out.source_name
      AND vs.is_active   = true
      AND vs.deleted_at  IS NULL
      AND COALESCE(vs.source_site_key, v.site_key) = sla_out.source_site_key
  )
RETURNING sla_out.source_site_key, sla_out.source_name, sla_out.dead_since
` as const

/**
 * runAutoRetireLine — cron job 入口（worker 自包含 / 不依赖 apps/api）
 *
 * 工作流（5 段 / 同 -A 子卡 / R-DEAD-1/2/3/4 全吸收）：
 *   段 -1：pool.connect() 获取专用 PoolClient（防 pool.query 跨 client 导致 unlock 失败 / lock 泄漏）
 *   段 0：client.query pg_try_advisory_lock 非阻塞 / 拿不到锁 return + log info（不调 unlock）
 *   段 1+2：client.query CTE LEFT JOIN (含 vs.deleted_at IS NULL) → UPDATE dead_since 三态守卫
 *   段 3：client.query UPDATE retired_at + auto_retired + RETURNING 行
 *   段 finally：
 *     - unlock 成功 / 未拿锁 → client.release()（正常回 pool）
 *     - unlock 失败 → client.release(err) → pg pool destroy connection（session 终结 → PG 自动释放 lock）
 *     - log per row + log batch_total（R-DEAD-4）
 *
 * 错误处理：
 *   - SQL 抛错 → 直接向上抛 → 由调用方 runWithLogger 既有 try/catch 包（不挂 worker）
 *   - unlock 失败 → log.warn + release(err) destroy connection（防 lock 泄漏到 pool）
 */
export async function runAutoRetireLine(pool: Pool, log: pino.Logger): Promise<void> {
  // 段 -1：pool.connect 拿专用 client（R-DEAD-3 FIX-1：session-level lock 必须同 connection）
  const client: PoolClient = await pool.connect()
  let acquired = false
  let unlockFailed = false
  let retired: readonly RetiredAliasRow[] = []

  try {
    // 段 0：pg_try_advisory_lock 非阻塞获取
    const lockResult = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [ADVISORY_LOCK_KEY],
    )
    acquired = lockResult.rows[0]?.acquired === true
    if (!acquired) {
      log.info(
        { lock_key: ADVISORY_LOCK_KEY },
        'auto-retire-line: another instance holds advisory lock, skipping',
      )
      return
    }

    // 段 1+2：维护 dead_since 状态机
    await client.query(SQL_MAINTAIN_DEAD_SINCE)

    // 段 3：检测 + 退役（RETURNING）
    const result = await client.query<RetiredAliasRow>(SQL_RETIRE_DEAD_LINES, [
      DEAD_THRESHOLD_DAYS,
      RETIRE_BATCH_LIMIT,
    ])
    retired = result.rows
  } finally {
    // R-DEAD-3：仅在拿到锁时调 unlock（防 PG WARNING "you don't own a lock" 噪音）
    if (acquired) {
      try {
        await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [ADVISORY_LOCK_KEY])
      } catch (err) {
        unlockFailed = true
        log.warn(
          { err, lock_key: ADVISORY_LOCK_KEY },
          'auto-retire-line: advisory_unlock failed; destroying connection to force lock release',
        )
      }
    }
    // Codex FIX-2 / -A FIX-2 同源：unlock 失败时 release(err) 让 pool destroy connection（session 终结 → 锁自动释放）
    if (unlockFailed) {
      client.release(
        new Error('auto-retire-line: advisory_unlock failed; connection destroyed to release session-level lock'),
      )
    } else {
      client.release()
    }
  }

  // R-DEAD-4：每条 retire 单独 log.info 结构化 metric（支持审计回溯 / D-164-8 "不写 admin audit" ≠ "不留痕迹"）
  const retiredAt = new Date().toISOString()
  for (const row of retired) {
    log.info(
      {
        metric: 'auto_retire_line.retired',
        value: 1,
        source_site_key: row.source_site_key,
        source_name: row.source_name,
        dead_since: row.dead_since,
        retired_at: retiredAt,
      },
      'auto-retire-line: alias auto-retired',
    )
  }

  // 批次 batch_total log / 运维监控指标
  log.info(
    {
      metric: 'auto_retire_line.batch_total',
      value: retired.length,
    },
    'auto-retire-line: job completed',
  )
}
