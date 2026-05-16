/**
 * audit-log-service-enums-set-equal.test.ts —
 * 直接 set-equal 守卫：AuditLogService.ACTION_TYPES / TARGET_KINDS 与
 * packages/types/admin-moderation.types.ts AdminAuditActionType / AdminAuditTargetKind 双真源一致性
 *
 * 来源：ultrareview P1-2（CHG-SN-6-AUDIT-DEBOUNCE-FIX）
 *
 * 背景：
 *   ADR-118 D-118-1 enums 端点反射策略（R-ADR-118-1 / R-ADR-118-4）：
 *   AuditLogService.ACTION_TYPES / TARGET_KINDS 常量与 admin-moderation.types.ts
 *   "手工对齐"；audit-log-coverage.test.ts 仅间接覆盖（扫源代码 actionType 字面量），
 *   不能直接保证 enums 与 union 类型严格一致。本测试补直接 set-equal 守卫。
 *
 * 失败处置：新增 action_type 或 target_kind 时必须同步更新：
 *   1. packages/types/src/admin-moderation.types.ts AdminAuditActionType / AdminAuditTargetKind union
 *   2. apps/api/src/services/AuditLogService.ts ACTION_TYPES / TARGET_KINDS 常量
 *   3. tests/unit/api/audit-log-coverage.test.ts PAYLOAD_REQUIRED / PAYLOAD_ASSERTION_EXEMPT 列表
 *   4. 本测试 EXPECTED_* 列表
 */
import { describe, it, expect } from 'vitest'
import { ACTION_TYPES, TARGET_KINDS } from '../../../apps/api/src/services/AuditLogService'

// 真源镜像：admin-moderation.types.ts AdminAuditActionType / AdminAuditTargetKind union
// 该 union 类型仅编译期存在，本测试硬编码镜像作为第 4 处真源副本；
// 任一不一致将直接 fail，迫使开发同步全 4 处。
const EXPECTED_ACTION_TYPES = [
  'video.approve',
  'video.reject_labeled',
  'video.staff_note',
  'video.visibility_patch',
  'video.reopen',
  'video.refetch_sources',
  'video_source.toggle',
  'video_source.disable_dead_batch',
  'staging.revert',
  'staging.publish',
  'staging.batch_publish',
  'home_module.create',
  'home_module.update',
  'home_module.delete',
  'home_module.reorder',
  'home_module.publish_toggle',
  'video.merge',
  'video.unmerge',
  'video.split',
  'source_line_alias.upsert',
  // CHG-SN-6-RETRO-3-A
  'system.cache_clear',
  'system.settings_update',
  'system.config_update',
  'system.sources_import',
] as const

const EXPECTED_TARGET_KINDS = [
  'video',
  'video_source',
  'staging',
  'review_label',
  'crawler_site',
  'system',
  'home_module',
  'source_line_alias',
] as const

describe('AuditLogService enums set-equal 守卫（ultrareview P1-2）', () => {
  it('ACTION_TYPES set 与 admin-moderation.types.ts AdminAuditActionType union 严格相等', () => {
    expect(new Set(ACTION_TYPES)).toEqual(new Set(EXPECTED_ACTION_TYPES))
    expect(ACTION_TYPES.length).toBe(EXPECTED_ACTION_TYPES.length)
  })

  it('TARGET_KINDS set 与 admin-moderation.types.ts AdminAuditTargetKind union 严格相等', () => {
    expect(new Set(TARGET_KINDS)).toEqual(new Set(EXPECTED_TARGET_KINDS))
    expect(TARGET_KINDS.length).toBe(EXPECTED_TARGET_KINDS.length)
  })

  it('ACTION_TYPES 无重复', () => {
    expect(new Set(ACTION_TYPES).size).toBe(ACTION_TYPES.length)
  })

  it('TARGET_KINDS 无重复', () => {
    expect(new Set(TARGET_KINDS).size).toBe(TARGET_KINDS.length)
  })
})
