/**
 * NotificationService.ts — admin Shell 通知 hub MVP（ADR-147）
 *
 * 数据源：admin_audit_log 按白名单 actionType 过滤 + 时间窗口（D-147-1 方案 A）
 * 零写操作 / 零 R-MID-1 新增 / 零 ErrorCode 新增（D-147-7）
 *
 * R-147-1 缓解：白名单为 ReadonlySet 类型安全；新增 actionType 后检查此白名单。
 *
 * NTLG-P1-c-B-2：whitelist/title/level/href 映射真源已抽至 notification-audit-emit.ts
 * （emit 双写侧共享同源 → parity）；本服务 import 复用 + re-export whitelist 维持既有 import 兼容。
 */

import type { Pool } from 'pg'
import type {
  AdminAuditActionType,
  AdminNotificationItem,
} from '@resovo/types'
import {
  countUnreadNotifications,
  upsertReadCursor,
} from '@/api/db/queries/notifications'
import {
  NOTIFICATION_ACTION_WHITELIST,
  NOTIFICATION_TITLE_MAP,
  NOTIFICATION_LEVEL_MAP,
  NOTIFICATION_HREF_MAP,
  type NotificationActionType,
} from '@/api/services/notification-audit-emit'

// re-export 维持既有 import 兼容（BackgroundEventService / 单测仍 import 自本服务）
export { NOTIFICATION_ACTION_WHITELIST }

interface AuditRow {
  id: string
  action_type: AdminAuditActionType
  target_id: string | null
  created_at: Date
}

export interface ListNotificationsParams {
  limit: number
  since: string
}

export interface ListNotificationsResult {
  items: AdminNotificationItem[]
  total: number
}

export class NotificationService {
  constructor(private readonly db: Pool) {}

  async list(params: ListNotificationsParams): Promise<ListNotificationsResult> {
    const actionTypes = [...NOTIFICATION_ACTION_WHITELIST]
    const [rowsRes, countRes] = await Promise.all([
      this.db.query<AuditRow>(
        `SELECT id::text, action_type, target_id, created_at
           FROM admin_audit_log
          WHERE action_type = ANY($1::text[])
            AND created_at >= $2::timestamptz
          ORDER BY created_at DESC
          LIMIT $3`,
        [actionTypes, params.since, params.limit],
      ),
      this.db.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c
           FROM admin_audit_log
          WHERE action_type = ANY($1::text[])
            AND created_at >= $2::timestamptz`,
        [actionTypes, params.since],
      ),
    ])

    const items: AdminNotificationItem[] = rowsRes.rows.map((row) => {
      // 行已由 WHERE action_type = ANY(whitelist) 过滤 → 必属 NotificationActionType（窄化复用共享映射）
      const actionType = row.action_type as NotificationActionType
      const item: AdminNotificationItem = {
        id: row.id,
        title: NOTIFICATION_TITLE_MAP[actionType],
        level: NOTIFICATION_LEVEL_MAP.get(actionType) ?? 'info',
        createdAt: row.created_at.toISOString(),
        read: false,
      }
      const href = NOTIFICATION_HREF_MAP.get(actionType)
      if (href) {
        return { ...item, href }
      }
      return item
    })

    return {
      items,
      total: Number.parseInt(countRes.rows[0]?.c ?? '0', 10) || 0,
    }
  }

  /**
   * 服务端未读计数（ADR-192 D-192-5 + AMENDMENT D-192-AMD-3）。
   * scope 集合按调用方角色派生：broadcast + role:<role>（高水位线）+ user:<id>（定向）。
   * 读 notifications 新表 + cursor；P1 阶段 emit 未接入（归 P1-c）→ 新表空时恒返 0（「无新通知」正确语义）。
   */
  async unreadCount(userId: string, role: string): Promise<number> {
    return countUnreadNotifications(this.db, {
      userId,
      broadcastScopes: ['broadcast', `role:${role}`],
      targetedScope: `user:${userId}`,
    })
  }

  /**
   * 标记全部 broadcast/role 通知已读（ADR-192 D-192-3 + AMENDMENT D-192-AMD-1）。
   * 仅 upsert 一行 cursor 高水位线（避免「用户×N 条」写放大）；read_at 服务端取 NOW()。
   * 定向逐行 reads 写路径仍 deferred（D-192-DEV-1 / P2）。
   */
  async markAllRead(userId: string): Promise<{ readAt: string }> {
    const readAt = new Date().toISOString()
    await upsertReadCursor(this.db, userId, readAt)
    return { readAt }
  }
}
