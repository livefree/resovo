/**
 * AuditRollbackService.ts — ADR-138 / CHG-SN-8-FUP-AUDIT-ROLLBACK-EP
 *
 * 通用 admin_audit_log 回滚 Service：方案 D 混合策略
 *   - 简单 UPDATE 类 actionType → JSONB diff 反向 UPDATE（白名单约束）
 *   - 复杂业务操作 → reverse_handler 注册扩展点（首期空，N1-138-1 渐进注册）
 *   - 不可回滚的单向操作 → UNSUPPORTED_ACTION_TYPES Set
 *
 * 失败处置（ADR-138 D-138-4）：
 *   - F-1 actionType 不可回滚 → 422 AUDIT_ROLLBACK_UNSUPPORTED
 *   - F-2 stale (after_jsonb 与当前 DB 不一致) → 409 AUDIT_ROLLBACK_STALE
 *   - F-3 schema drift (字段过滤后为空) → 422 AUDIT_ROLLBACK_SCHEMA_DRIFT
 *   - F-4 二次回滚 (system.audit_rollback) → 422 AUDIT_ROLLBACK_UNSUPPORTED
 *   - F-5 audit_log 行不存在 → 404 NOT_FOUND
 *   - F-6 target_id NULL (batch) → 422 AUDIT_ROLLBACK_UNSUPPORTED
 *   - F-7 before_jsonb NULL (CREATE 类) → 422 AUDIT_ROLLBACK_UNSUPPORTED
 *   - F-8 目标业务行不存在 / soft-deleted → 404 NOT_FOUND
 *
 * SQL 注入防护（D-138-5）：tableName / column 名称从编译时白名单取，不接受用户输入。
 */

import type { Pool, PoolClient } from 'pg'
import type { AdminAuditActionType, AdminAuditTargetKind } from '@resovo/types'

import { AppError } from '@/api/lib/errors'
import {
  rollbackAuditLogTarget,
  selectCurrentRowForRollback,
  insertAuditLogInTransaction,
  getAdminAuditLogById,
} from '@/api/db/queries/auditLog'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'
import { buildAuditNotificationEmit } from '@/api/services/notification-audit-emit'

// ── 配置常量 ─────────────────────────────────────────────────────────

/**
 * target_kind → 业务表元数据映射。
 * D-138-5：无对应单一表的 target_kind（system / source_route / image_health）不在此 Map 中，
 * 这些 target_kind 的 actionType 必须在 UNSUPPORTED_ACTION_TYPES 中或注册 reverse_handler。
 */
interface TargetTableMeta {
  readonly tableName: string
  readonly primaryKeyColumn: string
  /** null = 该表无软删除列（不加 WHERE deleted_at IS NULL 守卫） */
  readonly softDeleteColumn: string | null
}

export const TARGET_KIND_TABLE_MAP: Readonly<Partial<Record<AdminAuditTargetKind, TargetTableMeta>>> = {
  video:             { tableName: 'videos',                primaryKeyColumn: 'id',  softDeleteColumn: 'deleted_at' },
  video_source:      { tableName: 'video_sources',         primaryKeyColumn: 'id',  softDeleteColumn: 'deleted_at' },
  staging:           { tableName: 'videos',                primaryKeyColumn: 'id',  softDeleteColumn: 'deleted_at' },
  home_module:       { tableName: 'home_modules',          primaryKeyColumn: 'id',  softDeleteColumn: null },  // 实证 schema 无 deleted_at 列（hard delete）— CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS 修
  crawler_site:      { tableName: 'crawler_sites',         primaryKeyColumn: 'key', softDeleteColumn: 'deleted_at' },
  user:              { tableName: 'users',                 primaryKeyColumn: 'id',  softDeleteColumn: 'deleted_at' },
  source_line_alias: { tableName: 'source_line_aliases',   primaryKeyColumn: 'id',  softDeleteColumn: null },
  user_submission:   { tableName: 'user_submissions',      primaryKeyColumn: 'id',  softDeleteColumn: null },
  review_label:      { tableName: 'review_labels',         primaryKeyColumn: 'id',  softDeleteColumn: null },
  // 未列出（无单一表）：system / source_route / image_health → 入 UNSUPPORTED
}

