/**
 * dismiss-item-key.test.ts — 抽屉项 dismiss 白名单守卫单测（ADR-197 D-197-2 / NTLG-NTF-DISMISS-B1）
 */
import { describe, it, expect } from 'vitest'
import { isDismissableNotificationKey } from '@/api/lib/dismiss-item-key'

describe('isDismissableNotificationKey（ADR-197 D-197-2 通知抽屉白名单）', () => {
  it('general 通知行 id（纯数字串）→ 可 dismiss', () => {
    expect(isDismissableNotificationKey('1042')).toBe(true)
    expect(isDismissableNotificationKey('1')).toBe(true)
  })

  it('finished 高危审计 bg-audit:<id> → 可 dismiss', () => {
    expect(isDismissableNotificationKey('bg-audit:55')).toBe(true)
  })

  it('upcoming（auto_crawl / scheduler_timer）→ 不可 dismiss（瞬时未来事件）', () => {
    expect(isDismissableNotificationKey('bg-auto_crawl:next')).toBe(false)
    expect(isDismissableNotificationKey('bg-scheduler_timer:imageHealth')).toBe(false)
  })

  it('active（crawler_run 进行中）→ 不可 dismiss（破窗「删了又回来」）', () => {
    expect(isDismissableNotificationKey('bg-crawler_run:abc-123')).toBe(false)
  })

  it('taskrun-（终态校验需查库，归 -B2）→ 本守卫暂不可 dismiss', () => {
    expect(isDismissableNotificationKey('taskrun-7')).toBe(false)
  })

  it('空串 / 非法前缀 → 不可 dismiss', () => {
    expect(isDismissableNotificationKey('')).toBe(false)
    expect(isDismissableNotificationKey('audit:5')).toBe(false) // 缺 bg- 前缀
    expect(isDismissableNotificationKey('12a')).toBe(false) // 非纯数字
  })
})
