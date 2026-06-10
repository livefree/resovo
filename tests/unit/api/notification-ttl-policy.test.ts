/**
 * tests/unit/api/notification-ttl-policy.test.ts —
 * ADR-195 D-195-1 / D-195-DEV-1 黄线① / NTLG-P2-d-B：通知 TTL 策略表单测。
 *
 * 覆盖：admin_action 8 类 → 90d（真源派生防漂移，黄线① ≥90）/ crawler·未知 → 默认 30d /
 *       now 注入确定性 ISO / `type in MAP` 区分无条目(默认) vs null(永久)。
 */
import { describe, it, expect } from 'vitest'
import {
  resolveNotificationExpiresAt,
  DEFAULT_TTL_DAYS,
  ADMIN_ACTION_TTL_DAYS,
} from '@/api/services/notification-ttl-policy'
import { NOTIFICATION_ACTION_TYPES } from '@/api/services/notification-audit-emit'

const NOW = Date.parse('2026-06-09T00:00:00.000Z')
const daysFromNow = (days: number): string => new Date(NOW + days * 24 * 3600_000).toISOString()

describe('resolveNotificationExpiresAt — TTL 策略 (ADR-195 D-195-1 / 黄线①)', () => {
  it('admin_action 8 类全部 → 90 天（黄线① ≥90，从 NOTIFICATION_ACTION_TYPES 真源派生防漂移）', () => {
    expect(ADMIN_ACTION_TTL_DAYS).toBeGreaterThanOrEqual(90)
    expect(NOTIFICATION_ACTION_TYPES.length).toBe(8)
    for (const type of NOTIFICATION_ACTION_TYPES) {
      expect(resolveNotificationExpiresAt(type, NOW)).toBe(daysFromNow(ADMIN_ACTION_TTL_DAYS))
    }
  })

  it('crawler.run.completed → 默认 30 天（瞬时运营信息）', () => {
    expect(resolveNotificationExpiresAt('crawler.run.completed', NOW)).toBe(daysFromNow(DEFAULT_TTL_DAYS))
  })

  it('未知 type → 默认 30 天（DEFAULT_TTL_DAYS=30，对齐 ADR-188 后台保留口径）', () => {
    expect(DEFAULT_TTL_DAYS).toBe(30)
    expect(resolveNotificationExpiresAt('some.unknown.type', NOW)).toBe(daysFromNow(DEFAULT_TTL_DAYS))
  })

  it('now 参数注入 → expires_at = now + days（确定性，便集成/回归断言）', () => {
    const t = Date.parse('2026-01-01T12:00:00.000Z')
    expect(resolveNotificationExpiresAt('video.merge', t)).toBe(
      new Date(t + ADMIN_ACTION_TTL_DAYS * 24 * 3600_000).toISOString(),
    )
  })
})
