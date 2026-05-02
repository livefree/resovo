/**
 * auditLog.ts — admin_audit_log INSERT query
 * CHG-SN-4-05: 审计日志写入（fire-and-forget，写失败不阻塞主操作）
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
