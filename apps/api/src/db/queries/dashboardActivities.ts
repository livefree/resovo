/**
 * dashboardActivities.ts — dashboard activities 端点 Query
 * ADR-141 / CHG-SN-8-FUP-DASH-ACTIVITY-LIVE
 *
 * 从 admin_audit_log 派生最近 N 条 admin 操作活动时序。
 * 索引利用：idx_admin_audit_log_created (created_at DESC) Index Scan (Backward)
 * → 扫描恰 N 行后停止 + LEFT JOIN users PK Nested Loop。
 *
 * 与 listAdminAuditLog 关系：独立函数（ADR-118 D-118-5 原则 — 参数结构 +
 * SELECT 字段完全不同，不强合并）。
 */

import type { Pool } from 'pg'
import type { DashboardActivityRow } from '@resovo/types'

export async function listDashboardActivities(
  db: Pool,
  limit: number,
): Promise<readonly DashboardActivityRow[]> {
  // ADR-141 §5 SQL 设计：纯字段子集 SELECT + LEFT JOIN users + 时间倒序 + 主键稳定排序
  const result = await db.query<DashboardActivityRow>(
    `SELECT al.id::text AS id,
            al.actor_id AS "actorId",
            u.username AS "actorUsername",
            al.action_type AS "actionType",
            al.target_kind AS "targetKind",
            al.target_id AS "targetId",
            al.created_at AS "createdAt"
       FROM admin_audit_log al
       LEFT JOIN users u ON u.id = al.actor_id
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT $1`,
    [limit],
  )
  return result.rows
}

// ── ADR-141 N1-141-1 / CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME ─────

/**
 * 主要 target_kind → 业务表 + display 字段映射（仅覆盖 4 个高频 target_kind）
 * 其它 target_kind（staging/video_source/source_line_alias/user_submission/review_label/system/image_health 等）
 * 返回 null 让前端 fallback 到 short targetId。
 */
interface TargetDisplayMeta {
  readonly tableName: string
  readonly idColumn: string
  readonly displayColumn: string
}

const TARGET_DISPLAY_MAP: Readonly<Record<string, TargetDisplayMeta | undefined>> = {
  video:        { tableName: 'videos',         idColumn: 'id',  displayColumn: 'title' },
  user:         { tableName: 'users',          idColumn: 'id',  displayColumn: 'username' },
  crawler_site: { tableName: 'crawler_sites',  idColumn: 'key', displayColumn: 'name' },
  // home_module 无 title 列；使用 slot:content_ref_type 组合（按 ADR-141 N1-141-1 简化版）
  home_module:  { tableName: 'home_modules',   idColumn: 'id',  displayColumn: 'slot' },
}

/**
 * 按 target_kind 分组批量查 display name，enrich activity rows 加 targetDisplayName 字段。
 *
 * 分组 IN 查询避免 N+1：每个 target_kind 最多 1 次 SQL（共最多 4 次 SQL；每次 limit 行≤50）。
 *
 * 失败处置：单组查询失败不阻塞其它组；未匹配的 targetId 不写 targetDisplayName（保持 undefined）。
 */
export async function enrichTargetDisplayNames(
  db: Pool,
  rows: readonly DashboardActivityRow[],
): Promise<readonly DashboardActivityRow[]> {
  if (rows.length === 0) return rows

  // 按 target_kind 分组 targetId（去重 + 过滤 null）
  const idsByKind = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.targetId) continue
    const meta = TARGET_DISPLAY_MAP[r.targetKind]
    if (!meta) continue
    const set = idsByKind.get(r.targetKind) ?? new Set<string>()
    set.add(r.targetId)
    idsByKind.set(r.targetKind, set)
  }
  if (idsByKind.size === 0) return rows

  // 并行查每个 target_kind 的 display name 映射
  const displayByKindId = new Map<string, Map<string, string>>()  // kind → (id → displayName)

  await Promise.all(
    Array.from(idsByKind.entries()).map(async ([kind, ids]) => {
      const meta = TARGET_DISPLAY_MAP[kind]!
      try {
        const sql =
          `SELECT "${meta.idColumn}" AS id, "${meta.displayColumn}" AS display_name ` +
          `FROM "${meta.tableName}" WHERE "${meta.idColumn}" = ANY($1)`
        const result = await db.query<{ id: string; display_name: string | null }>(sql, [Array.from(ids)])
        const idMap = new Map<string, string>()
        for (const row of result.rows) {
          if (row.display_name) idMap.set(String(row.id), row.display_name)
        }
        displayByKindId.set(kind, idMap)
      } catch {
        // 单组查询失败不阻塞其它组（如 schema 漂移 / 表不存在），跳过 enrich
      }
    }),
  )

  return rows.map((r) => {
    if (!r.targetId) return r
    const kindMap = displayByKindId.get(r.targetKind)
    const displayName = kindMap?.get(r.targetId)
    if (!displayName) return r
    return { ...r, targetDisplayName: displayName }
  })
}
