/**
 * IdentityCandidatesService.ts — identity 候选人工裁定业务层（ADR-178 / CHG-VIR-9-B / Phase 2c）
 *
 * 职责：
 *   - reject(): 人工拒绝候选（单事务：candidate pending→rejected + decision(rejected)）+ fire-and-forget audit
 *   - validateForMerge(): merge candidateId 事务前快速失败校验（D-178-3，正确性由事务内 from-state 守卫兜底）
 *   - attachConfirmedDecision(): merge 事务内挂 decision(confirmed)+candidate confirmed（R8 单 BEGIN/COMMIT，
 *     client 由 VideoMergesService.merge 持有）
 *
 * 独立于 VideoMergesService（该文件已超 500 行硬限，禁继续膨胀 / ADR-178 D-178-1 备选 B 否决）。
 */

import type { Pool, PoolClient } from 'pg'
import { z } from 'zod'
import {
  findCandidateById,
  findCandidateByIdReadonly,
  updateCandidateStatus,
} from '@/api/db/queries/identity-candidate'
import { insertIdentityDecision } from '@/api/db/queries/identity-decision'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'

export interface RejectCandidateResult {
  readonly candidateId: string
  readonly status: 'rejected'
  readonly decisionId: string
}

export class IdentityCandidatesService {
  private auditSvc: AuditLogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  // ── reject（ADR-178 D-178-2）────────────────────────────────────────

  /**
   * 人工拒绝候选：单事务 candidate pending→rejected + INSERT decision(rejected, audit_id=NULL)。
   * 复活链（R6）由离线 job 经 revived_from_candidate_id 新建 pending，本方法不覆盖/复用原行。
   */
  async reject(candidateId: string, actorId: string, reason?: string): Promise<RejectCandidateResult> {
    const client = await this.db.connect()
    let decisionId: string
    let pairKey: string
    try {
      await client.query('BEGIN')

      // FOR UPDATE 行锁：并发 reject / reject-vs-merge 串行化
      const candidate = await findCandidateById(client, candidateId)
      if (!candidate) {
        throw new AppError('NOT_FOUND', `candidate ${candidateId} 不存在`, 404)
      }
      if (candidate.status !== 'pending') {
        throw new AppError(
          'STATE_CONFLICT',
          `candidate ${candidateId} 非 pending 状态（当前 ${candidate.status}），无法拒绝`,
          409,
        )
      }
      pairKey = candidate.canonical_pair_key

      const updated = await updateCandidateStatus(client, candidateId, 'pending', 'rejected')
      if (updated === 0) {
        // 理论不可达（FOR UPDATE 已锁行），防御性兜底
        throw new AppError('STATE_CONFLICT', `candidate ${candidateId} 状态已变更，无法拒绝`, 409)
      }

      decisionId = await insertIdentityDecision(client, {
        candidateId,
        decision: 'rejected',
        videoMergeAuditId: null,
        performedBy: actorId,
        reason: reason ?? null,
      })

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // fire-and-forget admin_audit_log（COMMIT 后才写，防虚假记录 / D-178-6）
    this.auditSvc.write({
      actorId,
      actionType: 'identity_candidate.reject',
      targetKind: 'identity_candidate',
      targetId: candidateId,
      beforeJsonb: { status: 'pending', canonicalPairKey: pairKey },
      afterJsonb: { status: 'rejected', decisionId, reason: reason ?? null },
    })

    return { candidateId, status: 'rejected', decisionId }
  }

  // ── merge 挂载 helpers（ADR-178 D-178-3 / VideoMergesService.merge 调用）──

  /**
   * merge candidateId 事务前快速失败校验（BEGIN 之前调用，主路径零变更）：
   * candidate 存在(404) → pending(409) → pair ⊆ 合并集合(422)。
   */
  static async validateForMerge(
    db: Pool,
    candidateId: string,
    mergeVideoIds: readonly string[],
  ): Promise<void> {
    const candidate = await findCandidateByIdReadonly(db, candidateId)
    if (!candidate) {
      throw new AppError('NOT_FOUND', `candidate ${candidateId} 不存在`, 404)
    }
    if (candidate.status !== 'pending') {
      throw new AppError(
        'STATE_CONFLICT',
        `candidate ${candidateId} 非 pending 状态（当前 ${candidate.status}），无法确认合并`,
        409,
      )
    }
    const mergeSet = new Set(mergeVideoIds)
    if (!mergeSet.has(candidate.left_video_id) || !mergeSet.has(candidate.right_video_id)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `candidate ${candidateId} 对应的视频 pair 不在合并集合内`,
        422,
      )
    }
  }

  /**
   * merge 事务内挂 decision(confirmed)+candidate confirmed（client 由 merge 事务持有 / R8 单 BEGIN/COMMIT）。
   * from-state 守卫：校验后被并发 reject 时 rowCount=0 → 抛 409 → 整个 merge ROLLBACK（无半完成态）。
   * @returns decisionId
   */
  static async attachConfirmedDecision(
    client: PoolClient,
    params: { candidateId: string; videoMergeAuditId: string; performedBy: string },
  ): Promise<string> {
    const updated = await updateCandidateStatus(client, params.candidateId, 'pending', 'confirmed')
    if (updated === 0) {
      throw new AppError(
        'STATE_CONFLICT',
        `candidate ${params.candidateId} 状态已变更（可能被并发拒绝），合并已回滚`,
        409,
      )
    }
    return insertIdentityDecision(client, {
      candidateId: params.candidateId,
      decision: 'confirmed',
      videoMergeAuditId: params.videoMergeAuditId,
      performedBy: params.performedBy,
      reason: null,
    })
  }
}

// ── zod schema（ADR-178 §端点契约）────────────────────────────────────

export const RejectCandidateSchema = z.object({
  reason: z.string().max(500).optional(),
})
