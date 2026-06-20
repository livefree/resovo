/**
 * rollback-routes.ts — CHG-SN-8-GAPS-AUDIT-ROLLBACK
 *
 * audit_log actionType → 反向操作路由映射（消费层补齐 / 零新端点）
 *
 * 思路：通用回滚后端端点需起 ADR-138 + reverse_action 映射 + 跨表 schema 回滚（0.5-0.8w），
 *      本卡走消费层补齐 — 按 actionType 路由到对应业务页的已有反向操作，零后端改动。
 *      未支持的 actionType 返 { href: null, disabledReason } → 按钮 disabled + tooltip（H2 豁免）。
 *
 * follow-up：通用后端 endpoint 立 CHG-SN-8-FUP-AUDIT-ROLLBACK-EP（需先起 ADR-138）
 */

import type { AdminAuditLogListRow } from '@resovo/types'
import { buildMergeHref } from '@/lib/merge/entry'

export interface RollbackTarget {
  /** null 表示不支持回滚（按钮 disabled） */
  readonly href: string | null
  /** 按钮文案 */
  readonly label: string
  /** disabled 时的 tooltip / toast 文案 */
  readonly disabledReason?: string
}

/**
 * 解析 audit row 的回滚目标
 *
 * 设计原则：
 *   - 同业务页面已有反向 action 入口 → 拼 URL 跳过去（用户后续在页面内手动二次确认 + 反向 API）
 *   - 已存反向 audit actionType（如 video.unmerge ↔ video.merge）→ 跳合并页 merged tab
 *   - 不可回滚（采集/重扫/导入等只增不减操作）→ 返 disabled
 *   - 未知 actionType → fallback 跳目标记录详情页（user/video/source）
 */
export function resolveRollbackTarget(row: AdminAuditLogListRow): RollbackTarget {
  const { actionType, targetKind, targetId } = row

  switch (actionType) {
    // ── 视频审核反向（同 P-moderation 反向 action）────────────────
    case 'video.approve':
    case 'video.reject_labeled':
      return targetId
        ? {
            href: `/admin/moderation?id=${encodeURIComponent(targetId)}&action=reopen`,
            label: '回滚',
          }
        : { href: null, label: '回滚', disabledReason: '缺少 targetId' }

    case 'video.reopen':
      return targetId
        ? {
            href: `/admin/moderation?id=${encodeURIComponent(targetId)}`,
            label: '回滚',
          }
        : { href: null, label: '回滚', disabledReason: '缺少 targetId' }

    case 'video.staff_note':
      return targetId
        ? { href: `/admin/videos?edit=${encodeURIComponent(targetId)}`, label: '回滚' }
        : { href: null, label: '回滚', disabledReason: '缺少 targetId' }

    // ── 暂存 / 上架 ──────────────────────────────────────────────
    case 'staging.publish':
    case 'staging.batch_publish':
      return targetId
        ? { href: `/admin/staging?id=${encodeURIComponent(targetId)}&action=revert`, label: '回滚到暂存' }
        : { href: '/admin/staging', label: '查看暂存' }

    case 'staging.revert':
      return targetId
        ? { href: `/admin/moderation?id=${encodeURIComponent(targetId)}`, label: '重新审核' }
        : { href: null, label: '回滚', disabledReason: '缺少 targetId' }

    // ── 合并 / 拆分（CHG-VIR-13-A1：buildMergeHref 收口 + from=audit-rollback 回链）──
    case 'video.merge':
      return { href: buildMergeHref({ kind: 'tab', tab: 'merged', from: 'audit-rollback' }), label: '撤销合并' }
    case 'video.unmerge':
      return { href: buildMergeHref({ kind: 'tab', tab: 'merged', from: 'audit-rollback' }), label: '重新合并' }
    case 'video.split':
      return { href: buildMergeHref({ kind: 'tab', tab: 'split', from: 'audit-rollback' }), label: '撤销拆分' }

    // ── 视频源 toggle 反向 ───────────────────────────────────────
    case 'video_source.toggle':
    case 'video_source.disable_dead_batch':
      return targetId
        ? { href: `/admin/sources?videoId=${encodeURIComponent(targetId)}`, label: '回滚' }
        : { href: '/admin/sources', label: '查看 sources' }

    // ── 首页模块 ─────────────────────────────────────────────────
    case 'home_module.create':
    case 'home_module.update':
    case 'home_module.publish_toggle':
    case 'home_module.reorder':
    case 'home_module.delete':
      return { href: '/admin/home', label: '前往首页编辑' }

    // ── 用户投稿处理 ────────────────────────────────────────────
    case 'user_submission.action':
      return { href: '/admin/user-submissions', label: '查看投稿' }

    // ── 用户管理（角色 / 封禁等待 follow-up 完整反向）──────────
    // 当前 user.* actionType 未在前端常用范围，统一 fallback 用户列表
    // CHG-SN-8-FUP-AUDIT-USER-ROLLBACK 接入精确反向

    // ── 不可回滚（只增/异步任务）──────────────────────────────
    case 'crawler.run_create':
    case 'crawler.auto_config':
    case 'crawler.stop_all':
    case 'crawler.freeze':
    case 'crawler.reindex':
    case 'crawler_run.cancel':
    case 'crawler_run.pause':
    case 'crawler_run.resume':
    case 'crawler_site.create':
    case 'crawler_site.update':
    case 'crawler_site.delete':
    case 'crawler_site.batch':
    case 'crawler_site.category_mapping_update':
    case 'video.refetch_sources':
    case 'image_health.rescan':
    case 'image_health.switch_domain':
    case 'image_health.apply_candidate': // ADR-208 / IMGH-P2-1B：写 catalog + 异步入队，不可回滚
    case 'system.cache_clear':
    case 'system.config_update':
    case 'system.settings_update':
    case 'system.sources_import':
    case 'sources.route_action':
    case 'source_line_alias.upsert':
      return {
        href: null,
        label: '回滚',
        disabledReason: '此操作类型不可回滚（采集/重扫/导入等单向操作）',
      }

    default:
      // 未在映射表内的 actionType → fallback 跳目标记录详情
      return resolveTargetFallback(targetKind, targetId)
  }
}

function resolveTargetFallback(targetKind: string, targetId: string | null): RollbackTarget {
  if (!targetId) {
    return {
      href: null,
      label: '回滚',
      disabledReason: `actionType 未映射且 targetId 缺失`,
    }
  }
  switch (targetKind) {
    case 'video':
      return { href: `/admin/videos?edit=${encodeURIComponent(targetId)}`, label: '查看视频' }
    case 'video_source':
      return { href: '/admin/sources', label: '查看 sources' }
    case 'user':
      return { href: '/admin/users', label: '查看用户' }
    case 'home_module':
      return { href: '/admin/home', label: '查看首页' }
    default:
      return {
        href: null,
        label: '回滚',
        disabledReason: `actionType / targetKind 未映射`,
      }
  }
}
