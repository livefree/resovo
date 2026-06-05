/**
 * IdentityCandidatesService.ts — identity 候选人工裁定业务层（ADR-178 / CHG-VIR-9-B / Phase 2c）
 *
 * 职责：
 *   - reject(): 人工拒绝候选（单事务：candidate pending→rejected + decision(rejected)）+ fire-and-forget audit
 *   - listDecisions(): decision 列表只读查询（ADR-179 D-179-1 / CHG-VIR-13-C1）
 *   - revive(): rejected 候选人工复活（ADR-179 D-179-2/3：新建 pending + revived_from 链 + 原 decision 置
 *     reverted；撞 pending 唯一约束幂等返回既有 / CHG-VIR-13-C1）
 *   - validateForMerge(): merge candidateId 事务前快速失败校验（D-178-3，正确性由事务内 from-state 守卫兜底）
 *   - attachConfirmedDecision(): merge 事务内挂 decision(confirmed)+candidate confirmed（R8 单 BEGIN/COMMIT，
 *     client 由 VideoMergesService.merge 持有）
 *
 * 独立于 VideoMergesService（该文件已超 500 行硬限，禁继续膨胀 / ADR-178 D-178-1 备选 B 否决；
 * ADR-179 D-179-6 延续该归属边界）。
 */

