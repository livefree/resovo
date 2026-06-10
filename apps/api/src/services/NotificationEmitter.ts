/**
 * NotificationEmitter.ts — 通知发射中枢（ADR-193 D-193-2 / NTLG-P1-c-A）
 *
 * 解耦双写（ADR-192 D-192-10）：领域服务主动 emit 写 notifications 新表，
 * 与 AuditLogService.write 互不依赖（emit 只写 notifications，绝不写 admin_audit_log）。
 *
 * fire-and-forget（与 AuditLogService.write(): void 逐行同构，§11 D3）：
 *   返回 void、内部不 await、失败仅 log warn → 领域服务零阻塞、双写失败语义不分叉。
 * SQL 不入 service（ADR-192 D-192-7）：复用 db/queries/notifications.ts insertNotification（含 dedup_key 幂等）。
 *
 * 注：P1-c-A 仅实装中枢，emit 暂无调用方；8 类白名单事件领域服务接入 + worker on('completed') digest 归 NTLG-P1-c-B。
 */

import type { Pool } from 'pg'
import { baseLogger } from '@/api/lib/logger'
import { insertNotification, type NotificationLevel } from '@/api/db/queries/notifications'
import { resolveNotificationExpiresAt } from '@/api/services/notification-ttl-policy'
import { publishNotificationChanged } from '@/api/lib/notification-pubsub'

/**
 * emit 入参（ADR-193 D-193-2 契约，11 字段一一对应 notifications schema 列）。
 * 较 InsertNotificationInput 仅 scope 由必填改可选（省略默认 'broadcast'）；
 * payload 为 unknown（承载 TaskResultDigest 等结构化数据，由 insertNotification JSON.stringify 落 JSONB；禁 any）。
 */
export interface EmitNotificationInput {
  /** → notifications.type（语义键，如 'crawler.run.completed'） */
  readonly type: string
  /** → notifications.level（DB CHECK，info/warn/danger，D-192-6） */
  readonly level: NotificationLevel
  /** → notifications.title */
  readonly title: string
  /** → notifications.source_kind（NOT NULL 必填，产出象限，ADR-193 D-193-2） */
  readonly sourceKind: string
  /** → notifications.body */
  readonly body?: string
  /** → notifications.payload JSONB（承载 TaskResultDigest；禁 any） */
  readonly payload?: unknown
  /** → notifications.href */
  readonly href?: string
  /** → notifications.source_ref（去重&反查） */
  readonly sourceRef?: string
  /** → notifications.scope（前缀语义 broadcast、role 前缀、user 前缀 三类；省略默认 'broadcast'） */
  readonly scope?: string
  /** → notifications.dedup_key（partial unique 幂等） */
  readonly dedupKey?: string
  /** → notifications.expires_at（ISO 8601）。**省略时由 TTL 策略按 type 注入**（ADR-195 D-195-1 / P2-d-B，
   *  notification-ttl-policy.resolveNotificationExpiresAt：admin_action 90d / crawler·默认 30d）；显式传入则优先。 */
  readonly expiresAt?: string
}

/** scope 省略时的默认投递范围（ADR-193 emit 契约 scope?） */
const DEFAULT_SCOPE = 'broadcast'

export class NotificationEmitter {
  constructor(private readonly db: Pool) {}

  /**
   * 发射通知（fire-and-forget）：返回 void、内部不 await、失败仅 log warn。
   * 与 AuditLogService.write(): void 同构——领域服务双写时 audit / notification 失败互不影响、不阻断主操作。
   */
  emit(input: EmitNotificationInput): void {
    const scope = input.scope ?? DEFAULT_SCOPE
    insertNotification(this.db, {
      type: input.type,
      level: input.level,
      title: input.title,
      sourceKind: input.sourceKind,
      body: input.body,
      payload: input.payload,
      href: input.href,
      sourceRef: input.sourceRef,
      scope,
      dedupKey: input.dedupKey,
      // 显式传入优先；省略 → 按 type TTL 策略注入 expires_at（D-195-1，激活 P2-d-A purge）
      expiresAt: input.expiresAt ?? resolveNotificationExpiresAt(input.type),
    })
      .then(() => {
        // 写库成功 → publish Redis 信号触发各实例 SSE fan-out 重算 unread（ADR-196 D-196-2，
        // fire-and-forget 同构：失败仅 warn，丢信号由前端 60s 轮询 fallback 兜底 D-196-6）。
        publishNotificationChanged(scope)
      })
      .catch((err: unknown) => {
        baseLogger.warn({ err, type: input.type }, '[NotificationEmitter] notification emit failed')
      })
  }
}
