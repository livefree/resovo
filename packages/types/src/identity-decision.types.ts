/**
 * identity-decision.types.ts — identity 裁定记录读端点 + revive 契约（ADR-179 / CHG-VIR-13-C1）
 *
 * GET  /admin/identity-decisions（D-179-1 只读列表，merge-split 工作台决策记录子视图数据源）
 * POST /admin/identity-candidates/:id/revive（D-179-2/3 复活 + 幂等）
 */

/** decision 列表行（decision 全列 + pair 摘要 / D-179-1） */
export interface IdentityDecisionListRow {
  readonly id: string
  readonly candidateId: string
  readonly decision: 'confirmed' | 'rejected'
  readonly actorType: 'human' | 'system'
  readonly performedBy: string
  /** JOIN users（对齐 audit timeline 范式）；用户已删 → null */
  readonly performedByUsername: string | null
  readonly reason: string | null
  /** confirmed 必有（R8）；rejected 恒 null */
  readonly videoMergeAuditId: string | null
  readonly revertedAt: string | null
  readonly revertedBy: string | null
  readonly revertedReason: string | null
  readonly createdAt: string
  // ── pair 摘要（JOIN identity_candidate → videos）──
  readonly leftVideoId: string
  readonly rightVideoId: string
  /** 软删行仍有 title 可取（D-179-1）；物理缺失防御 null */
  readonly leftVideoTitle: string | null
  readonly leftVideoDeleted: boolean
  readonly rightVideoTitle: string | null
  readonly rightVideoDeleted: boolean
  readonly identityScore: number
  readonly candidateStatus: 'pending' | 'confirmed' | 'rejected' | 'superseded'
}

export interface ListIdentityDecisionsParams {
  readonly decision?: 'confirmed' | 'rejected'
  readonly candidateId?: string
  readonly reverted?: boolean
  readonly limit: number
  readonly page: number
}

export interface ListIdentityDecisionsResult {
  readonly data: readonly IdentityDecisionListRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

/** revive 响应（D-179-2/3）：reused = 撞 pending 唯一约束幂等返回既有 pending */
export interface ReviveCandidateResult {
  readonly newCandidateId: string
  readonly revivedFromCandidateId: string
  readonly reused: boolean
}
