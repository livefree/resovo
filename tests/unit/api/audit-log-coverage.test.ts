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
// 中期审计 2026-05-12 CHG-SN-5-06-PATCH 同卡补 guard）
// + ADR-105（video.merge / video.unmerge / video.split 3 项扩枚举，CHG-SN-5-10 落地）
// + ADR-117（source_line_alias.upsert 1 项，CHG-SN-5-11-PATCH 落地）
// — 与 packages/types AdminAuditActionType union 对齐
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
  // ADR-105 扩枚举（3 项，video merge/split/unmerge admin API 协议，CHG-SN-5-10 落地）
  'video.merge',
  'video.unmerge',
  'video.split',
  // ADR-117 扩枚举（1 项，source_line_alias upsert 协议，CHG-SN-5-11-PATCH 落地）
  'source_line_alias.upsert',
  // CHG-SN-6-RETRO-3-A：v1 写端点 audit 补齐（ultrareview P0-3 / R-MID-1 系统化第 6 次）
  'system.cache_clear',         // DELETE /admin/cache/:type
  'system.settings_update',     // POST /admin/system/settings
  'system.config_update',       // POST /admin/system/config
  'system.sources_import',      // POST /admin/import/sources
  // CHG-SN-6-14：CrawlerSite v1 写端点 audit 补齐（R-MID-1 系统化第 8 次）
  'crawler_site.create',        // POST /admin/crawler/sites
  'crawler_site.update',        // PATCH /admin/crawler/sites/:key
  'crawler_site.delete',        // DELETE /admin/crawler/sites/:key
  'crawler_site.batch',         // POST /admin/crawler/sites/batch
  // CHG-SN-6-16-A：CrawlerRun 行操作 audit 补齐（R-MID-1 系统化第 9 次）
  'crawler_run.cancel',         // POST /admin/crawler/runs/:id/cancel
  'crawler_run.pause',          // POST /admin/crawler/runs/:id/pause
  'crawler_run.resume',         // POST /admin/crawler/runs/:id/resume
] as const