import type { Pool, PoolClient } from 'pg'
import { z } from 'zod'
import type {
  IdentityDecisionListRow,
  ListIdentityDecisionsParams,
  ListIdentityDecisionsResult,
  ReviveCandidateResult,
} from '@resovo/types'
import {
  findCandidateById,
  findCandidateByIdReadonly,
  findPendingByPairKey,
  insertCandidate,
  updateCandidateStatus,
} from '@/api/db/queries/identity-candidate'
import {
  insertIdentityDecision,
  listIdentityDecisions,
  countIdentityDecisions,
  findActiveRejectedDecisionByCandidateId,
  markDecisionReverted,
} from '@/api/db/queries/identity-decision'
import { fetchVideosByIds } from '@/api/db/queries/video-merge-mutations'
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

  // ── listDecisions（ADR-179 D-179-1 / CHG-VIR-13-C1）─────────────────────

  /** decision 列表只读查询（零审计）；排序固定 created_at DESC, id ASC（分页幂等）。 */
  async listDecisions(params: ListIdentityDecisionsParams): Promise<ListIdentityDecisionsResult> {
    const { limit, page } = params
    const filter = {
      decision: params.decision ?? null,
      candidateId: params.candidateId ?? null,
      reverted: params.reverted ?? null,
    }
    const offset = (page - 1) * limit
    const [rows, total] = await Promise.all([
      listIdentityDecisions(this.db, { ...filter, offset, limit }),
      countIdentityDecisions(this.db, filter),
    ])
    const data: IdentityDecisionListRow[] = rows.map((r) => ({
      id: r.id,
      candidateId: r.candidate_id,
      decision: r.decision,
      actorType: r.actor_type,
      performedBy: r.performed_by,
      performedByUsername: r.performed_by_username,
      reason: r.reason,
      videoMergeAuditId: r.video_merge_audit_id,
      revertedAt: r.reverted_at,
      revertedBy: r.reverted_by,
      revertedReason: r.reverted_reason,
      createdAt: r.created_at,
      leftVideoId: r.left_video_id,
      rightVideoId: r.right_video_id,
      leftVideoTitle: r.left_video_title,
      leftVideoDeleted: r.left_video_deleted,
      rightVideoTitle: r.right_video_title,
      rightVideoDeleted: r.right_video_deleted,
      identityScore: Number(r.identity_score),
      candidateStatus: r.candidate_status,
    }))
    return { data, total, page, limit }
  }

  // ── revive（ADR-179 D-179-2/3/4/5 / CHG-VIR-13-C1）──────────────────────

  /**
   * rejected 候选人工复活：单事务新建 pending（复制原行 + revived_from 链 / R6）+ 原行零修改
   * + 原 rejected decision 置 reverted（拒绝裁定被人工推翻）。
   * 撞 pending 唯一约束（离线 job 先一步复活）→ 幂等返回既有 pending（reused: true，
   * **不**置 reverted——该 pending 非本次复活产物 / D-179-3）。
   */
  async revive(candidateId: string, actorId: string, reason?: string): Promise<ReviveCandidateResult> {
    const client = await this.db.connect()
    let newCandidateId: string
    let reused: boolean
    let pairKey: string
    try {
      await client.query('BEGIN')

      // FOR UPDATE 行锁：并发 revive 串行化（校验全 BEGIN 前语义 = 任何写入之前 / D-179-2）
      const candidate = await findCandidateById(client, candidateId)
      if (!candidate) {
        throw new AppError('NOT_FOUND', `candidate ${candidateId} 不存在`, 404)
      }
      if (candidate.status !== 'rejected') {
        throw new AppError(
          'STATE_CONFLICT',
          `candidate ${candidateId} 非 rejected 状态（当前 ${candidate.status}），无法复活`,
          409,
        )
      }
      pairKey = candidate.canonical_pair_key

      // pair 双侧 video 存活校验（任一侧软删 → 复活无意义）
      const videos = await fetchVideosByIds(client, [candidate.left_video_id, candidate.right_video_id])
      const aliveIds = new Set(videos.filter((v) => v.deleted_at === null).map((v) => v.id))
      if (!aliveIds.has(candidate.left_video_id) || !aliveIds.has(candidate.right_video_id)) {
        throw new AppError('STATE_CONFLICT', 'pair 视频已被合并或删除，无法复活', 409)
      }

      // 新建 pending（复制原行 evidence 快照，v1 不重算评分——parser/scorer 升级由离线
      // supersede 兜底 / D-179-2）；ON CONFLICT DO NOTHING 防并发（insertCandidate 既有范式）
      const inserted = await insertCandidate(client, {
        leftVideoId: candidate.left_video_id,
        rightVideoId: candidate.right_video_id,
        canonicalPairKey: candidate.canonical_pair_key,
        parserVersion: candidate.parser_version,
        scorerVersion: candidate.scorer_version,
        evidenceJsonb: candidate.evidence_jsonb,
        evidenceHash: candidate.evidence_hash,
        legacyScore: candidate.legacy_score !== null ? Number(candidate.legacy_score) : null,
        identityScore: Number(candidate.identity_score),
        strongNegativeReasons: candidate.strong_negative_reasons,
        // D-179-4：trigger_source 复用 'manual-search'（086 CHECK 不扩枚举）；
        // revived_from_candidate_id 非空即复活语义一等标识
        triggerSource: 'manual-search',
        groupKey: candidate.group_key,
        revivedFromCandidateId: candidateId,
      })

      if (inserted) {
        newCandidateId = inserted.id
        reused = false
        // 原 rejected decision 置 reverted（仅本次复活产物路径；D-178-2 至多一条）
        const rejectedDecision = await findActiveRejectedDecisionByCandidateId(client, candidateId)
        if (rejectedDecision) {
          await markDecisionReverted(client, rejectedDecision.id, actorId, reason ?? null)
        }
      } else {
        // 撞 pending partial unique → 重查收敛（findOrCreate 既有范式）；
        // 既有 pending 来自离线 job 非人工推翻 → 不置 reverted（D-179-3）
        const existing = await findPendingByPairKey(client, candidate.canonical_pair_key)
        if (!existing) {
          // 理论不可达：同事务内 ON CONFLICT 命中则该 pending 必可见
          throw new AppError('STATE_CONFLICT', `candidate ${candidateId} 并发状态变更，请重试`, 409)
        }
        newCandidateId = existing.id
        reused = true
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // fire-and-forget admin_audit_log（COMMIT 后才写，防虚假记录 / D-179-5）
    this.auditSvc.write({
      actorId,
      actionType: 'identity_candidate.revive',
      targetKind: 'identity_candidate',
      targetId: candidateId,
      beforeJsonb: { status: 'rejected', canonicalPairKey: pairKey },
      afterJsonb: { newCandidateId, reused, revivedFromCandidateId: candidateId, reason: reason ?? null },
    })

    return { newCandidateId, revivedFromCandidateId: candidateId, reused }
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

// ── zod schema（ADR-178 + ADR-179 §端点契约）────────────────────────────

export const RejectCandidateSchema = z.object({
  reason: z.string().max(500).optional(),
})

// ADR-179 D-179-2（CHG-VIR-13-C1）
export const ReviveCandidateSchema = z.object({
  reason: z.string().max(500).optional(),
})

// ADR-179 D-179-1（CHG-VIR-13-C1）：reverted 字符串 boolean（URL query 形态）
export const ListIdentityDecisionsSchema = z.object({
  decision: z.enum(['confirmed', 'rejected']).optional(),
  candidateId: z.string().uuid().optional(),
  reverted: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
}).strict()
