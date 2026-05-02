/**
 * AuditLogService.ts — admin 写操作审计日志封装
 * CHG-SN-4-05: fire-and-forget（写失败不阻塞主操作，log warn + stderr）
 */

import type { Pool } from 'pg'
import type { AdminAuditActionType, AdminAuditTargetKind } from '@resovo/types'
import { insertAuditLog, type WriteAuditLogInput } from '@/api/db/queries/auditLog'

export type { WriteAuditLogInput }

export class AuditLogService {
  constructor(private db: Pool) {}

  write(input: WriteAuditLogInput): void {
    insertAuditLog(this.db, input).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[AuditLogService] write failed (${input.actionType}): ${message}\n`)
    })
  }
}