/**
 * 字段白名单（D-138-5）：每个 target_kind 允许 audit log 回滚的字段集。
 * 防 password_hash / role / deleted_at 等敏感/结构字段被 audit log 注入回滚。
 *
 * 维护约定：业务表新增列时同步更新此白名单（CLAUDE.md schema 同步约束延伸）。
 */
export const FIELD_WHITELIST: Readonly<Partial<Record<AdminAuditTargetKind, ReadonlySet<string>>>> = {
  video: new Set([
    'staff_note', 'review_status', 'is_published', 'is_visible',
    'meta_score', 'title', 'review_label_id',
    // 显式排除：deleted_at / created_at / catalog_id（结构列）
  ]),
  video_source: new Set([
    'is_enabled', 'status', 'staff_note',
  ]),
  staging: new Set([
    'review_status',
  ]),
  home_module: new Set([
    'title', 'subtitle', 'type', 'config', 'is_published',
    'sort_order', 'brand_slug',
  ]),
  crawler_site: new Set([
    'name', 'api_url', 'is_enabled', 'schedule_mode', 'priority',
  ]),
  user: new Set([
    // ADR-138 §D-138-5 示例 2：明确排除 password_hash / role / role_changed_at / banned_at / deleted_at
    'email', 'display_name', 'locale', 'avatar_url',
  ]),
  source_line_alias: new Set([
    'display_name', 'priority',
  ]),
  user_submission: new Set([
    'status',
  ]),
  review_label: new Set([
    'name', 'description', 'is_active', 'sort_order',
  ]),
}

/**
 * 不可自动回滚 actionType（D-138-4 F-1/F-4/F-6/F-7 + N1-138-1 首期建议）。
 *
 * 包含：
 *   - 24 项原 ADR-138 §11 不可回滚清单（采集/系统/batch/复杂多表）
 *   - 8 项 N1-138-1 建议「需注册 handler」首期入 UNSUPPORTED：
 *     • user.role_change（需 session invalidate 联动）
 *     • home_module.create / home_module.delete（CREATE/DELETE 反向语义）
 *     • system.settings_update / system.config_update（嵌套 JSON）
 *     • crawler_site.create / crawler_site.delete（同 home_module）
 *     • video.approve / video.reject_labeled（review_status 状态机；首期暂入待 P1 handler）
 *     • video.reopen（同上）
 *
 * 注：未列出的 actionType 走通用路径（前提 target_kind 在 TARGET_KIND_TABLE_MAP 中）。
 */
export const UNSUPPORTED_ACTION_TYPES: ReadonlySet<AdminAuditActionType> = new Set<AdminAuditActionType>([
  // 系统单向
  'system.cache_clear',
  'system.sources_import',
  'system.audit_rollback',     // D-138-4 F-4：禁止二次回滚
  'system.settings_update',    // N1-138-1：嵌套 JSON 需 handler
  'system.config_update',      // N1-138-1：同上
  // 采集状态控制
  'crawler.freeze',
  'crawler.run_create',
  'crawler.auto_config',
  'crawler.stop_all',
  'crawler.reindex',
  'crawler_run.cancel',
  'crawler_run.pause',
  'crawler_run.resume',
  // batch 操作（target_id NULL）
  'crawler_site.batch',
  'staging.batch_publish',
  'video_source.disable_dead_batch',
  // 异步触发
  'video.refetch_sources',
  'image_health.rescan',
  'image_health.switch_domain',
  'image_health.apply_candidate', // ADR-208 / IMGH-P2-1B：写 catalog + 异步入队巡检，不可回滚
  'image_health.resolve_event',   // ADR-209 D-209-2 / IMGH-P2-1C：批量标记事件已解决，不可回滚
  // 复杂多表 / 状态机（首期入 UNSUPPORTED，N1-138-1 P1/P2/P3 后续注册 handler）
  'sources.route_action',
  'source_line_alias.upsert',
  'video.merge',
  'video.unmerge',
  'video.split',
  'staging.publish',
  'crawler_site.category_mapping_update',
  // CREATE/DELETE 反向语义（首期入 UNSUPPORTED，N1-138-1 P2 后续注册 handler）
  'home_module.create',
  'home_module.delete',
  'crawler_site.create',
  'crawler_site.delete',
  // 状态机敏感（reopen 暂入 UNSUPPORTED — reopen 反向是 approve/reject 二选一需上下文）
  // video.approve + video.reject_labeled handler 已注册（CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS N1-138-1 P1）
  'video.reopen',
  // 用户角色变更（需 session invalidate 联动，N1-138-1 P1+ 注册 handler）
  'user.role_change',
  // 整页发布治理（CHG-HOME-AUDIT-ROLLBACK / ADR-185 D-185-3.4 显式防御）：
  // 版本回滚 = 配置三表整页恢复（专用 POST /admin/home/versions/:n/rollback，
  // roll-forward 自记新版本），与本行级链操作对象不同——不依赖
  // 「TARGET_KIND_TABLE_MAP 缺 home_page」隐式兜底（未来加表映射会破防）
  'home_page.publish',
  'home_page.rollback',
])

