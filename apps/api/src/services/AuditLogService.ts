/**
 * AuditLogService.ts — admin 写操作审计日志封装
 * CHG-SN-4-05: fire-and-forget（写失败不阻塞主操作，log warn）
 */

import type { Pool } from 'pg'
import type { AdminAuditActionType, AdminAuditTargetKind } from '@resovo/types'
import { insertAuditLog, type WriteAuditLogInput } from '@/api/db/queries/auditLog'
import { baseLogger } from '@/api/lib/logger'

export type { WriteAuditLogInput }

export class AuditLogService {
  constructor(private db: Pool) {}

  write(input: WriteAuditLogInput): void {
    insertAuditLog(this.db, input).catch((err: unknown) => {
      baseLogger.warn({ err, actionType: input.actionType }, '[AuditLogService] audit write failed')
    })
  }
}
