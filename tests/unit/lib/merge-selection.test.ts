/**
 * merge-selection.test.ts — 合并请求成形纯函数（CHG-VIR-17-PARTIAL FIX / Codex review）
 *
 * 核心守卫：target ∉ 合并集合 → null 结构性拒绝（被排除视频不得作为合并保留者）。
 * 锚点口径：candidateIds 仅含两端均在集合内的 pair（D-105a-18 遗留 ① / validateForMerge 契约）；
 * 全选语义与既有 group.candidateIds 路径逐值一致。
 */

import { describe, it, expect } from 'vitest'
import type { CandidateGroup } from '@resovo/types'
import { buildMergeSelection } from '../../../apps/server-next/src/lib/merge/merge-selection'

function video(id: string) {
  return {
    id, title: `V${id}`, titleNormalized: `v${id}`, year: 2020, type: 'anime' as const,
    createdAt: '2026-01-01T00:00:00Z', sourceCount: 1, sourceSiteKeys: [],
  }
}

function pair(candidateId: string, left: string, right: string) {
  return {
    leftVideoId: left, rightVideoId: right, identityScore: 0.9,
    strongNegativeReasons: [], blockingReasons: [], evidence: [],
    autoMergeBlocked: false, candidateId,
  }
}

/** N=3 折叠组（pairs a-b / b-c / a-c 全锚点） */
const CLUSTER: CandidateGroup = {
  groupKey: 'a|b|c',
  titleNormalized: 'x', year: 2020, type: 'anime',
  videos: [video('a'), video('b'), video('c')],
  score: 0.8,
  recommendedTargetVideoId: 'b',
  candidateIds: ['c1', 'c2', 'c3'],
  identity: {
    identityScore: 0.85, strongNegativeReasons: [], blockingReasons: [],
    autoMergeBlocked: false, scorerVersion: 'v1',
    pairs: [pair('c1', 'a', 'b'), pair('c2', 'b', 'c'), pair('c3', 'a', 'c')],
  },
}

describe('buildMergeSelection (CHG-VIR-17-PARTIAL FIX)', () => {
  it('核心守卫：target 不在选中集合 → null（被排除视频不得作为合并保留者）', () => {
    expect(buildMergeSelection(CLUSTER, 'b', ['a', 'c'])).toBeNull()
  })

  it('全组（缺省 selectedVideoIds）：sourceVideoIds = 其余成员 + candidateIds 全锚点', () => {
    expect(buildMergeSelection(CLUSTER, 'b')).toEqual({
      sourceVideoIds: ['a', 'c'],
      candidateIds: ['c1', 'c2', 'c3'],
    })
  })

  it('子集合并：candidateIds 仅含两端均在集合内的 pair（跨界 pair 不传 / 422 契约）', () => {
    expect(buildMergeSelection(CLUSTER, 'b', ['a', 'b'])).toEqual({
      sourceVideoIds: ['a'],
      candidateIds: ['c1'], // 仅 a-b；b-c（c2）/ a-c（c3）跨界不传
    })
  })

  it('选中不足 2 个 → 回退整组语义（快捷合并路径同口径）', () => {
    expect(buildMergeSelection(CLUSTER, 'b', ['b'])).toEqual({
      sourceVideoIds: ['a', 'c'],
      candidateIds: ['c1', 'c2', 'c3'],
    })
  })

  it('identity.pairs 无逐 pair 锚点（9-C 单数兼容形态）：全选 fallback group.candidateId；子集不 fallback', () => {
    const single: CandidateGroup = {
      ...CLUSTER,
      videos: [video('a'), video('b')],
      groupKey: 'a|b',
      candidateIds: undefined,
      candidateId: 'c-single',
      identity: {
        ...CLUSTER.identity!,
        pairs: [{ ...pair('c1', 'a', 'b'), candidateId: undefined }],
      },
    }
    expect(buildMergeSelection(single, 'b')).toEqual({
      sourceVideoIds: ['a'],
      candidateIds: ['c-single'],
    })
  })

  it('legacy 组（无 identity 锚点 / 无 candidateIds）→ candidateIds 字段不出现', () => {
    const legacy: CandidateGroup = {
      ...CLUSTER, identity: undefined, candidateIds: undefined,
    }
    const r = buildMergeSelection(legacy, 'b')
    expect(r).toEqual({ sourceVideoIds: ['a', 'c'] })
    expect(r).not.toHaveProperty('candidateIds')
  })
})