/**
 * reverse_handler 注册扩展点（N1-138-1 渐进注册）。
 * 首期空 Map；后续 CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS 按 P1/P2/P3 注册。
 */
export interface RollbackContext {
  readonly auditLogId: string
  readonly actorId: string
  readonly actionType: AdminAuditActionType
  readonly targetKind: AdminAuditTargetKind
  readonly targetId: string | null
  readonly beforeJsonb: Record<string, unknown> | null
  readonly afterJsonb: Record<string, unknown> | null
}

export type ReverseHandler = (
  client: PoolClient,
  context: RollbackContext,
) => Promise<{ warnings?: readonly string[] }>

// ── ADR-138 N1-138-1 P1 / CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS ────
//
// video.approve / video.reject_labeled reverse_handler：
//   admin 强制反向是 audit rollback 语义；不走 ModerationService.reopen /
//   transitionVideoState（避免嵌套事务问题）；直接同事务 client 用 UPDATE
//   SQL 实现反向（review_status 回 'pending_review'，reject 额外清 label_id）；
//   audit 仅走 system.audit_rollback（不双写 video.reopen 避免追溯链膨胀）

async function rollbackVideoApproveHandler(
  client: PoolClient,
  context: RollbackContext,
): Promise<{ warnings?: readonly string[] }> {
  if (!context.targetId) {
    throw new AppError(
      'AUDIT_ROLLBACK_UNSUPPORTED',
      `video.approve 回滚需要 target_id（当前为 null）`,
      422,
    )
  }
  const result = await client.query(
    `UPDATE videos SET review_status = 'pending_review'
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
    [context.targetId],
  )
  if ((result.rowCount ?? 0) === 0) {
    throw new AppError('NOT_FOUND', '目标视频不存在或已删除', 404)
  }
  return {}
}

async function rollbackVideoRejectLabeledHandler(
  client: PoolClient,
  context: RollbackContext,
): Promise<{ warnings?: readonly string[] }> {
  if (!context.targetId) {
    throw new AppError(
      'AUDIT_ROLLBACK_UNSUPPORTED',
      `video.reject_labeled 回滚需要 target_id（当前为 null）`,
      422,
    )
  }
  const result = await client.query(
    `UPDATE videos SET review_status = 'pending_review', review_label_id = NULL
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
    [context.targetId],
  )
  if ((result.rowCount ?? 0) === 0) {
    throw new AppError('NOT_FOUND', '目标视频不存在或已删除', 404)
  }
  return {}
}

export const ROLLBACK_HANDLER_REGISTRY: Map<AdminAuditActionType, ReverseHandler> = new Map<AdminAuditActionType, ReverseHandler>([
  ['video.approve', rollbackVideoApproveHandler],
  ['video.reject_labeled', rollbackVideoRejectLabeledHandler],
])

// ── 结果类型 ─────────────────────────────────────────────────────────

export interface RollbackResult {
  readonly rolledBack: true
  readonly rollbackAuditLogId: string
  readonly warnings?: readonly string[]
}

// ── Service ──────────────────────────────────────────────────────────

export class AuditRollbackService {
  // NTLG-P1-c-B-2：解耦双写 emit 中枢（走 this.db 独立 Pool 连接，非事务 client）
  private readonly notificationEmitter = new NotificationEmitter(this.db)

  constructor(private readonly db: Pool) {}

