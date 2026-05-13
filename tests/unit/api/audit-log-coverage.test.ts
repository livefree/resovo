/**
 * audit-log-coverage.test.ts — admin_audit_log 覆盖率守卫
 *
 * 真源：M-SN-4 plan v1.4 §3.0.5（11 个 action_type 全覆盖硬约束）
 * 任务卡：CHG-SN-4-10-A2（audit 6 处补全 → 11/11）
 *
 * 守卫策略：扫描 apps/api/src 内所有 actionType: '...' 字面量，
 * 对照 plan §3.0.5 的 11 个 action_type 集合，缺一即 fail。
 *
 * 防回归：
 *   - 删除任意一处 audit 写入 → 守卫 fail
 *   - 新增 action_type 必须先改 plan + AdminAuditActionType union + 本测试
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// plan v1.4 §3.0.5 真源 + ADR-104（home_module.* 5 项扩枚举，CHG-SN-5-05/-06 落地，
// 中期审计 2026-05-12 CHG-SN-5-06-PATCH 同卡补 guard）— 与 packages/types AdminAuditActionType union 对齐
const REQUIRED_ACTION_TYPES = [
  // plan v1.4 §3.0.5（11 项）
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
  // ADR-104 扩枚举（5 项，home_modules admin API 协议，CHG-SN-5-05/-06 落地）
  'home_module.create',
  'home_module.update',
  'home_module.delete',
  'home_module.reorder',
  'home_module.publish_toggle',
] as const

const ACTION_TYPE_REGEX = /actionType:\s*['"]([a-z_.]+)['"]/g
const SCAN_ROOTS = [
  join(__dirname, '../../../apps/api/src/services'),
  join(__dirname, '../../../apps/api/src/routes/admin'),
]

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walk(full)
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      yield full
    }
  }
}

function collectActionTypes(): Set<string> {
  const found = new Set<string>()
  for (const root of SCAN_ROOTS) {
    for (const file of walk(root)) {
      const content = readFileSync(file, 'utf-8')
      for (const match of content.matchAll(ACTION_TYPE_REGEX)) {
        found.add(match[1])
      }
    }
  }
  return found
}

describe('admin_audit_log 覆盖率守卫（plan v1.4 §3.0.5）', () => {
  const found = collectActionTypes()

  it.each(REQUIRED_ACTION_TYPES)('action_type %s 在 apps/api/src 内有写入位点', (actionType) => {
    expect(
      found.has(actionType),
      `plan §3.0.5 要求 ${actionType} 必须有 audit log 写入位点；当前未在 apps/api/src/{services,routes/admin} 检测到。\n` +
      `修复：在对应 service/路由层添加 \`auditSvc.write({ actionType: '${actionType}', ... })\` 或 \`this.auditSvc.write({...})\`。`,
    ).toBe(true)
  })

  it('实际写入位点不超出 plan §3.0.5 已声明的 action_type 集合', () => {
    const allowed = new Set<string>(REQUIRED_ACTION_TYPES)
    const extra = [...found].filter((a) => !allowed.has(a))
    expect(
      extra,
      `检测到未在 plan §3.0.5 / AdminAuditActionType 声明的 action_type：${extra.join(', ')}\n` +
      `新增 action_type 必须先改 plan + packages/types AdminAuditActionType union + 本测试 REQUIRED_ACTION_TYPES。`,
    ).toEqual([])
  })

  it('总覆盖：plan §3.0.5 11 个 action_type 全部就位', () => {
    expect(found.size).toBeGreaterThanOrEqual(REQUIRED_ACTION_TYPES.length)
    for (const t of REQUIRED_ACTION_TYPES) expect(found.has(t)).toBe(true)
  })
})
