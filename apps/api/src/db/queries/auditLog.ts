/**
 * auditLog.ts — admin_audit_log INSERT + read query
 * CHG-SN-4-05: 审计日志写入（fire-and-forget，写失败不阻塞主操作）
 * CHG-SN-4-FIX-C: listAuditLogByTarget — 按 target 查询审计历史（审核台 RightPane.History）
 */

import type { Pool } from 'pg'
import type { AdminAuditActionType, AdminAuditTargetKind } from '@resovo/types'

export interface WriteAuditLogInput {
  actorId: string
  actionType: AdminAuditActionType
  targetKind: AdminAuditTargetKind
  targetId?: string | null
  beforeJsonb?: Record<string, unknown> | null
  afterJsonb?: Record<string, unknown> | null
  requestId?: string | null
  ipHash?: string | null
}

export async function insertAuditLog(db: Pool, input: WriteAuditLogInput): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit_log
       (actor_id, action_type, target_kind, target_id, before_jsonb, after_jsonb, request_id, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.actorId,
      input.actionType,
      input.targetKind,
      input.targetId ?? null,
      input.beforeJsonb ? JSON.stringify(input.beforeJsonb) : null,
      input.afterJsonb ? JSON.stringify(input.afterJsonb) : null,
      input.requestId ?? null,
      input.ipHash ?? null,
    ],
  )
}

// ── CHG-SN-4-FIX-C: listAuditLogByTarget ────────────────────────────────
//
// 按 (target_kind, target_id) 查询审计日志（审核台 RightPane.History 时间线）。
// 字段全部 camelCase（教训自 CHG-SN-4-09d）：PG 双引号 alias 保留大小写。
// JOIN users 取 actor username（左连，actor 删除场景下保留 audit 行）。
export interface AdminAuditLogQueryRow {
  id: string  // bigserial → string（避免 JS 大数精度）
  actorId: string
  actorUsername: string | null
  actionType: AdminAuditActionType
  targetKind: AdminAuditTargetKind
  targetId: string | null
  beforeJsonb: Record<string, unknown> | null
  afterJsonb: Record<string, unknown> | null
  requestId: string | null
  createdAt: string
}

export interface ListAuditLogByTargetFilters {
  targetKind: AdminAuditTargetKind
  targetId: string
  page: number
  limit: number
}

export async function listAuditLogByTarget(
  db: Pool,
  filters: ListAuditLogByTargetFilters,
): Promise<{ rows: AdminAuditLogQueryRow[]; total: number }> {
  const offset = (filters.page - 1) * filters.limit

  const [rowsResult, countResult] = await Promise.all([
    db.query<AdminAuditLogQueryRow>(
      `SELECT al.id::text AS id,
              al.actor_id AS "actorId",
              u.username AS "actorUsername",
              al.action_type AS "actionType",
              al.target_kind AS "targetKind",
              al.target_id AS "targetId",
              al.before_jsonb AS "beforeJsonb",
              al.after_jsonb AS "afterJsonb",
              al.request_id AS "requestId",
              al.created_at AS "createdAt"
         FROM admin_audit_log al
         LEFT JOIN users u ON u.id = al.actor_id
        WHERE al.target_kind = $1
          AND al.target_id = $2
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $3 OFFSET $4`,
      [filters.targetKind, filters.targetId, filters.limit, offset],
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
         FROM admin_audit_log
        WHERE target_kind = $1
          AND target_id = $2`,
      [filters.targetKind, filters.targetId],
    ),
  ])

  return {
    rows: rowsResult.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}
