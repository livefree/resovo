/**
 * auditLog.ts — admin_audit_log INSERT + read query
 * CHG-SN-4-05: 审计日志写入（fire-and-forget，写失败不阻塞主操作）
 * CHG-SN-4-FIX-C: listAuditLogByTarget — 按 target 查询审计历史（审核台 RightPane.History）
 * CHG-SN-6-01:
 *   - listAdminAuditLog — /admin/audit 全局视图（多维 filter + 分页）
 *   - getAdminAuditLogById — /admin/audit/logs/:id 详情（含 ipHash + 完整 jsonb）
 *   - ADR-118 D-118-4 / D-118-5 / D-118-9 / R-ADR-117-4 idx 拼装风险缓解
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

// ── CHG-SN-6-01: listAdminAuditLog / getAdminAuditLogById ─────────────
//
// ADR-118 D-118-5：listAdminAuditLog 独立函数（不复用 listAuditLogByTarget）
// 理由：参数全可选 + 动态 WHERE/索引选择风格不同；强合并违反单一职责
//
// ADR-118 D-118-4：4 索引覆盖单维 filter；多维交叉 planner 自决
// R-ADR-117-4 idx 拼装风险缓解：参数化数组 push 模式 + idx = params.length 自动得出

export interface ListAdminAuditLogFilters {
  page: number
  limit: number
  actorId?: string
  actionType?: AdminAuditActionType
  targetKind?: AdminAuditTargetKind
  targetId?: string
  requestId?: string
  /** ISO 8601 datetime（with offset） */
  from?: string
  /** ISO 8601 datetime（with offset） */
  to?: string
}

export interface AdminAuditLogDetailRow extends AdminAuditLogQueryRow {
  ipHash: string | null
}

export async function listAdminAuditLog(
  db: Pool,
  filters: ListAdminAuditLogFilters,
): Promise<{ rows: AdminAuditLogQueryRow[]; total: number }> {
  const where: string[] = []
  const params: unknown[] = []

  if (filters.actorId !== undefined) {
    params.push(filters.actorId)
    where.push(`al.actor_id = $${params.length}::uuid`)
  }
  if (filters.actionType !== undefined) {
    params.push(filters.actionType)
    where.push(`al.action_type = $${params.length}`)
  }
  if (filters.targetKind !== undefined) {
    params.push(filters.targetKind)
    where.push(`al.target_kind = $${params.length}`)
  }
  if (filters.targetId !== undefined) {
    params.push(filters.targetId)
    where.push(`al.target_id = $${params.length}::uuid`)
  }
  if (filters.requestId !== undefined) {
    params.push(filters.requestId)
    where.push(`al.request_id = $${params.length}`)
  }
  if (filters.from !== undefined) {
    params.push(filters.from)
    where.push(`al.created_at >= $${params.length}::timestamptz`)
  }
  if (filters.to !== undefined) {
    params.push(filters.to)
    where.push(`al.created_at <= $${params.length}::timestamptz`)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const offset = (filters.page - 1) * filters.limit

  // 列表 + COUNT 并行（共享 params 但 LIMIT/OFFSET 仅列表查询追加）
  params.push(filters.limit)
  const limitIdx = params.length
  params.push(offset)
  const offsetIdx = params.length

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
         ${whereSql}
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
         FROM admin_audit_log al
         ${whereSql}`,
      params.slice(0, params.length - 2), // 去掉 limit + offset
    ),
  ])

  return {
    rows: rowsResult.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function getAdminAuditLogById(
  db: Pool,
  id: string,
): Promise<AdminAuditLogDetailRow | null> {
  const result = await db.query<AdminAuditLogDetailRow>(
    `SELECT al.id::text AS id,
            al.actor_id AS "actorId",
            u.username AS "actorUsername",
            al.action_type AS "actionType",
            al.target_kind AS "targetKind",
            al.target_id AS "targetId",
            al.before_jsonb AS "beforeJsonb",
            al.after_jsonb AS "afterJsonb",
            al.request_id AS "requestId",
            al.ip_hash AS "ipHash",
            al.created_at AS "createdAt"
       FROM admin_audit_log al
       LEFT JOIN users u ON u.id = al.actor_id
      WHERE al.id = $1::bigint
      LIMIT 1`,
    [id],
  )
  return result.rows[0] ?? null
}
