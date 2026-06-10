/**
 * notification-ttl-policy.ts — 通知 TTL 策略表（ADR-195 D-195-1 / NTLG-P2-d-B）
 *
 * Emitter 注入（D-195-1「Emitter 注入」）：emit 未显式传 expiresAt 时按 notification.type 计算 expires_at，
 *   激活 P2-d-A 的 purge-expired-notifications worker（在此之前所有通知 expires_at=NULL 永不过期，purge no-op）。
 *
 * 策略口径：
 *   - 默认 30 天（D-195-1，对齐 ADR-188 后台保留口径）。
 *   - admin_action 8 类 → 90 天（D-195-DEV-1 黄线①「≥90 天对运营追溯」；从 NOTIFICATION_ACTION_TYPES 真源
 *     派生 90d——防漂移：新增 admin_action 类型自动 ≥90，不会静默落回默认 30 天）。**audit_log 才是永久合规
 *     取证真源（ADR-192 D-192-1），通知 90 天后被 purge 物理删除不损合规**。
 *   - null = 永久不过期（per-type 覆盖，D-195-1；当前无 null 条目，预留「消息中心」P2-c 长期历史类型）。
 */

import { NOTIFICATION_ACTION_TYPES } from '@/api/services/notification-audit-emit'

/** 默认保留期（天）——未显式覆盖的 type 走此口径（D-195-1）。 */
export const DEFAULT_TTL_DAYS = 30

/** admin_action 8 类保留期（天）——黄线① ≥90；显式 const 值 + 真源派生类型条目。 */
export const ADMIN_ACTION_TTL_DAYS = 90

const MS_PER_DAY = 24 * 3600_000

/**
 * type → TTL 天数（number=保留天数 / null=永久不过期）。
 * admin_action 8 类从 NOTIFICATION_ACTION_TYPES 真源派生 90d（防漂移，黄线①）；crawler 运行摘要走默认保留期。
 */
const NOTIFICATION_TTL_DAYS: Record<string, number | null> = {
  ...Object.fromEntries(
    NOTIFICATION_ACTION_TYPES.map((t): [string, number] => [t, ADMIN_ACTION_TTL_DAYS]),
  ),
  'crawler.run.completed': DEFAULT_TTL_DAYS, // 采集运行摘要：瞬时运营信息，默认保留期
}

/**
 * 按 type 解析 expires_at（ISO 8601）：策略表命中取其天数、未命中走默认 30 天；null 条目 → 永久（返 null）。
 * `type in MAP` 区分「无条目（→默认）」与「条目为 null（→永久）」——避免 `?? DEFAULT` 把 null 误落默认。
 */
export function resolveNotificationExpiresAt(type: string, now: number = Date.now()): string | null {
  const days = type in NOTIFICATION_TTL_DAYS ? NOTIFICATION_TTL_DAYS[type] : DEFAULT_TTL_DAYS
  return days === null ? null : new Date(now + days * MS_PER_DAY).toISOString()
}
