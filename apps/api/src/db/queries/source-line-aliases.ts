/**
 * source-line-aliases.ts — /admin/source-line-aliases 别名 CRUD 查询
 * （ADR-117 / ADR-164 / CHG-VSR-3 拆分自 sources-matrix.ts，D-117-VSR3-7）
 *
 * 关注点：source_line_aliases 表的别名读写（含 codename / priority / retired_at）
 * + 全线路视图（video_sources FULL OUTER JOIN source_line_aliases）。
 * 业务逻辑（audit / 冷却期判定）归口 SourcesMatrixService，本文件仅 DB 查询。
 */

import type { Pool } from 'pg'
import type { SourceLineAlias, SourceLineRow, UpsertAliasInput } from '@resovo/types'

// re-export 共享类型，保持向后兼容（apps/api 内部消费方）
export type { SourceLineAlias, SourceLineRow }

interface DbAliasRow {
  source_site_key: string
  source_name: string
  display_name: string
  // Migration 079 / ADR-164 D-164-2..D-164-8 新增 4 列
  codename: string | null
  priority: number
  retired_at: string | null
  auto_retired: boolean
  updated_at: string
}

/** ADR-164 D-164-12 / CHG-368-B-A1：DbAliasRow → SourceLineAlias 映射 helper（复用 4 SELECT 路径）*/
function mapAliasRow(r: DbAliasRow): SourceLineAlias {
  return {
    sourceSiteKey: r.source_site_key,
    sourceName: r.source_name,
    displayName: r.display_name,
    codename: r.codename,
    priority: r.priority,
    retiredAt: r.retired_at,
    autoRetired: r.auto_retired,
    updatedAt: r.updated_at,
  }
}

// ── 查询：全局别名列表 ────────────────────────────────────────────

export async function listLineAliases(db: Pool): Promise<SourceLineAlias[]> {
  const result = await db.query<DbAliasRow>(
    `SELECT source_site_key, source_name, display_name,
            codename, priority, retired_at, auto_retired,
            updated_at
     FROM source_line_aliases
     ORDER BY source_site_key, source_name`,
  )
  return result.rows.map(mapAliasRow)
}

// ── 查询：全线路视图（CHG-SN-9-LINES-VIEW-UNIFY + FIX-3）─────────
// FULL OUTER JOIN 范式（FIX-3 / Codex stop-time review 3rd）：
//   - 左侧：video_sources 聚合 subquery → 拿到 (site_key, source_name, video_count, active_count, episode_count)
//   - 右侧：source_line_aliases → 别名 4 字段 + assignedAt
//   - FULL OUTER JOIN → 包含两边并集 / 不丢任何一侧的孤儿行
//
// **修复的 bug（FIX-3）**：原 `FROM video_sources LEFT JOIN sla` 写法会丢失 **alias-only 孤儿行**：
//   - 例：sla 表有 codename='泰山-2' 退役行（retired_at NOT NULL / 90 天冷却期内）
//   - 但对应 video_sources 全被软删 / 或站点废弃后 vs 行被清理
//   - 管理 UI 应仍显示该行让运维监控冷却期 + 防 codename 提前复用
//
// 三类 row 分布：
//   - **unassigned-only**：vs 有 + sla 无 → assignedAt=null + videoCount > 0
//   - **alias-only 孤儿**：vs 无 + sla 有 → assignedAt 非 null + videoCount=0（FIX-3 新覆盖）
//   - **正常**：vs 有 + sla 有 → assignedAt 非 null + videoCount > 0
//
// 索引设计 4 步核验（db-rules.md §"索引设计 4 步核验"）：
//   1. 索引键：source_line_aliases (source_site_key, source_name) 复合 PK
//   2. 部分索引 WHERE：N/A
//   3. 候选 driving 谓词：FULL OUTER JOIN ON 复合
//   4. 匹配判定：driving = 索引键 ✅（实测留 EXPLAIN ANALYZE）

