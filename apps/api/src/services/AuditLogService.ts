/**
 * AuditLogService.ts — admin 写操作审计日志封装 + 读取（/admin/audit 视图）
 *
 * CHG-SN-4-05: write fire-and-forget（写失败不阻塞主操作，log warn）
 * CHG-SN-6-01: read 方法（list / detail / enums）服务 /admin/audit 视图
 *
 * ADR-118 §Service / queries 边界：
 *   - Route 零业务（参数解析 + Service 调用 + reply.send）
 *   - Service：zod 校验 + payloadSummary 提取 + ApiResponse 信封包装
 *   - DB queries：动态 WHERE 拼装 + LEFT JOIN users + COUNT(*) 并行
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import type {
  AdminAuditActionType,
  AdminAuditTargetKind,
  AdminAuditLogListRow,
  AdminAuditLogDetail,
  AdminAuditLogEnumsResult,
  ListAdminAuditLogsResult,
  ListAdminAuditLogsParams,
} from '@resovo/types'
import {
  insertAuditLog,
  listAdminAuditLog,
  getAdminAuditLogById,
  type WriteAuditLogInput,
  type AdminAuditLogQueryRow,
} from '@/api/db/queries/auditLog'
import { baseLogger } from '@/api/lib/logger'

export type { WriteAuditLogInput }

// ── enums 端点真源（编译时反射；ADR-118 D-118-1 + R-ADR-118-4） ─────
// 与 packages/types/admin-moderation.types.ts 真源**手工对齐**；新增 action_type
// 时必须同步更新此处（CI 守卫：
//   - audit-log-coverage.test.ts PAYLOAD_REQUIRED / EXEMPT 间接覆盖；
//   - audit-log-service-enums-set-equal.test.ts 直接 set-equal 守卫
//     （ultrareview P1-2 / CHG-SN-6-AUDIT-DEBOUNCE-FIX 沉淀））
export const ACTION_TYPES: readonly AdminAuditActionType[] = [
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
  // CHG-SN-6-RETRO-3-A：v1 写端点 audit 补齐
  'system.cache_clear',
  'system.settings_update',
  'system.config_update',
  'system.sources_import',
  // CHG-SN-6-14：CrawlerSite v1 写端点 audit 补齐
  'crawler_site.create',
  'crawler_site.update',
  'crawler_site.delete',
  'crawler_site.batch',
  // CHG-SN-6-16-A：CrawlerRun 行操作 audit 补齐
  'crawler_run.cancel',
  'crawler_run.pause',
  'crawler_run.resume',
  // CHG-SN-6-20-A：全局采集冻结开关 audit 补齐
  'crawler.freeze',
  // CHG-SN-6-25-RETRO：autoCrawlConfig + stop-all audit 补齐
  'crawler.auto_config',
  'crawler.stop_all',
  // CHG-SN-6-26-RETRO：reindex + runs 统一入口 audit 补齐
  'crawler.reindex',
  'crawler.run_create',
  // CHG-SN-7-REDO-01-E2 / ADR-117 AMENDMENT 2：sources 域行级 3 mutations 合并 actionType
  'sources.route_action',
  // CHG-SN-7-REDO-01-F / ADR-123：站点分类映射 PUT 全量替换
  'crawler_site.category_mapping_update',
  // CHG-SN-7-REDO-02-A / ADR-124：用户投稿 4 路径合并 actionType
  'user_submission.action',
  // CHG-SN-8-FUP-USERS-ROLE-INV-EP / ADR-139：admin 改用户角色（触发 session invalidate）
  'user.role_change',
  // CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140：admin 改邮箱 + 编辑资料
  'user.email_change',
  'user.profile_update',
  // CHG-SN-8-FUP-AUDIT-ROLLBACK-EP / ADR-138：admin 通用回滚 audit（形成 audit-of-audit 追溯链）
  'system.audit_rollback',
  // CHG-SN-8-FUP-USERS-BAN-AUDIT：admin 封禁 / 解封用户 audit（R-MID-1 第 20 次系统化）
  'user.ban',
  'user.unban',
  // CHG-SN-8-FUP-PRESET-TEAM-EP-A / ADR-144：FilterPreset CRUD 审计（R-MID-1 第 21-23 次系统化）
  'filter_preset.create',
  'filter_preset.update',
  'filter_preset.delete',
  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A / ADR-145：admin 手动添加视频（R-MID-1 第 24 次系统化）
  'video.manual_add',
  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A / ADR-146：webhook 投递最终失败（R-MID-1 第 25 次系统化）
  'system.webhook_send_failed',
  // CHG-351-A / ADR-158：单源 inline probe + render-check 合并 actionType（R-MID-1 第 27 次系统化 / targetKind 复用 'video_source'）
  'video_source.inline_action',
]
export const TARGET_KINDS: readonly AdminAuditTargetKind[] = [
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
]

// ── zod schema（ADR-118 §端点契约 + D-118-3） ────────────────────────

const ActionTypeEnum = z.enum(ACTION_TYPES as [AdminAuditActionType, ...AdminAuditActionType[]])
const TargetKindEnum = z.enum(TARGET_KINDS as [AdminAuditTargetKind, ...AdminAuditTargetKind[]])

export const ListAdminAuditLogsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    actorId: z.string().uuid().optional(),
    actionType: ActionTypeEnum.optional(),
    targetKind: TargetKindEnum.optional(),
    targetId: z.string().uuid().optional(),
    requestId: z.string().max(200).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    // sub 2 EXTEND（2026-05-24）：sort 字段白名单 enum + 方向
    sortField: z.enum(['createdAt']).optional(),
    sortDirection: z.enum(['asc', 'desc']).optional(),
  })
  .refine(v => !v.targetId || v.targetKind, {
    message: 'targetId 必须配合 targetKind 联用',
    path: ['targetId'],
  })
  .refine(v => !v.from || !v.to || v.from <= v.to, {
    message: 'from 必须 ≤ to',
    path: ['from'],
  })

export const GetAdminAuditLogDetailSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id 必须为 bigserial 数字字符串'),
})

// ── payload summary 提取（ADR-118 D-118-2 / D-118-10 / R-ADR-118-1） ─

const SUMMARY_MAX_LEN = 256

function clip(str: string): string {
  return str.length <= SUMMARY_MAX_LEN ? str : `${str.slice(0, SUMMARY_MAX_LEN - 1)}…`
}

/**
 * 提取 audit payload 摘要。
 * - target_id NULL（batch action）→ "批量 N 项 (action_type)" 或 jsonb.ids 数组长度
 * - 其他 → 优先抽 before/after_jsonb 中 1-3 个关键字段；无字段 → 空串
 *
 * 实现哲学：尽量短 + 信息密度高；新增 action_type 时由 PAYLOAD_REQUIRED 守卫触发更新。
 */
