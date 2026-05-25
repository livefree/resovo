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
  // sub 2 EXTEND（2026-05-24）：sort 字段白名单 + 方向
  sortField?: 'createdAt'
  sortDirection?: 'asc' | 'desc'
}

// sub 2 EXTEND：sort 字段白名单（防 SQL 注入 / 与 distinct-whitelist 同范式）
const AUDIT_LOG_SORT_FIELD_MAP: Record<string, string> = {
  createdAt: 'al.created_at',
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

  // sub 2 EXTEND：sort 字段白名单 lookup + 方向 / fallback 默认 al.created_at DESC, al.id DESC
  const sortCol = (filters.sortField && AUDIT_LOG_SORT_FIELD_MAP[filters.sortField]) ?? 'al.created_at'
  const sortDir = filters.sortDirection === 'asc' ? 'ASC' : 'DESC'

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
        ORDER BY ${sortCol} ${sortDir}, al.id DESC
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

// ── ADR-138 / CHG-SN-8-FUP-AUDIT-ROLLBACK-EP ─────────────────────────────
//
// 通用 JSONB 反向 UPDATE + stale 检测。
//
// SQL 注入防护（ADR-138 §10 R-138-3）：
//   - tableName / primaryKeyColumn / softDeleteColumn / fieldNames 全部从编译时
//     白名单（AuditRollbackService TARGET_KIND_TABLE_MAP + FIELD_WHITELIST）取
//   - 不接受用户输入，直接拼入 SQL；用 PG 双引号转义保留大小写

import type { PoolClient } from 'pg'

/**
 * 引用 PG 标识符（防注入兼容白名单值）。
 * 白名单值是编译时常量（snake_case identifiers），实际只需双引号包裹防关键字冲突。
 */
function quoteIdent(name: string): string {
  // 防御性：白名单值理论上不含双引号，但 escape 双引号以防意外
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * 通用反向 UPDATE：将 fieldsToRestore 写入业务表对应行（仅 deleted_at IS NULL 的行）。
 * 仅供 AuditRollbackService 调用（依赖白名单校验）。
 *
 * @returns affectedRows: 0 = 目标行不存在或 soft-deleted；1 = 成功
 */
export async function rollbackAuditLogTarget(
  client: PoolClient,
  tableName: string,
  primaryKeyColumn: string,
  targetId: string,
  fieldsToRestore: Record<string, unknown>,
  softDeleteColumn: string | null = 'deleted_at',
): Promise<{ affectedRows: number }> {
  const fields = Object.keys(fieldsToRestore)
  if (fields.length === 0) {
    return { affectedRows: 0 }
  }

  const sets = fields.map((col, i) => `${quoteIdent(col)} = $${i + 1}`)
  const params = fields.map((col) => fieldsToRestore[col])
  const whereSoftDelete = softDeleteColumn ? ` AND ${quoteIdent(softDeleteColumn)} IS NULL` : ''
  const sql =
    `UPDATE ${quoteIdent(tableName)} SET ${sets.join(', ')} ` +
    `WHERE ${quoteIdent(primaryKeyColumn)} = $${fields.length + 1}${whereSoftDelete}`

  const result = await client.query(sql, [...params, targetId])
  return { affectedRows: result.rowCount ?? 0 }
}

/**
 * 读取当前 DB 行指定字段子集（stale 检测使用 — 与 audit_log.after_jsonb 比对）。
 * @returns null = 目标行不存在或 soft-deleted
 */
export async function selectCurrentRowForRollback(
  client: PoolClient,
  tableName: string,
  primaryKeyColumn: string,
  targetId: string,
  fieldNames: readonly string[],
  softDeleteColumn: string | null = 'deleted_at',
): Promise<Record<string, unknown> | null> {
  if (fieldNames.length === 0) return null
  const cols = fieldNames.map(quoteIdent).join(', ')
  const whereSoftDelete = softDeleteColumn ? ` AND ${quoteIdent(softDeleteColumn)} IS NULL` : ''
  const sql =
    `SELECT ${cols} FROM ${quoteIdent(tableName)} ` +
    `WHERE ${quoteIdent(primaryKeyColumn)} = $1${whereSoftDelete} LIMIT 1`
  const result = await client.query<Record<string, unknown>>(sql, [targetId])
  return result.rows[0] ?? null
}

/**
 * 插入 audit_log 行（事务内版本 — 与 insertAuditLog 同实现但使用 PoolClient 支持事务原子性）。
 * ADR-138 D-138-6：rollback 的 audit 写入不走 fire-and-forget，在事务内 INSERT 保证原子性。
 *
 * @returns 新行 id（bigserial 转 string）
 */
export async function insertAuditLogInTransaction(
  client: PoolClient,
  input: WriteAuditLogInput,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO admin_audit_log
       (actor_id, action_type, target_kind, target_id, before_jsonb, after_jsonb, request_id, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id::text AS id`,
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
  return result.rows[0]!.id
}
