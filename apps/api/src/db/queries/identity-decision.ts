/**
 * identity-decision.ts — identity_decisions DB 查询（SEQ-20260602-03 / CHG-VIR-9-B / Phase 2c）
 *
 * schema 真源 = ADR-105a D-105a-11 + ADR-178 D-178-5（migration 087）。**仅 DB query 层**（不 import Service）。
 * 全部为事务函数（收 `PoolClient`）：decision 写入与 merge/reject 主体同 BEGIN/COMMIT（R8 单事实源），
 * 事务由 Service 持有（参 identity-candidate.ts / video-merge-mutations.ts 范式）。所有 SQL 参数化（db-rules.md）。
 */

import type { PoolClient } from 'pg'

// ── 行类型 ────────────────────────────────────────────────────────

export interface IdentityDecisionRow {
  readonly id: string
  readonly candidate_id: string
  readonly decision: 'confirmed' | 'rejected'
  readonly video_merge_audit_id: string | null
  readonly performed_by: string
  readonly actor_type: 'human' | 'system'
  readonly reason: string | null
  readonly reverted_at: string | null
  readonly reverted_by: string | null
  readonly reverted_reason: string | null
  readonly created_at: string
}

const SELECT_COLS = `
  id, candidate_id, decision, video_merge_audit_id, performed_by, actor_type, reason,
  reverted_at::text, reverted_by, reverted_reason, created_at::text`

// ── ① 插入裁定行（事务内 / R8）────────────────────────────────────

/**
 * 插入裁定行。confirmed 必传 videoMergeAuditId（R8；DB CHECK ck_identity_decision_confirmed_audit 兜底）。
 * actorType 缺省 'human'（D-105a-11 auto decision 留 system，本卡只走人工路径）。返回 decision id。
 */
export async function insertIdentityDecision(
  client: PoolClient,
  params: {
    candidateId: string
    decision: 'confirmed' | 'rejected'
    videoMergeAuditId: string | null
    performedBy: string
    actorType?: 'human' | 'system'
    reason: string | null
  },
): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO identity_decisions
       (candidate_id, decision, video_merge_audit_id, performed_by, actor_type, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      params.candidateId,
      params.decision,
      params.videoMergeAuditId,
      params.performedBy,
      params.actorType ?? 'human',
      params.reason ?? null,
    ],
  )
  return r.rows[0]!.id
}

// ── ② unmerge 联动：经 audit_id 反查 confirmed decision（事务内）──────

/**
 * 经 video_merge_audit_id 反查未撤销的 confirmed decision（idx_identity_decision_audit）。
 * 返回 0..1 行（partial unique (candidate_id) WHERE decision='confirmed' + audit 一对一关联）。
 */
export async function findConfirmedDecisionByAuditId(
  client: PoolClient,
  videoMergeAuditId: string,
): Promise<IdentityDecisionRow | null> {
  const r = await client.query<IdentityDecisionRow>(
    `SELECT ${SELECT_COLS} FROM identity_decisions
     WHERE video_merge_audit_id = $1 AND decision = 'confirmed' AND reverted_at IS NULL
     LIMIT 1`,
    [videoMergeAuditId],
  )
  return r.rows[0] ?? null
}

// ── ③ 标记 decision 已撤销（事务内 / D-178-4）────────────────────────

/**
 * 原地置 reverted 三列（不改 decision 值、不新增行 / 对齐 markAuditReverted 范式）。
 * 以 video_merge_audit 为唯一事实源（R8），decision 仅同步联动。
 */
export async function markDecisionReverted(
  client: PoolClient,
  decisionId: string,
  revertedBy: string,
  revertedReason: string | null,
): Promise<void> {
  await client.query(
    `UPDATE identity_decisions
        SET reverted_at = NOW(),
            reverted_by = $2,
            reverted_reason = $3
      WHERE id = $1`,
    [decisionId, revertedBy, revertedReason ?? null],
  )
}