  /**
   * 回滚单条 audit_log 行。
   * @param options.force ADR-138 N1-138-2：true 时跳过 STALE 检测（D-138-4 F-2）；其它守卫保持
   * @throws AppError 失败时抛带 code + httpStatus 的域异常
   */
  async rollback(
    auditLogId: string,
    actorContext: { readonly actorId: string; readonly requestId?: string | null; readonly ipHash?: string | null },
    options: { readonly force?: boolean } = {},
  ): Promise<RollbackResult> {
    // F-5: audit_log 行不存在
    const auditLog = await getAdminAuditLogById(this.db, auditLogId)
    if (!auditLog) {
      throw new AppError('NOT_FOUND', '审计日志不存在', 404)
    }

    const actionType = auditLog.actionType as AdminAuditActionType
    const targetKind = auditLog.targetKind as AdminAuditTargetKind

    // F-1 / F-4: actionType 不可回滚（含二次回滚 system.audit_rollback）
    if (UNSUPPORTED_ACTION_TYPES.has(actionType)) {
      throw new AppError(
        'AUDIT_ROLLBACK_UNSUPPORTED',
        `此操作类型不支持回滚 (${actionType})`,
        422,
      )
    }

    // 注册的 handler 优先（首期 Map 为空，直接 fallthrough）
    const handler = ROLLBACK_HANDLER_REGISTRY.get(actionType)

    // F-6: target_id NULL（batch action，通用路径不支持）
    if (!auditLog.targetId && !handler) {
      throw new AppError(
        'AUDIT_ROLLBACK_UNSUPPORTED',
        `批量操作不支持自动回滚 (${actionType}: target_id 为空)`,
        422,
      )
    }

    // F-7: before_jsonb NULL（CREATE 类，通用路径不支持反向创建）
    if (!auditLog.beforeJsonb && !handler) {
      throw new AppError(
        'AUDIT_ROLLBACK_UNSUPPORTED',
        `无 before 快照的操作不支持自动回滚 (${actionType})`,
        422,
      )
    }

    // 走事务执行核心回滚逻辑
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      let warnings: readonly string[] | undefined

      if (handler) {
        const handlerResult = await handler(client, {
          auditLogId: auditLog.id,
          actorId: actorContext.actorId,
          actionType,
          targetKind,
          targetId: auditLog.targetId,
          beforeJsonb: auditLog.beforeJsonb,
          afterJsonb: auditLog.afterJsonb,
        })
        warnings = handlerResult.warnings
      } else {
        // 通用路径
        warnings = await this.rollbackGeneric(client, auditLog, options.force ?? false)
      }

      // 写 system.audit_rollback audit_log（事务内 INSERT，原子性保证 ADR-138 D-138-6）
      // ADR-138 N1-138-2：force flag 写入 audit payload 供追溯审计（区分常规回滚 vs 强制覆盖）
      const auditMeta = {
        sourceAuditLogId: auditLog.id,
        sourceActionType: actionType,
        sourceTargetKind: targetKind,
        sourceTargetId: auditLog.targetId,
        ...(options.force ? { force: true } : {}),
      }
      const rollbackAuditLogId = await insertAuditLogInTransaction(client, {
        actorId: actorContext.actorId,
        actionType: 'system.audit_rollback',
        targetKind: 'system',
        targetId: null,
        beforeJsonb: {
          ...auditMeta,
          rolledBackFields: auditLog.afterJsonb,
        },
        afterJsonb: {
          ...auditMeta,
          restoredFields: auditLog.beforeJsonb,
        },
        requestId: actorContext.requestId ?? null,
        ipHash: actorContext.ipHash ?? null,
      })

      await client.query('COMMIT')

      // NTLG-P1-c-B-2：解耦双写 emit（**COMMIT 后**——emit 走独立 Pool 连接不参与本事务，
      // 置 COMMIT 前会在事务回滚时产生幽灵通知；fire-and-forget 与 audit 互不依赖）
      this.notificationEmitter.emit(
        buildAuditNotificationEmit({ actionType: 'system.audit_rollback', targetId: null }),
      )

      return {
        rolledBack: true,
        rollbackAuditLogId,
        ...(warnings && warnings.length > 0 ? { warnings } : {}),
      }
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => { /* swallow rollback errors */ })

