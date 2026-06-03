/**
 * identity/index.ts — 多证据身份评分模块编排入口（ADR-105a / CHG-VIR-7 Phase 2a）
 *
 * Service 层唯一依赖面：scoreGroup(videos) → GroupIdentityScore。
 * 纯函数（parseTitle 确定性 + scorePair 无副作用）。
 */

import type { VideoSummaryForMerge, GroupIdentityScore } from '@resovo/types'
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

export { scorePair, aggregateGroup, SCORER_VERSION }
export { classifyTypePair, type TypeRelation } from './type-compat'
export type { PairSideInput, ExternalIdSummary } from './scorePair'
