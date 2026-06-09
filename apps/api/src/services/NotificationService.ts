/**
 * NotificationService.ts — admin Shell 通知 hub MVP（ADR-147）
 *
 * 数据源：admin_audit_log 按白名单 actionType 过滤 + 时间窗口（D-147-1 方案 A）
 * 零写操作 / 零 R-MID-1 新增 / 零 ErrorCode 新增（D-147-7）
 *
 * R-147-1 缓解：白名单为 ReadonlySet 类型安全；新增 actionType 后检查此白名单。
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

/** 白名单 actionType（首版 8 类 / ADR-147 D-147-1） */
export const NOTIFICATION_ACTION_WHITELIST: ReadonlySet<AdminAuditActionType> = new Set([
  'system.webhook_send_failed',
  'staging.batch_publish',
  'video.manual_add',
  'video.merge',
  'user_submission.action',
  'system.cache_clear',
  'system.settings_update',
  'system.audit_rollback',
])

/** level 映射（未列出 → 'info' 默认） */
const LEVEL_MAP: ReadonlyMap<AdminAuditActionType, AdminNotificationItem['level']> = new Map([
  ['system.webhook_send_failed', 'danger'],
  ['system.cache_clear', 'warn'],
  ['system.audit_rollback', 'warn'],
])

/** href 跳转映射 */
const HREF_MAP: ReadonlyMap<AdminAuditActionType, string> = new Map([
  ['system.webhook_send_failed', '/admin/settings'],
  ['staging.batch_publish', '/admin/videos'],
  ['video.manual_add', '/admin/videos'],
  ['video.merge', '/admin/merge'],
  ['user_submission.action', '/admin/user-submissions'],
  ['system.cache_clear', '/admin/settings'],
  ['system.settings_update', '/admin/settings'],
  ['system.audit_rollback', '/admin/audit'],
])

/** title 模板映射 */
const TITLE_MAP: ReadonlyMap<AdminAuditActionType, string> = new Map([
  ['system.webhook_send_failed', 'Webhook 投递失败'],
  ['staging.batch_publish', '批量上架完成'],
  ['video.manual_add', '手动添加视频'],
  ['video.merge', '视频合并完成'],
  ['user_submission.action', '用户投稿处理'],
  ['system.cache_clear', '缓存已清除'],
  ['system.settings_update', '系统设置已更新'],
  ['system.audit_rollback', '审计回滚执行'],
])

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
      const item: AdminNotificationItem = {
        id: row.id,
        title: TITLE_MAP.get(row.action_type) ?? row.action_type,
        level: LEVEL_MAP.get(row.action_type) ?? 'info',
        createdAt: row.created_at.toISOString(),
        read: false,
      }
      const href = HREF_MAP.get(row.action_type)
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