export async function listAllSourceLines(db: Pool): Promise<SourceLineRow[]> {
  const result = await db.query<{
    source_site_key: string
    source_name: string
    display_name: string | null
    codename: string | null
    priority: number | null
    retired_at: string | null
    auto_retired: boolean | null
    sla_updated_at: string | null
    video_count: string
    active_count: string
    episode_count: string
  }>(
    `SELECT
       COALESCE(vs_agg.source_site_key, sla.source_site_key) AS source_site_key,
       COALESCE(vs_agg.source_name, sla.source_name) AS source_name,
       sla.display_name,
       sla.codename,
       sla.priority,
       sla.retired_at,
       sla.auto_retired,
       sla.updated_at AS sla_updated_at,
       COALESCE(vs_agg.video_count, '0') AS video_count,
       COALESCE(vs_agg.active_count, '0') AS active_count,
       COALESCE(vs_agg.episode_count, '0') AS episode_count
     FROM (
       SELECT
         source_site_key,
         source_name,
         COUNT(DISTINCT video_id)::TEXT AS video_count,
         COUNT(*) FILTER (WHERE is_active = true)::TEXT AS active_count,
         COUNT(*)::TEXT AS episode_count
       FROM video_sources
       WHERE deleted_at IS NULL
         AND source_site_key IS NOT NULL
       GROUP BY source_site_key, source_name
     ) vs_agg
     FULL OUTER JOIN source_line_aliases sla
       ON vs_agg.source_site_key = sla.source_site_key
      AND vs_agg.source_name = sla.source_name
     ORDER BY 1, 2`,
  )

  return result.rows.map((r) => ({
    sourceSiteKey: r.source_site_key,
    sourceName: r.source_name,
    // 未分配 alias 时 fallback 到 source_name；alias-only 孤儿行 sla.display_name 必非空
    displayName: r.display_name ?? r.source_name,
    codename: r.codename,
    priority: r.priority ?? 0,
    retiredAt: r.retired_at,
    autoRetired: r.auto_retired ?? false,
    assignedAt: r.sla_updated_at,
    videoCount: parseInt(r.video_count, 10),
    activeCount: parseInt(r.active_count, 10),
    episodeCount: parseInt(r.episode_count, 10),
  }))
}

// ── 查询：单条别名（Service 层 audit before 状态）────────────────────

export async function findLineAlias(
  db: Pool,
  sourceSiteKey: string,
  sourceName: string,
): Promise<SourceLineAlias | null> {
  const result = await db.query<DbAliasRow>(
    `SELECT source_site_key, source_name, display_name,
            codename, priority, retired_at, auto_retired,
            updated_at
     FROM source_line_aliases
     WHERE source_site_key = $1 AND source_name = $2`,
    [sourceSiteKey, sourceName],
  )
  const r = result.rows[0]
  if (!r) return null
  return mapAliasRow(r)
}

// ── 写操作：upsert 别名（既有签名 / 后兼容 wrapper）───────────────

export async function upsertLineAlias(
  db: Pool,
  sourceSiteKey: string,
  sourceName: string,
  displayName: string,
  updatedBy: string,
): Promise<SourceLineAlias> {
  return upsertLineAliasFull(db, sourceSiteKey, sourceName, { displayName }, updatedBy)
}

/**
 * CHG-368-B-A2a / ADR-164 §5.7：扩 upsert 接 codename + priority 可选字段。
 *   INSERT 路径：codename / priority 取 input 值（priority 缺省走 DB DEFAULT 0）
 *   UPDATE 路径：仅当 input 字段非 undefined 时覆盖（避免误清空既有值）
 *   既有 retired_at + auto_retired 不在 upsert 路径修改（→ retireLineAlias 专用端点）
 */
export async function upsertLineAliasFull(
  db: Pool,
  sourceSiteKey: string,
  sourceName: string,
  input: UpsertAliasInput,
  updatedBy: string,
): Promise<SourceLineAlias> {
  const codenameProvided = input.codename !== undefined
  const priorityProvided = input.priority !== undefined

  const result = await db.query<DbAliasRow>(
    `INSERT INTO source_line_aliases
       (source_site_key, source_name, display_name, codename, priority, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::SMALLINT, 0), $6, NOW())
     ON CONFLICT (source_site_key, source_name)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       codename     = CASE WHEN $7::BOOLEAN THEN EXCLUDED.codename ELSE source_line_aliases.codename END,
       priority     = CASE WHEN $8::BOOLEAN THEN EXCLUDED.priority ELSE source_line_aliases.priority END,
       updated_by   = EXCLUDED.updated_by,
       updated_at   = NOW()
     RETURNING source_site_key, source_name, display_name,
               codename, priority, retired_at, auto_retired,
               updated_at`,
    [
      sourceSiteKey, sourceName, input.displayName,
      codenameProvided ? input.codename : null,
      priorityProvided ? input.priority : null,
      updatedBy,
      codenameProvided,
      priorityProvided,
    ],
  )
  const r = result.rows[0]
  if (!r) {
    throw new Error('upsertLineAliasFull: RETURNING 0 rows (unexpected)')
  }
  return mapAliasRow(r)
}

