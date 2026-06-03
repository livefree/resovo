/**
 * identity/index.ts — 多证据身份评分模块编排入口（ADR-105a / CHG-VIR-7 Phase 2a）
 *
 * Service 层唯一依赖面：scoreGroup(videos) → GroupIdentityScore。
 * 纯函数（parseTitle 确定性 + scorePair 无副作用）。
 */

import type { VideoSummaryForMerge, GroupIdentityScore, PairScore } from '@resovo/types'
import { parseTitle } from '../TitleIdentityParser'
import { scorePair, type PairSideInput } from './scorePair'
import { aggregateGroup } from './aggregateGroup'
import { SCORER_VERSION } from './weights'

/**
 * Phase 2a 编排：从候选组 VideoSummaryForMerge[]（含原始 title）评分。
 * parseTitle 解析每 video.title 得 facets → 生成所有 unordered pair PairScore → 聚合。
 * 外部 ID 不拉取 → PairSideInput.externalIds 留 undefined（标未评估，留 Phase 2b）。
 */
export function scoreGroup(videos: readonly VideoSummaryForMerge[]): GroupIdentityScore {
  const sides: PairSideInput[] = videos.map((v) => {
    const parsed = parseTitle(v.title)
    return {
      videoId: v.id,
      coreTitleKey: parsed.coreTitleKey,
      facets: parsed.facets,
      year: v.year,
      type: v.type,
      sourceSiteKeys: v.sourceSiteKeys,
    }
  })

  const pairs = []
  for (let i = 0; i < sides.length; i++) {
    for (let j = i + 1; j < sides.length; j++) {
      pairs.push(scorePair(sides[i]!, sides[j]!))
    }
  }

  return aggregateGroup(pairs, SCORER_VERSION)
}

/**
 * Phase 2b 离线 job 编排：对 blocking 召回收敛后的显式 pair 列表评分（externalIds 由 loader 填实）。
 * 复用 scorePair（不改其函数体）；pair 来源从「组内 C(N,2)」换为「blocking 收敛 pair」
 * —— D-105a-2「Blocking 禁 pairwise 全量，先经高选择性 key 收敛」的落地点。
 */
export function scoreCandidatePairs(
  sides: readonly PairSideInput[],
  candidatePairs: readonly (readonly [string, string])[],
): PairScore[] {
  const sideMap = new Map(sides.map((s) => [s.videoId, s]))
  const out: PairScore[] = []
  for (const [a, b] of candidatePairs) {
    const sa = sideMap.get(a)
    const sb = sideMap.get(b)
    if (sa && sb) out.push(scorePair(sa, sb))
  }
  return out
}

export { scorePair, aggregateGroup, SCORER_VERSION }
export { THRESHOLD_CONFIG_VERSION } from './weights'
export { classifyTypePair, type TypeRelation } from './type-compat'
export type { PairSideInput, ExternalIdSummary } from './scorePair'
// Phase 2b
export { computeEvidenceHash, type EvidenceHashInput, type PairFieldSnapshot } from './evidenceHash'
export { upsertIdentityCandidate, type UpsertCandidateInput, type UpsertOutcome } from './candidateUpsert'
export { loadExternalIdSummaries } from './externalIdLoader'
export { runIdentityRescore, type IdentityRescoreOptions, type IdentityRescoreResult } from './offlineRescore'
