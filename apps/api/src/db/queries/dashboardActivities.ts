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
