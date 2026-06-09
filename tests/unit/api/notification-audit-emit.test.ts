/**
 * tests/unit/api/notification-audit-emit.test.ts —
 * NTLG-P1-c-B-2 / ADR-192 D-192-10 buildAuditNotificationEmit 映射单测
 *
 * 单卡范围超限（8 写入点）逃生口豁免前提（workflow-rules 原子化判据 + arch-reviewer MEDIUM-3）：
 * 8 写入点为同一 helper 的机械应用 → 正确性集中锁在本 helper 全 8 类全字段单测层。
 *
 * 覆盖：
 *   - 全 8 类 actionType → type/level/title/href/sourceKind/scope parity 映射
 *   - level 缺省 'info' + 3 类显式（danger/warn）
 *   - sourceRef 由 targetId 派生（null/省略 → 不带键）
 *   - dedupKey / body 刻意不设（MEDIUM-2：与 audit 一对一不去重 / parity 无 body）
 *   - 与 NotificationService.list 同源映射 parity 守护
 */
import { describe, it, expect } from 'vitest'
import {
  buildAuditNotificationEmit,
  NOTIFICATION_ACTION_TYPES,
  NOTIFICATION_ACTION_WHITELIST,
  NOTIFICATION_TITLE_MAP,
  NOTIFICATION_LEVEL_MAP,
  NOTIFICATION_HREF_MAP,
  type NotificationActionType,
} from '@/api/services/notification-audit-emit'

describe('buildAuditNotificationEmit — 全 8 类映射', () => {
  it('#1 whitelist 与 NOTIFICATION_ACTION_TYPES 元组同集（8 类）', () => {
    expect(NOTIFICATION_ACTION_TYPES).toHaveLength(8)
    expect([...NOTIFICATION_ACTION_WHITELIST].sort()).toEqual([...NOTIFICATION_ACTION_TYPES].sort())
  })

  it('#2 每类恒产出 type=actionType / sourceKind=admin_action / scope=broadcast', () => {
    for (const actionType of NOTIFICATION_ACTION_TYPES) {
      const emit = buildAuditNotificationEmit({ actionType, targetId: 't-1' })
      expect(emit.type).toBe(actionType)
      expect(emit.sourceKind).toBe('admin_action')
      expect(emit.scope).toBe('broadcast')
    }
  })

  it('#3 title 全 8 类穷尽且与 NOTIFICATION_TITLE_MAP 逐字一致（parity）', () => {
    for (const actionType of NOTIFICATION_ACTION_TYPES) {
      const emit = buildAuditNotificationEmit({ actionType })
      expect(emit.title).toBe(NOTIFICATION_TITLE_MAP[actionType])
      expect(emit.title.length).toBeGreaterThan(0)
    }
  })

  it('#4 level 缺省 info + 显式 danger/warn 与 NOTIFICATION_LEVEL_MAP 一致（parity）', () => {
    for (const actionType of NOTIFICATION_ACTION_TYPES) {
      const emit = buildAuditNotificationEmit({ actionType })
      expect(emit.level).toBe(NOTIFICATION_LEVEL_MAP.get(actionType) ?? 'info')
    }
    // 显式三类
    expect(buildAuditNotificationEmit({ actionType: 'system.webhook_send_failed' }).level).toBe('danger')
    expect(buildAuditNotificationEmit({ actionType: 'system.cache_clear' }).level).toBe('warn')
    expect(buildAuditNotificationEmit({ actionType: 'system.audit_rollback' }).level).toBe('warn')
    // 缺省 info 代表
    expect(buildAuditNotificationEmit({ actionType: 'video.manual_add' }).level).toBe('info')
    expect(buildAuditNotificationEmit({ actionType: 'staging.batch_publish' }).level).toBe('info')
  })

  it('#5 href 全 8 类与 NOTIFICATION_HREF_MAP 一致（parity）', () => {
    for (const actionType of NOTIFICATION_ACTION_TYPES) {
      const emit = buildAuditNotificationEmit({ actionType })
      expect(emit.href).toBe(NOTIFICATION_HREF_MAP.get(actionType))
    }
    expect(buildAuditNotificationEmit({ actionType: 'video.merge' }).href).toBe('/admin/merge')
    expect(buildAuditNotificationEmit({ actionType: 'user_submission.action' }).href).toBe('/admin/user-submissions')
  })

  it('#6 targetId 提供 → sourceRef=targetId', () => {
    const emit = buildAuditNotificationEmit({ actionType: 'video.merge', targetId: 'video-42' })
    expect(emit.sourceRef).toBe('video-42')
  })

  it('#7 targetId=null 或省略 → 不带 sourceRef 键', () => {
    const withNull = buildAuditNotificationEmit({ actionType: 'system.cache_clear', targetId: null })
    expect('sourceRef' in withNull).toBe(false)
    const omitted = buildAuditNotificationEmit({ actionType: 'system.settings_update' })
    expect('sourceRef' in omitted).toBe(false)
  })

  it('#8 dedupKey 刻意不设（MEDIUM-2：admin 事件与 audit 一对一不去重，dedup 策略 deferred ADR-195）', () => {
    for (const actionType of NOTIFICATION_ACTION_TYPES) {
      const emit = buildAuditNotificationEmit({ actionType, targetId: 't' })
      expect('dedupKey' in emit).toBe(false)
    }
  })

  it('#9 body 刻意不设（parity：现派生 list 无 body）', () => {
    for (const actionType of NOTIFICATION_ACTION_TYPES) {
      const emit = buildAuditNotificationEmit({ actionType, targetId: 't' })
      expect('body' in emit).toBe(false)
      expect('payload' in emit).toBe(false)
    }
  })

  it('#10 level 取值恒为 notifications DB CHECK 合法三值', () => {
    const valid = new Set(['info', 'warn', 'danger'])
    for (const actionType of NOTIFICATION_ACTION_TYPES) {
      expect(valid.has(buildAuditNotificationEmit({ actionType }).level)).toBe(true)
    }
  })

  it('#11 NotificationActionType 类型穷尽守护（编译期 union = 运行时元组）', () => {
    // 若未来枚举新增/删除某类但元组未同步，本断言 + Record 穷尽双重捕获
    const fromTuple: NotificationActionType[] = [...NOTIFICATION_ACTION_TYPES]
    expect(Object.keys(NOTIFICATION_TITLE_MAP).sort()).toEqual([...fromTuple].sort())
  })
})
