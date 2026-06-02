/**
 * source-routes.ts — /admin/sources/routes/by-site 单站点线路明细 + 行级 3 mutations
 * （ADR-117 AMENDMENT / AMENDMENT 2 / CHG-VSR-3 拆分自 sources-matrix.ts，D-117-VSR3-7）
 *
 * 关注点：按 siteKey 聚合 video_sources 的线路明细视图 + test/reprobe/delete 支撑查询。
 * 业务规则归口 SourcesMatrixService（aggregateSignal / freeze 守卫 / audit）。
 */

import type { Pool } from 'pg'
import type { SourceRouteBySite } from '@resovo/types'

// re-export 共享类型，保持向后兼容（apps/api 内部消费方）
export type { SourceRouteBySite }

// ── 查询：按 siteKey 聚合线路明细（ADR-117 AMENDMENT 2026-05-19）─────

/**
 * DB 中间形态：probe/render statuses 是 STRING_AGG 拼接的逗号分隔字符串
 * （DISTINCT 已在 SQL 层去重）；Service 层 split + 调用 aggregateSignal 派生 worst。
 */
export interface SourceRouteBySiteRaw extends Omit<SourceRouteBySite, 'probeStatus' | 'renderStatus'> {
  readonly probeStatuses: readonly string[]
  readonly renderStatuses: readonly string[]
}

interface DbRouteBySiteRow {
  source_site_key: string
  source_name: string
  display_name: string | null
  probe_statuses: string | null
  render_statuses: string | null
  avg_latency_ms: string | null
  source_count: string
  active_count: string
  last_probed_at: string | null
}

/**
 * 按 siteKey 聚合 video_sources 行 → 单站点线路明细列表
 * （ADR-117 AMENDMENT 2026-05-19 / CHG-SN-7-REDO-01-E）。
 *
 * 业务规则归口 Service 层：
 *   - SQL 仅 STRING_AGG DISTINCT 拼 raw 状态；Service split + aggregateSignal 派生 worst
 *   - latency 选 AVG 不选 p95（Y2 评估 / 单站点 < 200 线路 / PG percentile_disc 性能受限）
 *   - 软删除过滤 vs.deleted_at IS NULL（与 row 3 getVideoMatrix 一致）
 *   - COALESCE(vs.source_site_key, v.site_key) fallback（migration 046 NULLABLE）
 */
export async function listRoutesBySite(
  db: Pool,
  siteKey: string,
): Promise<readonly SourceRouteBySiteRaw[]> {
  const result = await db.query<DbRouteBySiteRow>(
    `SELECT
       COALESCE(vs.source_site_key, v.site_key)     AS source_site_key,
       vs.source_name                                AS source_name,
       sla.display_name                              AS display_name,
       STRING_AGG(DISTINCT vs.probe_status, ',')     AS probe_statuses,
       STRING_AGG(DISTINCT vs.render_status, ',')    AS render_statuses,
       AVG(vs.latency_ms) FILTER (WHERE vs.latency_ms IS NOT NULL) AS avg_latency_ms,
       COUNT(*)                                      AS source_count,
       COUNT(*) FILTER (WHERE vs.is_active = true)   AS active_count,
       MAX(vs.last_probed_at)                        AS last_probed_at
     FROM video_sources vs
     JOIN videos v ON v.id = vs.video_id
     LEFT JOIN source_line_aliases sla
       ON sla.source_site_key = COALESCE(vs.source_site_key, v.site_key)
      AND sla.source_name     = vs.source_name
     WHERE COALESCE(vs.source_site_key, v.site_key) = $1
       AND vs.deleted_at IS NULL
     GROUP BY COALESCE(vs.source_site_key, v.site_key), vs.source_name, sla.display_name
     ORDER BY vs.source_name ASC`,
    [siteKey],
  )

  return result.rows.map((r): SourceRouteBySiteRaw => ({
    sourceSiteKey: r.source_site_key,
    sourceName: r.source_name,
    displayName: r.display_name,
    probeStatuses: r.probe_statuses ? r.probe_statuses.split(',') : [],
    renderStatuses: r.render_statuses ? r.render_statuses.split(',') : [],
    avgLatencyMs: r.avg_latency_ms != null ? Math.round(Number(r.avg_latency_ms)) : null,
    sourceCount: Number(r.source_count),
    activeCount: Number(r.active_count),
    lastProbedAt: r.last_probed_at,
  }))
}

// ── ADR-117 AMENDMENT 2 2026-05-19 / CHG-SN-7-REDO-01-E2 ──────────
// 行级 3 mutations 支撑 queries（test 样本 / 软删除）

/**
 * 取 (siteKey, sourceName) 线路下的代表性样本（episode 最小、is_active、未删除的一行 source_url + videoId）
 * 用于 row 7 POST test 端点同步快探。
 */
export async function selectRouteSampleSource(
  db: Pool,
  siteKey: string,
  sourceName: string,
): Promise<{ readonly videoId: string; readonly sourceUrl: string } | null> {
  const result = await db.query<{ video_id: string; source_url: string }>(
    `SELECT vs.video_id, vs.source_url
       FROM video_sources vs
       JOIN videos v ON v.id = vs.video_id
      WHERE COALESCE(vs.source_site_key, v.site_key) = $1
        AND vs.source_name = $2
        AND vs.deleted_at IS NULL
        AND vs.is_active = true
      ORDER BY vs.episode_number ASC NULLS LAST
      LIMIT 1`,
    [siteKey, sourceName],
  )
  if (result.rows.length === 0) return null
  return { videoId: result.rows[0].video_id, sourceUrl: result.rows[0].source_url }
}

/**
 * 统计 (siteKey, sourceName) 线路下未删除 video_sources 行数（用于 reprobe queuedCount + 404 判定）
 */
export async function countRouteSources(
  db: Pool,
  siteKey: string,
  sourceName: string,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM video_sources vs
       JOIN videos v ON v.id = vs.video_id
      WHERE COALESCE(vs.source_site_key, v.site_key) = $1
        AND vs.source_name = $2
        AND vs.deleted_at IS NULL`,
    [siteKey, sourceName],
  )
  return Number(result.rows[0]?.count ?? 0)
}

/**
 * 软删除 (siteKey, sourceName) 线路下所有未删除的 video_sources 行；
 * 返回被删行的 id 列表（供 audit beforeJsonb 引用）。
 * ADR-105 软删除范式（deleted_at = NOW()）+ ADR-117 AMENDMENT 2 §SQL 设计。
 */
export async function softDeleteRouteBySite(
  db: Pool,
  siteKey: string,
  sourceName: string,
): Promise<readonly string[]> {
  const result = await db.query<{ id: string }>(
    `UPDATE video_sources vs
        SET deleted_at = NOW(), updated_at = NOW()
       FROM videos v
      WHERE vs.video_id = v.id
        AND COALESCE(vs.source_site_key, v.site_key) = $1
        AND vs.source_name = $2
        AND vs.deleted_at IS NULL
      RETURNING vs.id`,
    [siteKey, sourceName],
  )
  return result.rows.map((r) => r.id)
}
