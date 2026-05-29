/**
 * auto-retire-line.ts — apps/worker auto-retire-line job 的 DB 层查询
 *
 * CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A / Wave 4 #5-A / SEQ-20260528-MOD-WAVE4
 *
 * 设计真源：
 *   - ADR-164 D-164-8：worker 走独立 DB query 函数（不暴露端点 / 不写 admin audit / 写 worker 日志）
 *   - arch-reviewer (claude-opus-4-7) Opus 评审 A- CONDITIONAL / 推荐方案 D'（dead_since 加 alias 表）
 *   - Migration 081：source_line_aliases.dead_since TIMESTAMPTZ NULL + 部分索引
 *
 * 三段式工作流（详 jsdoc on autoRetireLineByDeadCheck）：
 *   段 0：advisory lock 非阻塞获取（R-DEAD-3 / 拿不到锁直接 return / 不阻塞 DB 连接池）
 *   段 1+2：CTE 识别"当前全 dead"集 + 段 2 维护 dead_since 上升沿/下降沿/孤儿
 *   段 3：检测 dead_since < NOW() - 180 days + batch limit + ORDER BY dead_since ASC → UPDATE retired_at, auto_retired
 *
 * 红线吸收：
 *   - R-DEAD-1：段 2/段 3 拆两条独立 SQL 语句（NOW() 同事务等值风险规避）
 *   - R-DEAD-2：CTE LEFT JOIN + 'orphan' 状态显式清 NULL + WHERE vs.deleted_at IS NULL（孤儿 alias 处理 + 软删过滤 / Codex stop-time review FIX-1）
 *   - R-DEAD-3：pg_try_advisory_lock 非阻塞 + finally unlock + **pool.connect() 同 client** 保证 lock/unlock 同 session（Codex stop-time review FIX-1 / session-level lock 必须同 connection / 不能用 pool.query() 因为可能拿到不同 client 导致 unlock 在错误 connection 失败 / lock 永久泄漏）
 *   - R-DEAD-4：RETURNING 段 3 退役清单 + 调用方结构化日志（worker job 文件 -B 子卡承接）
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
 * 自动退役结果行（RETURNING + 调用方结构化日志输入）
 */
export interface RetiredAliasRow {
  readonly source_site_key: string
  readonly source_name: string
  readonly dead_since: string
}

/**
 * autoRetireLineByDeadCheck — 全 dead 持续 180 天检测 + 自动退役
 *
 * 工作流（5 段 / R-DEAD-1 段 2 段 3 必须独立语句 / R-DEAD-3 全部段在同一 PoolClient）：
 *   段 -1：pool.connect() 获取专用 client（Codex FIX-1 / 防 pool.query() 跨 client 导致 unlock 失败）
 *   段 0：client.query pg_try_advisory_lock(hashtext($1)) 非阻塞获取 → 拿不到锁 → return [] + log info
 *   段 1+2（client.query 单 SQL 内 CTE → UPDATE）：
 *     - alias_dead_status：LEFT JOIN video_sources（WHERE vs.deleted_at IS NULL + vs.is_active = true）
 *       计算每条在役 alias 的 source_count + dead_count（Codex FIX-1 deleted_at 过滤）
 *     - classified：CASE WHEN source_count=0 → 'orphan' / dead_count=source_count → 'all_dead' / 'has_alive'
 *     - UPDATE dead_since：
 *       上升沿 'all_dead' AND dead_since IS NULL → SET NOW()
 *       下降沿 'has_alive' → SET NULL
 *       孤儿  'orphan' AND dead_since IS NOT NULL → SET NULL（R-DEAD-2 显式清）
 *       否则保持
 *   段 3（独立 client.query SQL）：UPDATE source_line_aliases SET retired_at, auto_retired
 *     WHERE retired_at IS NULL AND dead_since < NOW() - 180 days
 *     + 子查询 ORDER BY dead_since ASC LIMIT 50
 *     RETURNING 退役清单
 *   段 finally：client.query pg_advisory_unlock + client.release()
 *
 * @returns 本次 run 退役的 alias 清单（可能为空数组）
 */
