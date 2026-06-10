/**
 * messages/api.ts — 「消息中心」视图 API 客户端（ADR-196 D-196-4 / NTLG-P2-c-A-2）
 *
 * 消费 A-1 扩展后的 GET /admin/notifications（加性 cursor/q/level/type/since/until/readState +
 *   meta.nextCursor keyset 分页）。drawer 仍用 admin-shell-notifications 轮询；本模块供消息中心页全量历史检索。
 */

import { apiClient } from '@/lib/api-client'
import type { AdminNotificationItem } from '@resovo/types'

export interface ListMessagesParams {
  readonly limit?: number
  /** keyset 分页游标（meta.nextCursor 不透明串） */
  readonly cursor?: string
  /** 标题检索 */
  readonly q?: string
  readonly level?: 'info' | 'warn' | 'danger'
  /** ISO 时间下界 */
  readonly since?: string
  /** ISO 时间上界 */
  readonly until?: string
  readonly readState?: 'read' | 'unread'
}

export interface ListMessagesResult {
  readonly data: readonly AdminNotificationItem[]
  readonly meta: {
    readonly total: number
    readonly limit: number
    readonly since: string | null
    /** 已读高水位线（COALESCE(cursor, users.created_at) ISO）；前端据此对 broadcast/role 算 read */
    readonly readAt: string | null
    /** 下一页 keyset 游标（base64url 不透明串）；null=末页 */
    readonly nextCursor: string | null
  }
}

export async function listMessages(params: ListMessagesParams): Promise<ListMessagesResult> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.q) qs.set('q', params.q)
  if (params.level) qs.set('level', params.level)
  if (params.since) qs.set('since', params.since)
  if (params.until) qs.set('until', params.until)
  if (params.readState) qs.set('readState', params.readState)
  const s = qs.toString()
  return apiClient.get<ListMessagesResult>(`/admin/notifications${s ? `?${s}` : ''}`)
}