const ACTION_TYPE_REGEX = /actionType:\s*['"]([a-z_.]+)['"]/g
const SCAN_ROOTS = [
  join(__dirname, '../../../apps/api/src/services'),
  join(__dirname, '../../../apps/api/src/routes/admin'),
]

// CHG-SN-5-CHECKLIST-AUDIT-2 P0-1：R-MID-1 教训第 6 次系统化首次以代码守卫形式落地
// ADR 后新增 9 项 actionType（home_module.* 5 + video.merge/split/unmerge 3 + source_line_alias.upsert 1）
// 强制要求对应 service test 含 audit payload 内容显式断言（参 sources-matrix-service.test.ts 模板）。
// M-SN-4 legacy 11 项（plan v1.4 §3.0.5）advisory 豁免，由 M-SN-6 收尾卡 RETROACTIVE 承担补齐。
const PAYLOAD_ASSERTION_REQUIRED = [
  // ADR-104 home_modules
  'home_module.create',
  'home_module.update',
  'home_module.delete',
  'home_module.reorder',
  'home_module.publish_toggle',
  // ADR-105 video merge/split/unmerge
  'video.merge',
  'video.unmerge',
  'video.split',
  // ADR-117 source_line_alias
  'source_line_alias.upsert',
  // CHG-SN-6-RETRO-3-A：v1 写端点 audit 补齐（route-level test 含 payload 内容断言）
  'system.cache_clear',
  'system.settings_update',
  'system.config_update',
  'system.sources_import',
  // CHG-SN-6-10：R-MID-1 第 7 次系统化 / plan §3.0.5 legacy 11 项 EXEMPT 补齐
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
  // CHG-SN-6-14：R-MID-1 第 8 次系统化（CrawlerSite v1 端点）
  'crawler_site.create',
  'crawler_site.update',
  'crawler_site.delete',
  'crawler_site.batch',
  // CHG-SN-6-16-A：R-MID-1 第 9 次系统化（CrawlerRun 行操作）
  'crawler_run.cancel',
  'crawler_run.pause',
  'crawler_run.resume',
] as const

// CHG-SN-6-10：plan v1.4 §3.0.5 M-SN-4 legacy 11 项已迁移至 PAYLOAD_ASSERTION_REQUIRED
// （R-MID-1 第 7 次系统化 / EXEMPT → REQUIRED 收尾闭环）；EXEMPT 名单清零
const PAYLOAD_ASSERTION_EXEMPT: readonly string[] = [] as const

const TEST_DIRS = [join(__dirname, '..')]

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

  it('总覆盖：plan §3.0.5 + ADR-104 + ADR-105 + ADR-117 20 个 action_type 全部就位', () => {
    expect(found.size).toBeGreaterThanOrEqual(REQUIRED_ACTION_TYPES.length)
    for (const t of REQUIRED_ACTION_TYPES) expect(found.has(t)).toBe(true)
  })

  // CHG-SN-5-CHECKLIST-AUDIT-2 P0-1：R-MID-1 教训第 6 次系统化（首次代码守卫形式）
  // 扫 tests/unit/api 内所有 .test.ts 内 audit payload 内容断言模式：
  //   expect(...write).toHaveBeenCalledWith(expect.objectContaining({
  //     actionType: '<actionType>', targetKind, targetId, beforeJsonb?, afterJsonb?, ...
  //   }))
  // ADR 后新增 9 项 actionType 强制；M-SN-4 legacy 11 项豁免（PAYLOAD_ASSERTION_EXEMPT）
  describe('R-MID-1 audit payload 内容断言守卫（CHG-SN-5-CHECKLIST-AUDIT-2 P0-1）', () => {
    function* walkTests(dir: string): Generator<string> {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) yield* walkTests(full)
        else if (full.endsWith('.test.ts')) yield full
      }
    }

    function collectAssertedActionTypes(): Set<string> {
      const asserted = new Set<string>()
      for (const root of TEST_DIRS) {
        for (const file of walkTests(root)) {
          const content = readFileSync(file, 'utf-8')
          // 文件内含 expect.objectContaining + actionType: 'xxx' 即认为有断言。
          // 严格的 AST 比对工程量大，对 grep 守卫"是否在同一 expect.objectContaining 块内"
          // 用启发式：actionType 字面量在文件内必须距离最近的 `expect.objectContaining` 调用 ≤ 500 字符（同行或紧邻行）。
          // 误报代价低（只会要求消费方补断言）；漏报代价高（让 R-MID-1 教训失守）→ 选择倾向不漏报。
          const objContainingRe = /expect\.objectContaining\(/g
          const actionTypeRe = /actionType:\s*['"]([a-z_.]+)['"]/g
          const objContainingPositions: number[] = []
          for (const m of content.matchAll(objContainingRe)) {
            objContainingPositions.push(m.index!)
          }
          for (const m of content.matchAll(actionTypeRe)) {
            const pos = m.index!
            // 同一 expect.objectContaining 块内：actionType 在 objectContaining 之后 ≤ 500 字符
            for (const ocPos of objContainingPositions) {
              if (pos >= ocPos && pos - ocPos <= 500) {
                asserted.add(m[1])
                break
              }
            }
          }
        }
      }
      return asserted
    }

    const asserted = collectAssertedActionTypes()

    it.each(PAYLOAD_ASSERTION_REQUIRED)(
      'actionType %s 必有对应 service test 含 audit payload 内容断言（R-MID-1 教训）',
      (actionType) => {
        expect(
          asserted.has(actionType),
          `R-MID-1 教训：actionType '${actionType}' 缺 service test audit payload 内容断言。\n` +
          `修复：在对应 service test 内加 \`expect(...auditSvc.write).toHaveBeenCalledWith(expect.objectContaining({ actionType: '${actionType}', targetKind, targetId, beforeJsonb, afterJsonb }))\`\n` +
          `参 \`tests/unit/api/sources-matrix-service.test.ts\` upsertLineAlias INSERT/UPDATE 双路径模板。`,
        ).toBe(true)
      },
    )

    it('M-SN-4 legacy 11 项已收尾迁移至 PAYLOAD_ASSERTION_REQUIRED（CHG-SN-6-10 / R-MID-1 第 7 次系统化）', () => {
      // EXEMPT 清零 = R-MID-1 协议级硬清单完整闭环
      expect(PAYLOAD_ASSERTION_EXEMPT.length).toBe(0)
    })
  })
})