export async function autoRetireLineByDeadCheck(
  pool: Pool,
  log: pino.Logger,
): Promise<RetiredAliasRow[]> {
  // 段 -1：从 pool 获取专用 PoolClient（R-DEAD-3 FIX-1 关键）
  // session-level pg_advisory_lock 要求 lock 与 unlock 在同一 connection
  // 若用 pool.query() 每次调用拿到不同 client → unlock 在错误 connection 上执行（静默成功 / 实际 lock 仍在原 client 上 / 下次 worker run 永久拿不到锁）
  const client: PoolClient = await pool.connect()
  let acquired = false
  try {
    // 段 0：advisory lock 非阻塞获取（R-DEAD-3）
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
      return []
    }

    // 段 1+2：维护 dead_since 状态机（R-DEAD-2 LEFT JOIN + deleted_at + 'orphan' 显式清）
    await client.query(SQL_MAINTAIN_DEAD_SINCE)

    // 段 3：检测 + 退役（R-DEAD-4 RETURNING + ORDER BY dead_since ASC LIMIT 50）
    const result = await client.query<RetiredAliasRow>(SQL_RETIRE_DEAD_LINES, [
      DEAD_THRESHOLD_DAYS,
      RETIRE_BATCH_LIMIT,
    ])
    return result.rows
  } finally {
    // R-DEAD-3：仅在拿到锁时调 unlock（拿不到锁就 unlock 是无意义且产生 PG NOTICE 噪音）
    if (acquired) {
      try {
        await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [ADVISORY_LOCK_KEY])
      } catch (err) {
        // unlock 失败极罕见（连接已断 / connection reset）→ 不抛错 / 不阻塞 release / 锁会随 connection 关闭自动释放
        log.warn({ err, lock_key: ADVISORY_LOCK_KEY }, 'auto-retire-line: advisory_unlock failed (lock will auto-release on connection close)')
      }
    }
    // 始终 release client（防 PoolClient 泄漏）
    client.release()
  }
}

/**
 * SQL 段 1+2：维护 dead_since 状态机
 *
 * CTE 链：
 *   alias_dead_status：LEFT JOIN video_sources（仅 is_active=true AND deleted_at IS NULL）
 *     → 每条在役 alias 的 source_count + dead_count
 *     **Codex stop-time review FIX-1**：必须含 vs.deleted_at IS NULL 守卫
 *       否则软删除 source（deleted_at NOT NULL / 业务已弃用）仍参与 source_count + dead_count
 *       计算 → 错误判定 'all_dead' / 'has_alive' / 'orphan' 状态
 *       例：alias 实际只有 1 个活跃 source（dead），但有 5 个软删的非 dead source
 *           → 无 deleted_at 守卫 → dead_count(1) != source_count(6) → 误判 has_alive → dead_since 清 NULL
 *   classified：CASE 分类 'orphan' / 'all_dead' / 'has_alive'
 *
 * UPDATE：
 *   上升沿 all_dead + dead_since IS NULL → NOW()
 *   下降沿 has_alive → NULL（重置观察期）
 *   孤儿（无 source）+ dead_since IS NOT NULL → NULL（R-DEAD-2 / 防 source 被删后 dead_since 卡死）
 *   否则保持原值（无写）
 */
const SQL_MAINTAIN_DEAD_SINCE = `
WITH alias_dead_status AS (
  SELECT
    sla.source_site_key,
    sla.source_name,
    sla.dead_since AS prev_dead_since,
    COUNT(vs.id)                                                AS source_count,
    COUNT(*) FILTER (
      WHERE vs.probe_status = 'dead' AND vs.render_status = 'dead'
    )                                                            AS dead_count
  FROM source_line_aliases sla
  LEFT JOIN video_sources vs
    ON vs.source_site_key = sla.source_site_key
   AND vs.source_name     = sla.source_name
   AND vs.is_active       = true
   AND vs.deleted_at      IS NULL
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
 *
 * 子查询 ORDER BY dead_since ASC LIMIT $2 优先退役最老 alias / 防雪崩 / 利用部分索引 idx_source_line_aliases_dead_since
 * 外层 UPDATE 用 (source_site_key, source_name) IN (...) 元组语法 / PostgreSQL 原生
 * RETURNING 行供 worker 调用方结构化日志（R-DEAD-4）
 */
const SQL_RETIRE_DEAD_LINES = `
UPDATE source_line_aliases
SET retired_at   = NOW(),
    auto_retired = true,
    updated_at   = NOW()
WHERE retired_at IS NULL
  AND dead_since IS NOT NULL
  AND dead_since < NOW() - ($1 || ' days')::INTERVAL
  AND (source_site_key, source_name) IN (
    SELECT source_site_key, source_name
    FROM source_line_aliases
    WHERE retired_at IS NULL
      AND dead_since IS NOT NULL
      AND dead_since < NOW() - ($1 || ' days')::INTERVAL
    ORDER BY dead_since ASC
    LIMIT $2
  )
RETURNING source_site_key, source_name, dead_since
` as const
