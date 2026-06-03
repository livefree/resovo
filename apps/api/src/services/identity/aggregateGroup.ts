/**
 * aggregateGroup.ts — group→单值聚合（ADR-105a D-105a-15 / CHG-VIR-6.5）
 *
 * 严格继承 D-105a-9「group→pair：所有 unordered pair」映射，对 C(N,2) pair 投影单值：
 * - identityScore = min over pairs（保守口径，反映组内最弱链接）
 * - strongNegativeReasons / blockingReasons = union（去重有序）
 * - autoMergeBlocked = 任一 pair veto
 * 零 recommendedTarget 锚原语（红线 B1）。
 */

import type { EvidenceType, GroupIdentityScore, PairScore } from '@resovo/types'

/** 去重保序（首次出现序）。 */
function uniqueOrdered(values: readonly EvidenceType[]): EvidenceType[] {
  const seen = new Set<EvidenceType>()
  const out: EvidenceType[] = []
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

/**
 * 聚合 group 全部 unordered pair 的 PairScore[] 为单值。
 * N=2 退化为单 pair（min/union = 该 pair）。空 pairs 防御（不可达，避免 Math.min(...[])=Infinity）。
 */
export function aggregateGroup(
  pairs: readonly PairScore[],
  scorerVersion: string,
): GroupIdentityScore {
  if (pairs.length === 0) {
    return {
      identityScore: 0,
      strongNegativeReasons: [],
      blockingReasons: [],
      autoMergeBlocked: false,
      pairs: [],
      scorerVersion,
    }
  }

  let minScore = Infinity
  const negatives: EvidenceType[] = []
  const blockings: EvidenceType[] = []
  let blocked = false

  for (const p of pairs) {
    if (p.identityScore < minScore) minScore = p.identityScore
    negatives.push(...p.strongNegativeReasons)
    blockings.push(...p.blockingReasons)
    if (p.autoMergeBlocked) blocked = true
  }

  return {
    identityScore: Math.round(minScore * 10000) / 10000,
    strongNegativeReasons: uniqueOrdered(negatives),
    blockingReasons: uniqueOrdered(blockings),
    autoMergeBlocked: blocked,
    pairs,
    scorerVersion,
  }
}
