/**
 * candidateUpsert.ts — identity_candidate 单事务幂等 upsert 编排（ADR-105a R5/R6 / D-105a-7）
 *
 * 编排（单 BEGIN/COMMIT，参 MediaCatalogService.findOrCreate 范式）：
 *   1. 查 rejected（复活判定 R6）：有 rejected + 新强正证据 → 复活链；否则压制（skip）。
 *   2. 查 pending（幂等 R5）：hash 同 → noop；hash 异 → 腾位旧 pending + 新建（superseded）。
 *   3. 无 pending → 新建（ON CONFLICT DO NOTHING 并发兜底 → 重查收敛）。
 * 强负命中不阻止候选生成（候选含 strongNegativeReasons 供人工解释，blocked 状态在 UI 层）。
 */

import type { Pool } from 'pg'
import type { EvidenceItem } from '@resovo/types'
import {
  findPendingByPairKey,
  findLatestRejectedByPairKey,
  insertCandidate,
  supersedePendingByPairKey,
  setSupersededBy,
  type IdentityCandidateInsert,
  type IdentityCandidateRow,
} from '@/api/db/queries/identity-candidate'

export interface UpsertCandidateInput extends IdentityCandidateInsert {
  /** 当前评分命中的全量 evidence（用于复活判定：是否含新强正 external_exact_id_match） */
  readonly evidenceItems: readonly EvidenceItem[]
}

export type UpsertOutcome =
  | { kind: 'noop'; candidateId: string }
  | { kind: 'created'; candidateId: string }
  | { kind: 'superseded'; oldId: string; newId: string }
  | { kind: 'skipped-rejected' }
  | { kind: 'revived'; fromId: string; newId: string }

/** 是否含命中的 external_exact_id_match 强正（复活判据 R6：新 exact ID 证据）。 */
function hasExactMatch(evidence: readonly EvidenceItem[]): boolean {
  return evidence.some((e) => e.type === 'external_exact_id_match' && e.hit)
}

/** rejected 行的 evidence_jsonb 是否已含 exact 命中（判定「新增」exact）。 */
function rejectedHadExact(rejected: IdentityCandidateRow): boolean {
  const ev = rejected.evidence_jsonb
  if (!Array.isArray(ev)) return false
  return (ev as EvidenceItem[]).some((e) => e?.type === 'external_exact_id_match' && e?.hit === true)
}

/** insert + 并发抢先重查收敛（ON CONFLICT DO NOTHING 返回 null 时）。 */
async function insertOrRecover(
  client: import('pg').PoolClient,
  input: IdentityCandidateInsert,
): Promise<IdentityCandidateRow> {
  const inserted = await insertCandidate(client, input)
  if (inserted) return inserted
  // 并发抢先占了 pending 槽位 → 重查收敛（参 findOrCreate ON CONFLICT DO NOTHING 重查）
  const recovered = await findPendingByPairKey(client, input.canonicalPairKey)
  if (!recovered) {
    throw new Error(`candidateUpsert: insert 被 ON CONFLICT 跳过但重查无 pending（pair=${input.canonicalPairKey}）`)
  }
  return recovered
}

/**
 * 单事务幂等 upsert。强负只影响 evidence/strongNegativeReasons 字段，不阻止候选写入
 * （候选含拦截原因供人工裁定 / D-105a-3）。
 */
export async function upsertIdentityCandidate(
  db: Pool,
  input: UpsertCandidateInput,
): Promise<UpsertOutcome> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // 1. 复活/压制判定（R6）：rejected 默认永久压制，仅新强正 exact 证据可复活
    const rejected = await findLatestRejectedByPairKey(client, input.canonicalPairKey)
    if (rejected) {
      const isNewStrongPositive = hasExactMatch(input.evidenceItems) && !rejectedHadExact(rejected)
      if (!isNewStrongPositive) {
        await client.query('COMMIT')
        return { kind: 'skipped-rejected' }
      }
      // 复活：新建 pending + revived_from 指向原 rejected（不覆盖原行 / R6）
      const revived = await insertOrRecover(client, { ...input, revivedFromCandidateId: rejected.id })
      await client.query('COMMIT')
      return { kind: 'revived', fromId: rejected.id, newId: revived.id }
    }

    // 2. 幂等（R5）：先比 hash → no-op；hash 异 → 腾位旧 pending + 新建
    const pending = await findPendingByPairKey(client, input.canonicalPairKey)
    if (pending) {
      if (pending.evidence_hash === input.evidenceHash) {
        await client.query('COMMIT')
        return { kind: 'noop', candidateId: pending.id }
      }
      const oldId = await supersedePendingByPairKey(client, input.canonicalPairKey)
      const created = await insertOrRecover(client, input)
      if (oldId) await setSupersededBy(client, oldId, created.id)
      await client.query('COMMIT')
      return { kind: 'superseded', oldId: oldId ?? pending.id, newId: created.id }
    }

    // 3. 无 pending → 新建
    const created = await insertOrRecover(client, input)
    await client.query('COMMIT')
    return { kind: 'created', candidateId: created.id }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