/**
 * CHG-368-B-A2a / ADR-164 §5.7：手动退役别名。
 *   UPDATE retired_at = NOW(), auto_retired = false / WHERE 守卫：行存在 AND retired_at IS NULL
 *   返回 rowCount > 0 表示退役成功 / 否则调用方根据 before fetch 区分 404 vs 409
 *   不影响 codename 字段（保留追溯 / 冷却期满后由新 upsert 复用）
 */
export async function retireLineAlias(
  db: Pool,
  sourceSiteKey: string,
  sourceName: string,
): Promise<SourceLineAlias | null> {
  const result = await db.query<DbAliasRow>(
    `UPDATE source_line_aliases
       SET retired_at   = NOW(),
           auto_retired = false,
           updated_at   = NOW()
     WHERE source_site_key = $1
       AND source_name     = $2
       AND retired_at IS NULL
     RETURNING source_site_key, source_name, display_name,
               codename, priority, retired_at, auto_retired,
               updated_at`,
    [sourceSiteKey, sourceName],
  )
  const r = result.rows[0]
  return r ? mapAliasRow(r) : null
}

/**
 * CHG-368-B-A2a / ADR-164 §5.7：单字段更新 priority（高频运营操作）。
 *   priority 范围 0-100 由 DB CHECK 强制（违反抛 23514）
 *   WHERE 守卫：行存在（rowCount=0 → 调用方抛 NOT_FOUND）
 *   不要求 retired_at IS NULL（已退役行也允许调 priority / 数据完整性 / Service 层可加业务规则限制）
 */
export async function updateLineAliasPriority(
  db: Pool,
  sourceSiteKey: string,
  sourceName: string,
  priority: number,
): Promise<SourceLineAlias | null> {
  const result = await db.query<DbAliasRow>(
    `UPDATE source_line_aliases
       SET priority   = $3::SMALLINT,
           updated_at = NOW()
     WHERE source_site_key = $1
       AND source_name     = $2
     RETURNING source_site_key, source_name, display_name,
               codename, priority, retired_at, auto_retired,
               updated_at`,
    [sourceSiteKey, sourceName, priority],
  )
  const r = result.rows[0]
  return r ? mapAliasRow(r) : null
}

/**
 * CHG-368-B-A2a / ADR-164 D-164-10 + D-164-11：查所有 codename 非 NULL 行（含已退役）。
 *   用途：① GET codename-pool occupied / cooling 分段判定 ② isCodenameInCooling 应用层判定
 *   返回 codename + retired_at 两列（其他字段不需要 / 减少 IO）
 *
 *   access path 评估（按"索引设计 4 步核验"）：
 *     - 索引键：idx_codename_active = codename / 部分 WHERE = codename IS NOT NULL AND retired_at IS NULL
 *     - 查询 driving 谓词：codename IS NOT NULL（含已退役 / retired_at 不约束）
 *     - 匹配性：本查询 driving 谓词只匹配 `idx_codename_active` 的 codename 列 + WHERE 子句**部分覆盖**（在役行覆盖 / 已退役行不在索引中）
 *     - 结论：在役行可走索引 / 已退役行需补全表扫 → 规划器实际选择视数据 selectivity（可能直接表扫一遍简单）。留 EXPLAIN ANALYZE 实测。
 *     - 不在 hot path（codename-pool 端点低频）/ 即使全表扫成本可接受
 */
export async function findCodenameAssignments(
  db: Pool,
): Promise<readonly { codename: string; retiredAt: string | null }[]> {
  const result = await db.query<{ codename: string; retired_at: string | null }>(
    `SELECT codename, retired_at
       FROM source_line_aliases
      WHERE codename IS NOT NULL`,
  )
  return result.rows.map((r) => ({ codename: r.codename, retiredAt: r.retired_at }))
}
