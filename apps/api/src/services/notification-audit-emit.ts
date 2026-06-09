/**
 * notification-audit-emit.ts — 8 类白名单 admin 事件 → emit 双写映射真源（ADR-192 D-192-10 / NTLG-P1-c-B-2）
 *
 * 解耦双写（ADR-192）：领域服务/route 在写 audit 旁主动 emit 写 notifications 新表，互不依赖。
 * 本模块沉淀「audit actionType → 通知展示」映射真源（title/level/href + whitelist），
 * 由两侧共同消费：
 *   - 写侧：buildAuditNotificationEmit → NotificationEmitter.emit（NTLG-P1-c-B-2，本卡新增）
 *   - 读侧（过渡期）：NotificationService.list（audit 派生，import 复用本模块映射，行为零变更）
 *
 * parity 约束：title/level/href 与 NotificationService.list 同一组真源 →
 *   P1-c-C 把 list 切到读 notifications 新表后，通知样貌逐字一致（避免切换漂移）。
 *
 * 映射真源历史归属：原 ADR-147 落在 NotificationService，NTLG-P1-c-B-2 抽出独立模块；
 *   NTLG-P1-c-C 重写 NotificationService.list 直读 notifications 新表并下线 audit 派生 →
 *   原 audit 过滤用的 NOTIFICATION_ACTION_WHITELIST（Set）零运行时消费方，已删除；
 *   NOTIFICATION_ACTION_TYPES（元组）保留——emit 侧穷尽映射 + 8 类白名单语义真源。
 *
 * sourceKind 取值集（读写双侧契约）：{ 'admin_action'（本模块 emit 写 + NotificationService.list allowlist 读）,
 *   'crawler'（crawlerWorker.notifications.ts emit 写，list 不读、经 background lane 入抽屉）}。
 *   ADMIN_ACTION_SOURCE_KIND 为该契约值单一真源，读写两侧复用避免字面量漂移。
 */

import type { AdminAuditActionType } from '@resovo/types'
import type { NotificationLevel } from '@/api/db/queries/notifications'
import type { EmitNotificationInput } from '@/api/services/NotificationEmitter'

/**
 * 白名单 8 类 actionType（ADR-147 D-147-1）。
 * `as const satisfies` 锚定为 AdminAuditActionType 子集 → 未来枚举重命名编译期联动；
 * 同时派生 union 类型 + ReadonlySet，单一真源。
 */
export const NOTIFICATION_ACTION_TYPES = [
  'system.webhook_send_failed',
  'staging.batch_publish',
  'video.manual_add',
  'video.merge',
  'user_submission.action',
  'system.cache_clear',
  'system.settings_update',
  'system.audit_rollback',
] as const satisfies readonly AdminAuditActionType[]

/** 白名单事件类型 union（写入点 ctx.actionType 静态约束，恒产出通知无 null 分支） */
export type NotificationActionType = (typeof NOTIFICATION_ACTION_TYPES)[number]

/** title 模板映射（Record 穷尽——比现 list `?? actionType` 回落更强，保证全 8 类有标题） */
export const NOTIFICATION_TITLE_MAP: Record<NotificationActionType, string> = {
  'system.webhook_send_failed': 'Webhook 投递失败',
  'staging.batch_publish': '批量上架完成',
  'video.manual_add': '手动添加视频',
  'video.merge': '视频合并完成',
  'user_submission.action': '用户投稿处理',
  'system.cache_clear': '缓存已清除',
  'system.settings_update': '系统设置已更新',
  'system.audit_rollback': '审计回滚执行',
}

/** level 稀疏映射（未列出 → 'info' 默认） */
export const NOTIFICATION_LEVEL_MAP: ReadonlyMap<NotificationActionType, NotificationLevel> = new Map([
  ['system.webhook_send_failed', 'danger'],
  ['system.cache_clear', 'warn'],
  ['system.audit_rollback', 'warn'],
])

/** href 跳转映射（全 8 类） */
export const NOTIFICATION_HREF_MAP: ReadonlyMap<NotificationActionType, string> = new Map([
  ['system.webhook_send_failed', '/admin/settings'],
  ['staging.batch_publish', '/admin/videos'],
  ['video.manual_add', '/admin/videos'],
  ['video.merge', '/admin/merge'],
  ['user_submission.action', '/admin/user-submissions'],
  ['system.cache_clear', '/admin/settings'],
  ['system.settings_update', '/admin/settings'],
  ['system.audit_rollback', '/admin/audit'],
])

/**
 * sourceKind 象限（ADR-193 D-193-2 「产出象限」）：admin 后台主动操作。
 * 与 crawler worker 的 'crawler'（NTLG-P1-c-B-1）并列；象限取值集 { crawler, admin_action }。
 *
 * 读写双侧契约值单一真源（NTLG-P1-c-C）：emit 写侧（本模块）+ NotificationService.list allowlist 读侧复用。
 * 隐式不变量显式化：本值恒由 8 类白名单 actionType 产出（buildAuditNotificationEmit 入参
 * `actionType: NotificationActionType` 静态约束只允许 8 类）→ list 按 sourceKind='admin_action' 过滤
 * 与旧 list 按 8 类 actionType 过滤等价（零漂移 parity 前提）。
 */
export const ADMIN_ACTION_SOURCE_KIND = 'admin_action'

export interface AuditNotificationContext {
  /** 白名单 8 类之一（写入点字面量，静态保证恒产出通知） */
  readonly actionType: NotificationActionType
  /** audit targetId → notifications.source_ref（反查；batch/系统级写入点为 null/未提供则不带 sourceRef） */
  readonly targetId?: string | null
}

/**
 * 8 类白名单 admin 事件 → emit 双写入参（ADR-192 D-192-10 / NTLG-P1-c-B-2）。
 *
 * title/level/href 复用本模块映射 → 与 NotificationService.list 逐字 parity。
 * scope='broadcast'（parity：现派生 list 对全 admin 无差别可见、无角色过滤）。
 * body 不设（parity：现 list 仅输出 id/title/level/createdAt/read/href，无 body）。
 * **dedupKey 不设**：每次离散 admin 操作 = 一行 audit + 一条通知（与 audit 一对一、不去重，
 *   与现 audit-派生 list 同构）；去重/TTL 策略整体 deferred ADR-195，本 helper 刻意不预占该键。
 */
export function buildAuditNotificationEmit(ctx: AuditNotificationContext): EmitNotificationInput {
  const level = NOTIFICATION_LEVEL_MAP.get(ctx.actionType) ?? 'info'
  const href = NOTIFICATION_HREF_MAP.get(ctx.actionType)
  return {
    type: ctx.actionType,
    level,
    title: NOTIFICATION_TITLE_MAP[ctx.actionType],
    sourceKind: ADMIN_ACTION_SOURCE_KIND,
    scope: 'broadcast',
    ...(href !== undefined && { href }),
    ...(ctx.targetId != null && { sourceRef: ctx.targetId }),
  }
}
