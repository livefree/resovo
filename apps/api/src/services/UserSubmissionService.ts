/**
 * UserSubmissionService.ts — 用户投稿 4 类统一服务层（ADR-124 / CHG-SN-7-REDO-02-A）
 *
 * 范围（A 卡 stub）：
 *   - actionType / targetKind enum 注册（已在 AuditLogService.ts ACTION_TYPES + TARGET_KINDS）
 *   - 4 路径 audit payload shape 占位（参 ADR-124 §audit log 协议）
 *   - mutation 实际实施 → REDO-02-B（6 端点 + queries + audit 写入）
 *
 * A 卡产出：
 *   - 3 类 metadata zod schema 锁定（D-124-5 / Y2 / 子代理产出 verbatim）
 *   - 4 路径 audit afterJsonb shape 定义（ProcessAuditPayload / RejectAuditPayload / Batch*）
 *   - audit 写入 helper（writeUserSubmissionAction）— B 卡 6 端点共享调用入口
 *
 * 注意：
 *   - 本卡 stub 文件含 actionType 写入位点 → 满足 audit-log-coverage 守卫"action_type 必在 apps/api/src 内有写入位点"
 *   - 实际 mutation 操作（process/reject/batch_*）在 B 卡实施时调用本服务的 writeUserSubmissionAction
 *   - tests/unit/api/user-submissions-audit.test.ts 含 content assertion `expect.objectContaining({ actionType: 'user_submission.action' })`
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'
import {
  listUserSubmissions as listRaw,
  getUserSubmissionById,
  markUserSubmissionProcessed,
  markUserSubmissionRejected,
  batchMarkProcessed,
  batchMarkRejected,
  type ListUserSubmissionsFilter,
  type ListUserSubmissionsResult,
} from '@/api/db/queries/userSubmissions'
import type { UserSubmissionRow, UserSubmissionListResp } from '@resovo/types'

// ── ADR-124 §Schema 设计末尾 / Y2 metadata zod 锁定（3 类 shape）─────

export const BadSourceMetadataSchema = z.object({
  source_id: z.string().uuid(),
  source_url: z.string().url().optional(),
  last_played_at: z.string().datetime().optional(),
}).strict()

export const WishListMetadataSchema = z.object({
  title_zh: z.string().max(200).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  douban_id: z.string().regex(/^\d+$/).optional(),
  type: z.enum(['movie', 'series', 'show']).optional(),
}).strict()

export const MetadataCorrectionMetadataSchema = z.object({
  video_id: z.string().uuid(),
  field: z.enum(['title', 'director', 'year', 'description', 'cover_url', 'douban_id']),
  suggested_value: z.string().max(500),
}).strict()

// ── ADR-124 §audit log 协议 / D-124-3 + Y2 / afterJsonb shape ──────

/**
 * 4 路径合并 actionType `user_submission.action`，由 afterJsonb.action 区分：
 *   - process：单条标记处理（POST /admin/user-submissions/:id/process）
 *   - reject：单条拒绝（POST /admin/user-submissions/:id/reject）
 *   - batch_process：批量处理（POST /admin/user-submissions/batch-process）
 *   - batch_reject：批量拒绝（POST /admin/user-submissions/batch-reject）
 */
export type UserSubmissionAuditAction = 'process' | 'reject' | 'batch_process' | 'batch_reject'

export interface UserSubmissionAuditPayload {
  readonly action: UserSubmissionAuditAction
  readonly type?: 'bad_source' | 'wish_list' | 'metadata_correction'
  readonly ids?: readonly string[]              // batch_* 时（targetId NULL）
  readonly count?: number                        // batch_* 时
  readonly action_taken?: string                 // process / batch_process 时
  readonly reason?: string                       // reject / batch_reject 时
}

// ── audit 写入 helper（B 卡 6 端点共享调用入口）─────────────────────

export interface WriteUserSubmissionActionParams {
  readonly actorId: string
  readonly targetId: string | null               // 单条：UUID / 批量：null
  readonly payload: UserSubmissionAuditPayload
  readonly requestId?: string | null
}

/**
 * 写入 audit log（ADR-124 §audit log 协议）。
 * 由 REDO-02-B 6 端点 process/reject/batch_* 在 service 层 fire-and-forget 调用。
 *
 * actionType: 'user_submission.action'（合并 / D-124-3 + ADR-121 D-121-5 范式）
 * targetKind: 'user_submission'（D-124-4 新增 / 不复用 video_source）
 * targetId: 单条 = user_submissions.id / 批量 = null + afterJsonb.ids
 */
export class UserSubmissionService {
  private auditSvc: AuditLogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  /**
   * REDO-02-A stub：暴露 audit 写入入口供 B 卡 6 端点调用。
   * 本方法满足 audit-log-coverage 守卫"actionType 在 apps/api/src 内有写入位点"。
   * REDO-02-B：6 业务方法均通过本 helper 写 audit。
   */
  writeUserSubmissionAction(params: WriteUserSubmissionActionParams): void {
    this.auditSvc.write({
      actorId: params.actorId,
      actionType: 'user_submission.action',
      targetKind: 'user_submission',
      targetId: params.targetId,
      beforeJsonb: null,                          // user_submissions 无 beforeJsonb（status 跃迁由 afterJsonb 全捕）
      afterJsonb: params.payload as unknown as Record<string, unknown>,
      requestId: params.requestId ?? null,
    })
  }

