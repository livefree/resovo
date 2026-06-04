/**
 * rollback-routes.test.ts — CHG-SN-8-GAPS-AUDIT-ROLLBACK
 *
 * 覆盖 actionType → RollbackTarget 映射表（≥ 8 行 + disabled 边界 + fallback）
 */
import { describe, it, expect } from 'vitest'
import { resolveRollbackTarget } from '../../../../apps/server-next/src/lib/audit/rollback-routes'
import type { AdminAuditLogListRow } from '@resovo/types'

function makeRow(actionType: string, targetKind = 'video', targetId: string | null = 'tgt-1'): AdminAuditLogListRow {
  return {
    id: 'log-1',
    createdAt: '2026-05-21T00:00:00Z',
    actorId: 'actor-1',
    actorUsername: 'admin',
    actionType: actionType as AdminAuditLogListRow['actionType'],
    targetKind: targetKind as AdminAuditLogListRow['targetKind'],
    targetId,
    payloadSummary: '',
    requestId: 'req-1',
  } as AdminAuditLogListRow
}

describe('resolveRollbackTarget · 映射表', () => {
  it('video.approve → /admin/moderation reopen', () => {
    const r = resolveRollbackTarget(makeRow('video.approve'))
    expect(r.href).toBe('/admin/moderation?id=tgt-1&action=reopen')
    expect(r.label).toBe('回滚')
  })

  it('video.reject_labeled → /admin/moderation reopen', () => {
    const r = resolveRollbackTarget(makeRow('video.reject_labeled'))
    expect(r.href).toBe('/admin/moderation?id=tgt-1&action=reopen')
  })

  it('staging.publish → /admin/staging revert', () => {
    const r = resolveRollbackTarget(makeRow('staging.publish'))
    expect(r.href).toBe('/admin/staging?id=tgt-1&action=revert')
    expect(r.label).toBe('回滚到暂存')
  })

  it('video.merge → /admin/merge?tab=merged&from=audit-rollback 撤销合并', () => {
    // CHG-VIR-13-A1：buildMergeHref 收口 + from=audit-rollback（来源回链栏消费）
    const r = resolveRollbackTarget(makeRow('video.merge'))
    expect(r.href).toBe('/admin/merge?tab=merged&from=audit-rollback')
    expect(r.label).toBe('撤销合并')
  })

  it('home_module.create → /admin/home', () => {
    const r = resolveRollbackTarget(makeRow('home_module.create', 'home_module'))
    expect(r.href).toBe('/admin/home')
    expect(r.label).toBe('前往首页编辑')
  })

  it('crawler.run_create → disabled（不可回滚）', () => {
    const r = resolveRollbackTarget(makeRow('crawler.run_create', 'crawler_run'))
    expect(r.href).toBeNull()
    expect(r.disabledReason).toContain('不可回滚')
  })

  it('system.cache_clear → disabled', () => {
    const r = resolveRollbackTarget(makeRow('system.cache_clear', 'system'))
    expect(r.href).toBeNull()
  })

  it('image_health.rescan → disabled', () => {
    const r = resolveRollbackTarget(makeRow('image_health.rescan', 'image_health'))
    expect(r.href).toBeNull()
  })

  it('video.approve 但 targetId 缺失 → disabled', () => {
    const r = resolveRollbackTarget(makeRow('video.approve', 'video', null))
    expect(r.href).toBeNull()
    expect(r.disabledReason).toContain('targetId')
  })

  it('未知 actionType + targetKind=video → fallback /admin/videos?edit', () => {
    const r = resolveRollbackTarget(makeRow('some.unknown.action', 'video'))
    expect(r.href).toBe('/admin/videos?edit=tgt-1')
    expect(r.label).toBe('查看视频')
  })

  it('未知 actionType + 未知 targetKind → disabled', () => {
    const r = resolveRollbackTarget(makeRow('some.unknown', 'unknown_kind'))
    expect(r.href).toBeNull()
  })

  it('targetId 中含特殊字符 → encodeURIComponent', () => {
    const r = resolveRollbackTarget(makeRow('video.approve', 'video', 'a/b c'))
    expect(r.href).toBe('/admin/moderation?id=a%2Fb%20c&action=reopen')
  })
})
