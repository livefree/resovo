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
  // CHG-SN-6-20-A：全局采集冻结开关 audit 补齐（R-MID-1 系统化第 10 次）
  'crawler.freeze',             // POST /admin/crawler/freeze
  // CHG-SN-6-25-RETRO：autoCrawlConfig + stop-all audit 补齐（R-MID-1 系统化第 11 次）
  'crawler.auto_config',        // POST /admin/crawler/auto-config
  'crawler.stop_all',           // POST /admin/crawler/stop-all
  // CHG-SN-6-26-RETRO：reindex + runs 统一入口 audit 补齐（R-MID-1 系统化第 12 次）
  'crawler.reindex',            // POST /admin/crawler/reindex
  'crawler.run_create',         // POST /admin/crawler/runs
  // CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2：sources 域行级 3 mutations 合并 actionType
  'sources.route_action',       // POST/DELETE /admin/sources/routes/by-site/:siteKey/:sourceName[/test|/reprobe]
  // CHG-SN-7-REDO-01-F / ADR-123：站点分类映射 PUT 全量替换
  'crawler_site.category_mapping_update',
  // CHG-SN-7-REDO-02-A / ADR-124：用户投稿 4 路径合并 actionType（R-MID-1 第 15 次）
  'user_submission.action',
  // CHG-SN-7-MISC-IMAGE-1 / ADR-135：图片健康 rescan + domain 切换 audit（R-MID-1 第 16 次）
  'image_health.rescan',
  'image_health.switch_domain',
  // CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139：admin 改用户角色 audit（R-MID-1 第 17 次）
  'user.role_change',
  // CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140：admin 改邮箱 + 编辑资料 audit（R-MID-1 第 18 次）
  'user.email_change',
  'user.profile_update',
  // CHG-SN-8-FUP-AUDIT-ROLLBACK-EP / ADR-138：通用回滚 audit-of-audit 追溯链（R-MID-1 第 19 次）
  'system.audit_rollback',
  // CHG-SN-8-FUP-USERS-BAN-AUDIT：admin 封禁 / 解封用户 audit（R-MID-1 第 20 次）
  'user.ban',
  'user.unban',
  // CHG-SN-8-FUP-PRESET-TEAM-EP-A / ADR-144：FilterPreset CRUD audit（R-MID-1 第 21-23 次）
  'filter_preset.create',
  'filter_preset.update',
  'filter_preset.delete',
  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A / ADR-145：admin 手动添加视频（R-MID-1 第 24 次）
  'video.manual_add',
  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A / ADR-146：webhook 投递最终失败（R-MID-1 第 25 次）
  'system.webhook_send_failed',
  // CHG-SN-9-CW1-B-EP / ADR-151：task 级 cancel + batch（R-MID-1 第 26 次系统化）
  'crawler_task.cancel',         // POST /admin/crawler/tasks/:id/cancel
  'crawler_task.batch_cancel',   // POST /admin/crawler/tasks/batch-cancel
  // CHG-351-A / ADR-158：单源 inline probe + render-check 合并 actionType（R-MID-1 第 27 次系统化 / targetKind 复用 'video_source'）
  'video_source.inline_action',  // POST /admin/sources/:id/{probe,render-check}（afterJsonb.action 区分 'probe' / 'render_check'）
  // CHG-357 / ADR-158 AMENDMENT 2：视频级 batch（R-MID-1 第 28 次 / targetKind 'video'）
  'video_source.batch_inline_action',  // POST /admin/videos/:videoId/sources/{batch-probe,batch-render-check}
  // CHG-368-B-A2b / ADR-164 D-164-7：线路别名退役 + 优先级更新（R-MID-1 第 29-30 次系统化）
  'source_line_alias.retire',           // POST /admin/source-line-aliases/:siteKey/:sourceName/retire
  'source_line_alias.priority_update',  // PUT  /admin/source-line-aliases/:siteKey/:sourceName/priority
  // CHG-VIR-9-B / ADR-178 D-178-6：identity 候选人工拒绝（R-MID-1 第 31 次系统化）
  'identity_candidate.reject',          // POST /admin/identity-candidates/:id/reject
  // CHG-VIR-13-C1 / ADR-179 D-179-5：rejected 候选人工复活（R-MID-1 第 32 次系统化）
  'identity_candidate.revive',          // POST /admin/identity-candidates/:id/revive
  // CHG-HOME-PREVIEW-API-A / ADR-182 D-182-5：Home Curation 区块设置更新（R-MID-1 第 33 次系统化）
  'home_section.settings_update',       // PATCH /admin/home/sections/:section/settings
  // CHG-HOME-CARD-DND-A / ADR-182 D-182-4.6：区块排序门面（R-MID-1 第 34 次系统化；
  // 不嵌套触发 home_module.reorder——home_modules 排序回溯须联合两 actionType 查询）
  'home_section.reorder',               // POST /admin/home/sections/:section/reorder
  // CHG-HOME-AUTOFILL-REFRESH / ADR-182 D-182-4.7：手动触发候选重算（R-MID-1 第 35 次系统化；
  // 轻量载荷 afterJsonb 仅 { section, enqueuedAt }，快照本体属系统产物不计 audit）
  'home_section.refresh_candidates',    // POST /admin/home/sections/:section/refresh-candidates
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
  // CHG-SN-6-20-A：R-MID-1 第 10 次系统化（全局采集冻结开关）
  'crawler.freeze',
  // CHG-SN-6-25-RETRO：R-MID-1 第 11 次系统化（autoCrawlConfig + stop-all）
  'crawler.auto_config',
  'crawler.stop_all',
  // CHG-SN-6-26-RETRO：R-MID-1 第 12 次系统化（reindex + runs 统一入口）
  'crawler.reindex',
  'crawler.run_create',
  // CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2：sources 行级 3 mutations 合并 actionType
  'sources.route_action',
  // CHG-SN-7-REDO-01-F / ADR-123：站点分类映射 PUT 全量替换 audit 内容断言
  'crawler_site.category_mapping_update',
  // CHG-SN-7-REDO-02-A / ADR-124：用户投稿 4 路径 audit payload 内容断言
  'user_submission.action',
  // CHG-SN-7-MISC-IMAGE-1 / ADR-135：图片健康 rescan + domain 切换（R-MID-1 第 16 次）
  'image_health.rescan',
  'image_health.switch_domain',
  // CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139：admin 改用户角色 audit payload 内容断言（R-MID-1 第 17 次）
  'user.role_change',
  // CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140：admin 改邮箱 + 编辑资料 audit payload 内容断言（R-MID-1 第 18 次）
  'user.email_change',
  'user.profile_update',
  // CHG-SN-8-FUP-AUDIT-ROLLBACK-EP / ADR-138：通用回滚 audit-of-audit payload 内容断言（R-MID-1 第 19 次）
  'system.audit_rollback',
  // CHG-SN-8-FUP-USERS-BAN-AUDIT：admin 封禁 / 解封 audit payload 内容断言（R-MID-1 第 20 次）
  'user.ban',
  'user.unban',
  // CHG-SN-8-FUP-PRESET-TEAM-EP-A / ADR-144：FilterPreset CRUD audit payload 内容断言（R-MID-1 第 21-23 次）
  'filter_preset.create',
  'filter_preset.update',
  'filter_preset.delete',
  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A / ADR-145：admin 手动添加视频 audit payload 内容断言（R-MID-1 第 24 次）
  'video.manual_add',
  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A / ADR-146：webhook 投递最终失败 audit payload 内容断言（R-MID-1 第 25 次）
  'system.webhook_send_failed',
  // CHG-351-A / ADR-158：单源 inline probe + render-check audit payload 内容断言（R-MID-1 第 27 次 / 5 case / tests/unit/api/video-source-inline-action-audit.test.ts）
  'video_source.inline_action',
  // CHG-357 / ADR-158 AMENDMENT 2：视频级 batch audit payload 断言（R-MID-1 第 28 次 / tests/unit/api/video-source-batch-inline-action-audit.test.ts）
  'video_source.batch_inline_action',
  // CHG-368-B-A2b / ADR-164 D-164-7：线路别名退役 + 优先级更新 audit payload 内容断言（R-MID-1 第 29-30 次 / tests/unit/api/source-line-alias-retire-priority-audit.test.ts）
  'source_line_alias.retire',
  'source_line_alias.priority_update',
  // CHG-VIR-9-B / ADR-178 D-178-6：identity 候选人工拒绝 audit payload 内容断言（R-MID-1 第 31 次 / tests/unit/api/identity-candidates-reject.test.ts）
  'identity_candidate.reject',
  // CHG-VIR-13-C1 / ADR-179 D-179-5：rejected 候选人工复活 audit payload 内容断言（R-MID-1 第 32 次 / tests/unit/api/identity-decisions-revive.test.ts）
  'identity_candidate.revive',
  // CHG-HOME-PREVIEW-API-A / ADR-182 D-182-5：区块设置更新 audit payload 内容断言（R-MID-1 第 33 次 / tests/unit/api/admin-home-sections.test.ts）
  'home_section.settings_update',
  // CHG-HOME-CARD-DND-A / ADR-182 D-182-4.6：区块排序门面 audit payload 内容断言（R-MID-1 第 34 次 / tests/unit/api/admin-home-sections.test.ts）
  'home_section.reorder',
  // CHG-HOME-AUTOFILL-REFRESH / ADR-182 D-182-4.7：手动重算入队 audit payload 内容断言（R-MID-1 第 35 次 / tests/unit/api/admin-home-sections.test.ts）
  'home_section.refresh_candidates',
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