  // ── REDO-02-B 6 业务方法（ADR-124 §端点契约 row 1-6）──────────────

  /** GET /admin/user-submissions — 4 类 + status 过滤 + badges 聚合 */
  async listUserSubmissions(filter: ListUserSubmissionsFilter): Promise<UserSubmissionListResp> {
    const result: ListUserSubmissionsResult = await listRaw(this.db, filter)
    return {
      data: result.rows,
      meta: {
        total: result.total,
        page: filter.page,
        limit: filter.limit,
        badges: result.badges,
      },
    }
  }

  /** GET /admin/user-submissions/:id — 详情 */
  async getUserSubmissionById(id: string): Promise<UserSubmissionRow> {
    const row = await getUserSubmissionById(this.db, id)
    if (!row) {
      throw new AppError('NOT_FOUND', `投稿 ${id} 不存在`, 404)
    }
    return row
  }

  /**
   * POST /admin/user-submissions/:id/process — 状态机 pending → processed
   * - 404 NOT_FOUND 若 id 不存在
   * - 409 STATE_CONFLICT 若 status 已非 pending
   */
  async processUserSubmission(
    id: string,
    actorId: string,
    actionTaken?: string,
    requestId?: string,
  ): Promise<{ readonly processed: true }> {
    // 区分 404 / 409：先取行（若不存在 → 404；若存在但非 pending → 409）
    const existing = await getUserSubmissionById(this.db, id)
    if (!existing) {
      throw new AppError('NOT_FOUND', `投稿 ${id} 不存在`, 404)
    }
    if (existing.status !== 'pending') {
      throw new AppError('STATE_CONFLICT', `投稿 ${id} 已处理（status=${existing.status}）`, 409)
    }

    const result = await markUserSubmissionProcessed(this.db, id, actorId, actionTaken)
    if (!result) {
      // 竞态守卫：两次查询之间 status 被改 → 409
      throw new AppError('STATE_CONFLICT', `投稿 ${id} 已被其他操作处理`, 409)
    }

    this.writeUserSubmissionAction({
      actorId,
      targetId: id,
      payload: {
        action: 'process',
        type: result.type,
        ...(actionTaken !== undefined ? { action_taken: actionTaken } : {}),
      },
      requestId,
    })

    return { processed: true }
  }

  /**
   * POST /admin/user-submissions/:id/reject — 状态机 pending → rejected
   */
  async rejectUserSubmission(
    id: string,
    actorId: string,
    reason: string,
    requestId?: string,
  ): Promise<{ readonly rejected: true }> {
    const existing = await getUserSubmissionById(this.db, id)
    if (!existing) {
      throw new AppError('NOT_FOUND', `投稿 ${id} 不存在`, 404)
    }
    if (existing.status !== 'pending') {
      throw new AppError('STATE_CONFLICT', `投稿 ${id} 已处理（status=${existing.status}）`, 409)
    }

    const result = await markUserSubmissionRejected(this.db, id, actorId, reason)
    if (!result) {
      throw new AppError('STATE_CONFLICT', `投稿 ${id} 已被其他操作处理`, 409)
    }

    this.writeUserSubmissionAction({
      actorId,
      targetId: id,
      payload: { action: 'reject', type: result.type, reason },
      requestId,
    })

    return { rejected: true }
  }

  /**
   * POST /admin/user-submissions/batch-process — 批量 pending → processed
   * 非 pending 行静默跳过（不抛 409）；返回实际处理数。
   */
  async batchProcessUserSubmissions(
    ids: readonly string[],
    actorId: string,
    actionTaken?: string,
    requestId?: string,
  ): Promise<{ readonly processed: number }> {
    const processedIds = await batchMarkProcessed(this.db, ids, actorId, actionTaken)

    if (processedIds.length > 0) {
      this.writeUserSubmissionAction({
        actorId,
        targetId: null,
        payload: {
          action: 'batch_process',
          ids: processedIds,
          count: processedIds.length,
          ...(actionTaken !== undefined ? { action_taken: actionTaken } : {}),
        },
        requestId,
      })
    }

    return { processed: processedIds.length }
  }

  /**
   * POST /admin/user-submissions/batch-reject — 批量 pending → rejected
   */
  async batchRejectUserSubmissions(
    ids: readonly string[],
    actorId: string,
    reason: string,
    requestId?: string,
  ): Promise<{ readonly rejected: number }> {
    const rejectedIds = await batchMarkRejected(this.db, ids, actorId, reason)

    if (rejectedIds.length > 0) {
      this.writeUserSubmissionAction({
        actorId,
        targetId: null,
        payload: {
          action: 'batch_reject',
          ids: rejectedIds,
          count: rejectedIds.length,
          reason,
        },
        requestId,
      })
    }

    return { rejected: rejectedIds.length }
  }
}

// ── REDO-02-B route 层 zod schemas（共享）────────────────────────────

export const ListUserSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(['bad_source', 'wish_list', 'metadata_correction', 'all']).optional().default('all'),
  status: z.enum(['pending', 'processed', 'rejected', 'all']).optional().default('pending'),
  sortField: z.enum(['created_at', 'processed_at']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

export const UserSubmissionIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict()

export const ProcessBodySchema = z.object({
  action_taken: z.string().min(1).max(200).optional(),
})

export const RejectBodySchema = z.object({
  reason: z.string().min(1).max(200),
})

export const BatchProcessBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action_taken: z.string().max(200).optional(),
})

export const BatchRejectBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().min(1).max(200),
})