      // PG UNIQUE 违反 23505 → AUDIT_ROLLBACK_STALE（D-138-4 F-2 唯一性子场景）
      const pgErr = err as { code?: string }
      if (pgErr?.code === '23505') {
        throw new AppError(
          'AUDIT_ROLLBACK_STALE',
          '回滚目标字段值已被占用（唯一性约束冲突）',
          409,
        )
      }
      // PG 未定义列 42703 → AUDIT_ROLLBACK_SCHEMA_DRIFT（白名单字段在当前 schema 不存在）
      if (pgErr?.code === '42703') {
        throw new AppError(
          'AUDIT_ROLLBACK_SCHEMA_DRIFT',
          '回滚字段在当前 schema 中不存在（migration 后未同步白名单）',
          422,
        )
      }
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * 通用路径：JSONB diff 反向 UPDATE + 字段白名单过滤 + stale 检测。
   * 返回 warnings（被白名单过滤的字段名列表）。
   *
   * @param force ADR-138 N1-138-2：true 时跳过 STALE 检测（其它守卫保持）
   */
  private async rollbackGeneric(
    client: PoolClient,
    auditLog: NonNullable<Awaited<ReturnType<typeof getAdminAuditLogById>>>,
    force: boolean,
  ): Promise<readonly string[]> {
    const targetKind = auditLog.targetKind as AdminAuditTargetKind
    const targetId = auditLog.targetId!  // 已在 rollback() 中校验非空
    const before = auditLog.beforeJsonb!  // 已校验非空
    const after = auditLog.afterJsonb

    // target_kind → table 映射
    const tableMeta = TARGET_KIND_TABLE_MAP[targetKind]
    if (!tableMeta) {
      // D-138-5：无映射的 target_kind 不在通用路径范围（理应已在 UNSUPPORTED Set 中拦截）
      throw new AppError(
        'AUDIT_ROLLBACK_UNSUPPORTED',
        `target_kind '${targetKind}' 无对应业务表，不支持通用回滚`,
        422,
      )
    }

    // 字段白名单过滤
    const whitelist = FIELD_WHITELIST[targetKind] ?? new Set<string>()
    const beforeFields = Object.keys(before)
    const fieldsToRestore: Record<string, unknown> = {}
    const filteredOut: string[] = []
    for (const field of beforeFields) {
      if (whitelist.has(field)) {
        fieldsToRestore[field] = before[field]
      } else {
        filteredOut.push(field)
      }
    }

    // F-3: schema drift（白名单交集为空）
    if (Object.keys(fieldsToRestore).length === 0) {
      throw new AppError(
        'AUDIT_ROLLBACK_SCHEMA_DRIFT',
        `审计记录字段 (${beforeFields.join(', ')}) 与当前 schema 白名单不兼容，无法自动回滚`,
        422,
      )
    }

    // F-2: stale 检测 — 比对 after_jsonb 字段与当前 DB 值
    // ADR-138 N1-138-2：force=true 时跳过该检测（admin 明确知晓数据已变更但仍要恢复旧值）
    if (after && !force) {
      const afterFields = Object.keys(after).filter((f) => whitelist.has(f))
      if (afterFields.length > 0) {
        const currentRow = await selectCurrentRowForRollback(
          client,
          tableMeta.tableName,
          tableMeta.primaryKeyColumn,
          targetId,
          afterFields,
          tableMeta.softDeleteColumn,
        )
        if (!currentRow) {
          // F-8: 目标业务行不存在 / soft-deleted
          throw new AppError('NOT_FOUND', '目标业务记录不存在或已删除', 404)
        }
        // 比对 after_jsonb 与当前 DB
        for (const field of afterFields) {
          if (!isJsonEqual(currentRow[field], after[field])) {
            throw new AppError(
              'AUDIT_ROLLBACK_STALE',
              `字段 '${field}' 已被后续操作修改，无法安全回滚（当前值与审计记录的 after 不一致）`,
              409,
            )
          }
        }
      }
    }

    // 执行回滚 UPDATE
    const { affectedRows } = await rollbackAuditLogTarget(
      client,
      tableMeta.tableName,
      tableMeta.primaryKeyColumn,
      targetId,
      fieldsToRestore,
      tableMeta.softDeleteColumn,
    )

    if (affectedRows === 0) {
      // F-8: 目标业务行不存在（after_jsonb 为空时未走 stale 检测分支，UPDATE 直接返 0）
      throw new AppError('NOT_FOUND', '目标业务记录不存在或已删除', 404)
    }

    return filteredOut.length > 0
      ? filteredOut.map((f) => `字段 '${f}' 不在当前白名单中，已跳过`)
      : []
  }
}

/**
 * 简单 JSON 等值比较（不递归处理对象引用差异，但处理 primitive + null + 一层嵌套）。
 * stale 检测使用 — 字段值通常为 primitive（string/number/boolean/null）。
 */
function isJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return false
}