export function extractAuditPayloadSummary(
  actionType: AdminAuditActionType,
  targetId: string | null,
  beforeJsonb: Readonly<Record<string, unknown>> | null,
  afterJsonb: Readonly<Record<string, unknown>> | null,
): string | null {
  // batch action：targetId NULL + jsonb 含 ids 数组
  if (targetId === null) {
    const ids = (afterJsonb?.ids ?? beforeJsonb?.ids) as unknown
    if (Array.isArray(ids)) {
      return clip(`批量 ${ids.length} 项 (${actionType})`)
    }
    return clip(`批量操作 (${actionType})`)
  }

  // 单 target：抽 after 优先，after 缺 abuse before；抽前 3 个 string/number 字段
  const source = afterJsonb ?? beforeJsonb
  if (!source) return null

  const parts: string[] = []
  let count = 0
  for (const [k, v] of Object.entries(source)) {
    if (count >= 3) break
    if (v === null || v === undefined) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      const valStr = typeof v === 'string' ? v : String(v)
      parts.push(`${k}=${valStr.length > 64 ? `${valStr.slice(0, 63)}…` : valStr}`)
      count++
    }
  }
  if (parts.length === 0) return null
  return clip(parts.join(' · '))
}

// ── Row 映射（query 层 → 类型层；camelCase 透传） ────────────────────

function toListRow(row: AdminAuditLogQueryRow): AdminAuditLogListRow {
  return {
    id: row.id,
    actorId: row.actorId,
    actorUsername: row.actorUsername,
    actionType: row.actionType,
    targetKind: row.targetKind,
    targetId: row.targetId,
    requestId: row.requestId,
    createdAt: row.createdAt,
    payloadSummary: extractAuditPayloadSummary(
      row.actionType,
      row.targetId,
      row.beforeJsonb,
      row.afterJsonb,
    ),
  }
}

function toDetail(row: AdminAuditLogQueryRow & { ipHash?: string | null }): AdminAuditLogDetail {
  return {
    ...toListRow(row),
    beforeJsonb: row.beforeJsonb,
    afterJsonb: row.afterJsonb,
    ipHash: row.ipHash ?? null,
  }
}

// ── Service ──────────────────────────────────────────────────────────

export class AuditLogService {
  constructor(private db: Pool) {}

  write(input: WriteAuditLogInput): void {
    insertAuditLog(this.db, input).catch((err: unknown) => {
      baseLogger.warn({ err, actionType: input.actionType }, '[AuditLogService] audit write failed')
    })
  }

  async listAdminAuditLogs(params: ListAdminAuditLogsParams): Promise<ListAdminAuditLogsResult> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const { rows, total } = await listAdminAuditLog(this.db, {
      page,
      limit,
      actorId: params.actorId,
      actionType: params.actionType,
      targetKind: params.targetKind,
      targetId: params.targetId,
      requestId: params.requestId,
      from: params.from,
      to: params.to,
      // sub 2 EXTEND（2026-05-24）：透传 sort 参数到 queries
      sortField: params.sortField,
      sortDirection: params.sortDirection,
    })
    return {
      rows: rows.map(toListRow),
      total,
      page,
      limit,
    }
  }

  async getAdminAuditLogDetail(id: string): Promise<AdminAuditLogDetail | null> {
    const row = await getAdminAuditLogById(this.db, id)
    if (!row) return null
    return toDetail(row)
  }

  getAdminAuditEnums(): AdminAuditLogEnumsResult {
    return {
      actionTypes: ACTION_TYPES,
      targetKinds: TARGET_KINDS,
    }
  }
}
