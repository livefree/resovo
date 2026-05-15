/**
 * admin-audit.types.ts — /admin/audit 全局审计日志视图类型契约
 *
 * 端点真源：ADR-118 §端点契约（3 端点 MVP：list / detail / enums）
 * 关联 ADR：ADR-109（admin_audit_log schema 052 migration）/ ADR-110（ApiResponse 信封）
 *
 * 字段命名 100% 对齐 AdminAuditLogQueryRow（apps/api/src/db/queries/auditLog.ts）+ ADR-105/-117/-104 camelCase
 *
 * 注意：本文件**不再次定义** AdminAuditActionType / AdminAuditTargetKind / AdminAuditLog，
 * 那些枚举与基础接口由 admin-moderation.types.ts 持有（plan v1.4 §3.0.5 真源），
 * 本文件仅定义本视图专属的 ListRow / Detail / 查询参数 / 响应信封。
 */
import type { AdminAuditActionType, AdminAuditTargetKind } from './admin-moderation.types'

// ── 列表行（裁剪 jsonb；ADR-118 D-118-2） ────────────────────────────
export interface AdminAuditLogListRow {
  readonly id: string
  readonly actorId: string
  readonly actorUsername: string | null
  readonly actionType: AdminAuditActionType
  readonly targetKind: AdminAuditTargetKind
  readonly targetId: string | null
  readonly requestId: string | null
  readonly createdAt: string
  /** Service 层提取的 jsonb 摘要，最长 256 字符（D-118-2 / D-118-10） */
  readonly payloadSummary: string | null
}

// ── 详情（完整 jsonb + ipHash；ADR-118 D-118-2） ─────────────────────
export interface AdminAuditLogDetail extends AdminAuditLogListRow {
  readonly beforeJsonb: Readonly<Record<string, unknown>> | null
  readonly afterJsonb: Readonly<Record<string, unknown>> | null
  readonly ipHash: string | null
}

// ── 查询参数（7 维 filter MVP；ADR-118 D-118-3） ────────────────────
export interface ListAdminAuditLogsParams {
  readonly page?: number
  readonly limit?: number
  readonly actorId?: string
  readonly actionType?: AdminAuditActionType
  readonly targetKind?: AdminAuditTargetKind
  /** 与 targetKind 联用，单独传 422（ADR-118 D-118-3 / VALIDATION_ERROR） */
  readonly targetId?: string
  readonly requestId?: string
  /** ISO 8601 timestamptz，闭区间 */
  readonly from?: string
  /** ISO 8601 timestamptz，闭区间 */
  readonly to?: string
}

// ── 响应（ApiResponse 信封；ADR-118 D-118-7） ───────────────────────
export interface ListAdminAuditLogsResult {
  readonly rows: readonly AdminAuditLogListRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export interface AdminAuditLogEnumsResult {
  readonly actionTypes: readonly AdminAuditActionType[]
  readonly targetKinds: readonly AdminAuditTargetKind[]
}
