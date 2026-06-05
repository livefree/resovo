/**
 * identity-decision.ts — identity_decisions DB 查询（SEQ-20260602-03 / CHG-VIR-9-B / Phase 2c）
 *
 * schema 真源 = ADR-105a D-105a-11 + ADR-178 D-178-5（migration 087）。**仅 DB query 层**（不 import Service）。
 * 事务函数（①②③⑤）收 `PoolClient`：decision 写入与 merge/reject/revive 主体同 BEGIN/COMMIT（R8 单事实源），
 * 事务由 Service 持有（参 identity-candidate.ts / video-merge-mutations.ts 范式）；
 * 只读列表（④ / ADR-179 D-179-1）收 `Pool`。所有 SQL 参数化（db-rules.md）。
 */

import type { Pool, PoolClient } from 'pg'

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
 * CHG-VIR-9-D / D-105a-18：折叠组 merge 一个 audit 可挂 K 个 decision（partial unique 在
 * candidate_id 非 audit_id），原 LIMIT 1 单行版会让 unmerge 漏 revert K-1 个（R8 回归）→
 * 改返回全部行，unmerge 循环 revert。
 */
export async function findConfirmedDecisionsByAuditId(
  client: PoolClient,
  videoMergeAuditId: string,
): Promise<IdentityDecisionRow[]> {
  const r = await client.query<IdentityDecisionRow>(
    `SELECT ${SELECT_COLS} FROM identity_decisions
     WHERE video_merge_audit_id = $1 AND decision = 'confirmed' AND reverted_at IS NULL
     ORDER BY created_at ASC`,
    [videoMergeAuditId],
  )
  return r.rows
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

// ── ④ decision 列表只读查询（ADR-179 D-179-1 / CHG-VIR-13-C1）────────────

/** 列表原始行：decision 全列 + JOIN users（username）+ JOIN identity_candidate（pair 摘要）+ 双侧 JOIN videos */
export interface RawIdentityDecisionListRow {
  readonly id: string
  readonly candidate_id: string
  readonly decision: 'confirmed' | 'rejected'
  readonly actor_type: 'human' | 'system'
  readonly performed_by: string
  readonly performed_by_username: string | null
  readonly reason: string | null
  readonly video_merge_audit_id: string | null
  readonly reverted_at: string | null
  readonly reverted_by: string | null
  readonly reverted_reason: string | null
  readonly created_at: string
  readonly left_video_id: string
  readonly right_video_id: string
  readonly left_video_title: string | null
  readonly left_video_deleted: boolean
  readonly right_video_title: string | null
  readonly right_video_deleted: boolean
  readonly identity_score: string
  readonly candidate_status: 'pending' | 'confirmed' | 'rejected' | 'superseded'
}

export interface ListIdentityDecisionsFilter {
  readonly decision: 'confirmed' | 'rejected' | null
  readonly candidateId: string | null
  readonly reverted: boolean | null
}

/**
 * decision 列表（D-179-1）：排序固定 `created_at DESC, id ASC`（分页幂等）。
 * 软删 video 标题仍可取（videos 不过滤 deleted_at），附 deleted 标注。
 */
export async function listIdentityDecisions(
  db: Pool,
  params: ListIdentityDecisionsFilter & { offset: number; limit: number },
): Promise<RawIdentityDecisionListRow[]> {
  const r = await db.query<RawIdentityDecisionListRow>(
    `SELECT d.id, d.candidate_id, d.decision, d.actor_type, d.performed_by,
            u.username AS performed_by_username,
            d.reason, d.video_merge_audit_id,
            d.reverted_at::text, d.reverted_by, d.reverted_reason, d.created_at::text,
            c.left_video_id, c.right_video_id,
            c.identity_score::text, c.status AS candidate_status,
            lv.title AS left_video_title, (lv.deleted_at IS NOT NULL) AS left_video_deleted,
            rv.title AS right_video_title, (rv.deleted_at IS NOT NULL) AS right_video_deleted
       FROM identity_decisions d
       JOIN identity_candidate c ON c.id = d.candidate_id
       LEFT JOIN users u ON u.id = d.performed_by
       LEFT JOIN videos lv ON lv.id = c.left_video_id
       LEFT JOIN videos rv ON rv.id = c.right_video_id
      WHERE ($1::text IS NULL OR d.decision = $1)
        AND ($2::uuid IS NULL OR d.candidate_id = $2)
        AND ($3::boolean IS NULL OR (d.reverted_at IS NOT NULL) = $3)
      ORDER BY d.created_at DESC, d.id ASC
      LIMIT $4 OFFSET $5`,
    [params.decision, params.candidateId, params.reverted, params.limit, params.offset],
  )
  return r.rows
}

/** decision 列表总数（同过滤条件） */
export async function countIdentityDecisions(
  db: Pool,
  filter: ListIdentityDecisionsFilter,
): Promise<number> {
  const r = await db.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
       FROM identity_decisions d
      WHERE ($1::text IS NULL OR d.decision = $1)
        AND ($2::uuid IS NULL OR d.candidate_id = $2)
        AND ($3::boolean IS NULL OR (d.reverted_at IS NOT NULL) = $3)`,
    [filter.decision, filter.candidateId, filter.reverted],
  )
  return parseInt(r.rows[0]?.total ?? '0', 10)
}

// ── ⑥ audit timeline 派生：批量反查 audit 关联 decision（ADR-105 D-105-8 / CHG-VIR-13-C2）──

/** audit 派生用最小行（actorType 推导 + related ids 聚合） */
export interface DecisionByAuditRow {
  readonly id: string
  readonly candidate_id: string
  readonly video_merge_audit_id: string
  readonly actor_type: 'human' | 'system'
}

/**
 * 页内 audit ids 单 SQL 批量反查（零 N+1 / D-105-8）。
 * Y-105-T3：谓词 `video_merge_audit_id = ANY($1)` 蕴含 IS NOT NULL → 走
 * `idx_identity_decision_audit` partial 索引（WHERE video_merge_audit_id IS NOT NULL，
 * 实施卡 dev EXPLAIN 验证）。
 */
export async function findDecisionsByAuditIds(
  db: Pool,
  auditIds: string[],
): Promise<DecisionByAuditRow[]> {
  if (auditIds.length === 0) return []
  const r = await db.query<DecisionByAuditRow>(
    `SELECT id, candidate_id, video_merge_audit_id, actor_type
       FROM identity_decisions
      WHERE video_merge_audit_id = ANY($1::uuid[])
      ORDER BY created_at ASC`,
    [auditIds],
  )
  return r.rows
}

// ── ⑤ revive 联动：反查该 candidate 未撤销的 rejected decision（事务内 / ADR-179 D-179-2）──

/**
 * candidate 的未撤销 rejected decision（D-178-2 幂等口径保证至多一条）。
 * revive 事务内置 reverted 用——表达「拒绝裁定被人工推翻」（decision 值不改不新增行）。
 */
export async function findActiveRejectedDecisionByCandidateId(
  client: PoolClient,
  candidateId: string,
): Promise<{ id: string } | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id FROM identity_decisions
      WHERE candidate_id = $1 AND decision = 'rejected' AND reverted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [candidateId],
  )
  return r.rows[0] ?? null
}
