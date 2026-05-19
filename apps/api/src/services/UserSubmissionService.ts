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
   * 实际 mutation 业务（process / reject / batch_*）在 B 卡 service 方法内调用本 helper。
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
}
