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
  // CHG-SN-6-14
  'crawler_site.create',
  'crawler_site.update',
  'crawler_site.delete',
  'crawler_site.batch',
  // CHG-SN-6-16-A
  'crawler_run.cancel',
  'crawler_run.pause',
  'crawler_run.resume',
  // CHG-SN-6-20-A
  'crawler.freeze',
  // CHG-SN-6-25-RETRO
  'crawler.auto_config',
  'crawler.stop_all',
  // CHG-SN-6-26-RETRO
  'crawler.reindex',
  'crawler.run_create',
  // CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2 / R-MID-1 系统化第 13 次
  'sources.route_action',
  // CHG-SN-7-REDO-01-F / ADR-123 / R-MID-1 系统化第 14 次
  'crawler_site.category_mapping_update',
  // CHG-SN-7-REDO-02-A / ADR-124 / R-MID-1 系统化第 15 次
  'user_submission.action',
  // CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139 / R-MID-1 系统化第 16 次
  'user.role_change',
  // CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140 / R-MID-1 系统化第 17 次（双 actionType）
  'user.email_change',
  'user.profile_update',
  // CHG-SN-8-FUP-AUDIT-ROLLBACK-EP / ADR-138 / R-MID-1 系统化第 19 次（audit-of-audit 追溯链）
  'system.audit_rollback',
  // CHG-SN-8-FUP-USERS-BAN-AUDIT / R-MID-1 系统化第 20 次（user 封禁 / 解封 audit）
  'user.ban',
  'user.unban',
  // CHG-SN-8-FUP-PRESET-TEAM-EP-A / ADR-144 / R-MID-1 系统化第 21-23 次（FilterPreset CRUD audit）
  'filter_preset.create',
  'filter_preset.update',
  'filter_preset.delete',
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
  'source_route',  // CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2
  'user_submission',  // CHG-SN-7-REDO-02-A / ADR-124
  'user',  // CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139
  'filter_preset',  // CHG-SN-8-FUP-PRESET-TEAM-EP-A / ADR-144（migration 072 CHECK 12→13）
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
