/**
 * audit-action-labels.ts — admin_audit_log.action_type 37 项中文 label 映射
 *
 * ADR-141 D-141-2：actionType label 由前端 i18n 承担（与后端解耦）
 * 真源：packages/types/src/admin-moderation.types.ts AdminAuditActionType union
 *
 * 维护约定：新增 actionType 时同步更新此映射（CLAUDE.md schema 同步约束延伸）。
 * 消费方：
 *   - apps/server-next/src/lib/dashboard-data.ts（RecentActivityCard `what` 文案）
 *   - apps/server-next/src/app/admin/audit/_client/AuditColumns.tsx（可选迁移；当前用 moderation.ts M.history.action 部分集）
 *
 * Fallback：消费方应用 `AUDIT_ACTION_LABELS[type] ?? type` 模式（缺失时展示原始 key 而非空白）。
 */

export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  // ── plan v1.4 §3.0.5 legacy 11 项 ──────────────────────────────────
  'video.approve':                   '审核通过',
  'video.reject_labeled':            '审核拒绝',
  'video.staff_note':                '编辑备注',
  'video.visibility_patch':          '可见性变更',
  'video.reopen':                    '重新打开',
  'video.refetch_sources':           '触发线路重爬',
  'video_source.toggle':             '线路启用 / 禁用',
  'video_source.disable_dead_batch': '批量禁用失效线路',
  'staging.revert':                  '撤回到暂存',
  'staging.publish':                 '上架',
  'staging.batch_publish':           '批量上架',

  // ── ADR-104 home_modules 5 项 ─────────────────────────────────────
  'home_module.create':              '首页模块创建',
  'home_module.update':              '首页模块更新',
  'home_module.delete':              '首页模块删除',
  'home_module.reorder':             '首页模块排序',
  'home_module.publish_toggle':      '首页模块发布开关',

  // ── ADR-105 video merge/split/unmerge 3 项 ────────────────────────
  'video.merge':                     '合并视频',
  'video.unmerge':                   '撤销合并',
  'video.split':                     '拆分视频',

  // ── ADR-117 source_line_alias 1 项 ────────────────────────────────
  'source_line_alias.upsert':        '线路别名更新',

  // ── CHG-SN-6-RETRO-3-A v1 写端点 4 项 ─────────────────────────────
  'system.cache_clear':              '清除缓存',
  'system.settings_update':          '站点设置更新',
  'system.config_update':            '系统配置更新',
  'system.sources_import':           '源批量导入',

  // ── CHG-SN-6-14 CrawlerSite 4 项 ──────────────────────────────────
  'crawler_site.create':             '采集站点创建',
  'crawler_site.update':             '采集站点更新',
  'crawler_site.delete':             '采集站点删除',
  'crawler_site.batch':              '采集站点批量操作',

  // ── CHG-SN-6-16-A CrawlerRun 行操作 3 项 ──────────────────────────
  'crawler_run.cancel':              '采集任务取消',
  'crawler_run.pause':               '采集任务暂停',
  'crawler_run.resume':              '采集任务恢复',

  // ── CHG-SN-6-20-A 全局采集冻结 ────────────────────────────────────
  'crawler.freeze':                  '全局采集冻结',

  // ── CHG-SN-6-25-RETRO autoCrawl + stop-all ────────────────────────
  'crawler.auto_config':             '自动采集配置',
  'crawler.stop_all':                '全站采集停止',

  // ── CHG-SN-6-26-RETRO reindex + run_create ────────────────────────
  'crawler.reindex':                 '搜索索引重建',
  'crawler.run_create':              '采集任务创建',

  // ── CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2 ────────────────────
  'sources.route_action':            '线路操作',

  // ── CHG-SN-7-REDO-01-F / ADR-123 ──────────────────────────────────
  'crawler_site.category_mapping_update': '站点分类映射更新',

  // ── CHG-SN-7-REDO-02-A / ADR-124 ──────────────────────────────────
  'user_submission.action':          '用户投稿处理',

  // ── CHG-SN-7-MISC-IMAGE-1 / ADR-135 ──────────────────────────────
  'image_health.rescan':             '图片健康重扫',
  'image_health.switch_domain':      '图片 CDN 域切换',

  // ── CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139 ─────────────────────
  'user.role_change':                '修改用户角色',

  // ── CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140 ─────────────────────────
  'user.email_change':               '修改用户邮箱',
  'user.profile_update':             '修改用户资料',

  // ── CHG-SN-8-FUP-AUDIT-ROLLBACK-EP / ADR-138 ─────────────────────
  'system.audit_rollback':           '审计回滚',
}

/**
 * 根据 actionType 派生 severity（dashboard activities 视觉分级；ADR-141 §6 前端规则）
 *
 * - reject / fail / delete / freeze / stop / cancel → warn
 * - 极端破坏类（无典型例，预留）→ danger
 * - 其余 → info
 *
 * N1-141-2: 后端化 severity 评估按需启动；当前规则简单足够。
 */
export function deriveActivitySeverity(actionType: string): 'info' | 'warn' | 'danger' {
  if (
    actionType.includes('reject') ||
    actionType.includes('delete') ||
    actionType.includes('freeze') ||
    actionType.includes('stop') ||
    actionType.includes('cancel')
  ) {
    return 'warn'
  }
  // 当前无 danger 触发条件；保留为未来批量 + 规模判定扩展点
  return 'info'
}
