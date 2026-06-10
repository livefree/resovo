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
  type NotificationLevel,
  type NotificationRow,
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
  /** ISO 时间下界（drawer 默认 7d 窗 / 消息中心模式可省=全量历史，ADR-196 D-196-4） */
  since?: string
  /** 当前登录用户（scope 派生 + cursor 基线） */
  userId: string
  /** 当前登录用户角色（role:<role> scope 派生） */
  role: string
  // ── 消息中心加性过滤/分页（ADR-196 D-196-4；省略=drawer 旧行为）──
  /** keyset 分页游标（上一页末行 created_at+id） */
  cursor?: { createdAt: string; id: string }
  /** ISO 时间上界（与 since 组日期范围） */
  until?: string
  /** 标题检索 */
  q?: string
  /** level 过滤 */
  levels?: NotificationLevel[]
  /** type 过滤 */
  types?: string[]
  /** 已读态过滤（broadcast/role 按 readAt 高水位线比较） */
  readState?: 'read' | 'unread'
}

export interface ListNotificationsResult {
  items: AdminNotificationItem[]
  total: number
  /** 已读高水位线（COALESCE(cursor, users.created_at) ISO）；前端据此统一计算 read，替 localStorage */
  readAt: string | null
  /** 下一页 keyset 游标（rows 满 limit 时为末行 {createdAt,id}，否则 null=末页，ADR-196 D-196-4） */
  nextCursor: { createdAt: string; id: string } | null
}

export class NotificationService {
  constructor(private readonly db: Pool) {}

  async list(params: ListNotificationsParams): Promise<ListNotificationsResult> {
    const scopes = ['broadcast', `role:${params.role}`, `user:${params.userId}`]
    const baseFilter = {
      scopes,
      sourceKinds: [...GENERAL_LANE_SOURCE_KINDS],
      ...(params.since != null && { since: params.since }),
      ...(params.until != null && { until: params.until }),
      ...(params.q != null && { q: params.q }),
      ...(params.levels != null && { levels: params.levels }),
      ...(params.types != null && { types: params.types }),
    }
    const listArgs = (filter: typeof baseFilter): Parameters<typeof listNotifications>[1] => ({
      ...filter,
      limit: params.limit,
      ...(params.cursor != null && { cursor: params.cursor }),
    })

    let rows: NotificationRow[]
    let total: number
    let readAt: string | null
    if (params.readState != null) {
      // readState 过滤需 readAt 作 cursorReadAt 比较基线 → 先取（一次单行索引查询，仅消息中心 readState 路径）
      readAt = await getEffectiveReadCursor(this.db, params.userId)
      const filter = { ...baseFilter, readState: params.readState, cursorReadAt: readAt }
      ;[rows, total] = await Promise.all([
        listNotifications(this.db, listArgs(filter)),
        countNotifications(this.db, filter),
      ])
    } else {
      // drawer / 无 readState：readAt 与 list/count 并行（保 hot path 并行 + 既有 query 顺序 list,count,readAt）
      ;[rows, total, readAt] = await Promise.all([
        listNotifications(this.db, listArgs(baseFilter)),
        countNotifications(this.db, baseFilter),
        getEffectiveReadCursor(this.db, params.userId),
      ])
    }

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

    // nextCursor：本页满 limit → 可能有下一页，取末行 keyset；否则末页 null
    const lastRow = rows.length === params.limit ? rows[rows.length - 1] : undefined
    const nextCursor = lastRow
      ? { createdAt: new Date(lastRow.createdAt).toISOString(), id: lastRow.id }
      : null

    return { items, total, readAt, nextCursor }
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
