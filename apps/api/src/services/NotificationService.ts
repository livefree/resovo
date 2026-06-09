/**
 * NotificationService.ts — admin Shell 通知 hub（ADR-147 → ADR-192 解耦双写收口）
 *
 * 数据源（NTLG-P1-c-C 破坏性切换）：notifications 新表（emit 双写真源），弃 admin_audit_log 派生。
 *   - list 按 scope（broadcast+role+user）+ sourceKind allowlist ['admin_action'] 读新表列；
 *     crawler 完成仍经 background-events finished lane 入抽屉（ADR-155），allowlist 防重复 + 保旧 list parity。
 *   - title/level/href 直读新表列（emit 写入时已用 notification-audit-emit 同源映射 → 逐字 parity）。
 *   - 已读统一 cursor 单一源（D-192-AMD-4）：返回 readAt 高水位线，前端据此对 general+background 算 read（替 localStorage）。
 *
 * 投递语义（ADR-193 D-193-2）：emit 与 audit 同为 fire-and-forget void（同 PG 池、失败仅 warn）→
 *   切 emit 派生无可靠性回归（旧 audit 派生同样依赖 fire-and-forget audit 写成功）。
 */

import type { Pool } from 'pg'
import type { AdminNotificationItem } from '@resovo/types'
import {
  listNotifications,
  countNotifications,
  countUnreadNotifications,
  getEffectiveReadCursor,
  upsertReadCursor,
} from '@/api/db/queries/notifications'
import { ADMIN_ACTION_SOURCE_KIND } from '@/api/services/notification-audit-emit'

/**
 * drawer general lane 的 sourceKind allowlist（NTLG-P1-c-C）。
 * 仅 admin_action（= 旧 8 类白名单 admin 动作，等价见 ADMIN_ACTION_SOURCE_KIND 不变量注释）；
 * crawler 走 background lane 不在此（防重复）。新 sourceKind 默认不进 list（封闭集，失败方向=漏显示而非误显示）。
 */
const GENERAL_LANE_SOURCE_KINDS: readonly string[] = [ADMIN_ACTION_SOURCE_KIND]

export interface ListNotificationsParams {
  limit: number
  since: string
  /** 当前登录用户（scope 派生 + cursor 基线） */
  userId: string
  /** 当前登录用户角色（role:<role> scope 派生） */
  role: string
}

export interface ListNotificationsResult {
  items: AdminNotificationItem[]
  total: number
  /** 已读高水位线（COALESCE(cursor, users.created_at) ISO）；前端据此统一计算 read，替 localStorage */
  readAt: string | null
}

export class NotificationService {
  constructor(private readonly db: Pool) {}

  async list(params: ListNotificationsParams): Promise<ListNotificationsResult> {
    const scopes = ['broadcast', `role:${params.role}`, `user:${params.userId}`]
    const filter = {
      scopes,
      since: params.since,
      sourceKinds: [...GENERAL_LANE_SOURCE_KINDS],
    }
    const [rows, total, readAt] = await Promise.all([
      listNotifications(this.db, { ...filter, limit: params.limit }),
      countNotifications(this.db, filter),
      getEffectiveReadCursor(this.db, params.userId),
    ])

    const items: AdminNotificationItem[] = rows.map((row) => {
      // read=false：客户端据 readAt 高水位线对 general+background 合并项统一计算（单一已读源 D-192-AMD-4）
      const item: AdminNotificationItem = {
        id: row.id,
        title: row.title,
        level: row.level,
        createdAt: new Date(row.createdAt).toISOString(),
        read: false,
      }
      return {
        ...item,
        ...(row.body != null && { body: row.body }),
        ...(row.href != null && { href: row.href }),
      }
    })

    return { items, total, readAt }
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
