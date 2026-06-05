/**
 * identity-collapse-pairs.test.ts — pending pair → connected components 页内折叠（CHG-VIR-9-D / D-105a-18）
 *
 * collapsePairs 纯函数：union-find 分量 + clusterKey 幂等（成员升序 join）+ 行序高分分量优先。
 */

import { describe, it, expect } from 'vitest'
import { collapsePairs } from '@/api/services/identity/collapsePairsToGroups'
import type { PendingCandidatePairRow } from '@/api/db/queries/identity-candidate'

function pair(id: string, left: string, right: string, score = '0.9000'): PendingCandidatePairRow {
  return {
    id, left_video_id: left, right_video_id: right, identity_score: score,
    legacy_score: null, strong_negative_reasons: [], evidence_jsonb: [], group_key: null,
  }
}

describe('collapsePairs', () => {
  it('空入参 → 空数组', () => {
    expect(collapsePairs([])).toEqual([])
  })

  it('单 pair → 单分量（N=2 退化），clusterKey = 两端升序 join', () => {
    const r = collapsePairs([pair('c1', 'b', 'a')])
    expect(r).toHaveLength(1)
    expect(r[0]!.clusterKey).toBe('a|b') // left/right 顺序无关，升序幂等
    expect(r[0]!.videoIds).toEqual(['a', 'b'])
    expect(r[0]!.pairs.map((p) => p.id)).toEqual(['c1'])
  })

  it('链式连通 a-b, b-c, c-d → 单分量 4 成员（传递闭包）', () => {
    const r = collapsePairs([
      pair('c1', 'a', 'b'),
      pair('c2', 'b', 'c'),
      pair('c3', 'c', 'd'),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]!.videoIds).toEqual(['a', 'b', 'c', 'd'])
    expect(r[0]!.clusterKey).toBe('a|b|c|d')
    expect(r[0]!.pairs).toHaveLength(3)
  })

  it('多分量互不串联 + 行序 = 各分量最高分 pair 首现序（入参已 score DESC）', () => {
    const r = collapsePairs([
      pair('c1', 'a', 'b', '0.9500'),
      pair('c4', 'x', 'y', '0.9200'),
      pair('c2', 'b', 'c', '0.9000'),
    ])
    expect(r).toHaveLength(2)
    expect(r[0]!.clusterKey).toBe('a|b|c')
    expect(r[1]!.clusterKey).toBe('x|y')
  })

  it('迟到边桥接两个已建分量 → 合并为单分量（union 顺序无关）', () => {
    const r = collapsePairs([
      pair('c1', 'a', 'b'),
      pair('c2', 'x', 'y'),
      pair('c3', 'b', 'x'), // 桥接 {a,b} 与 {x,y}
    ])
    expect(r).toHaveLength(1)
    expect(r[0]!.videoIds).toEqual(['a', 'b', 'x', 'y'])
    expect(r[0]!.pairs.map((p) => p.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('clusterKey 幂等：同一分量不同 pair 顺序入参 → 同 key（rowKey/expandedKeys 稳定）', () => {
    const k1 = collapsePairs([pair('c1', 'a', 'b'), pair('c2', 'b', 'c')])[0]!.clusterKey
    const k2 = collapsePairs([pair('c2', 'c', 'b'), pair('c1', 'b', 'a')])[0]!.clusterKey
    expect(k1).toBe(k2)
  })

  // ── D-105a-19（CHG-VIR-16-TBL-BE / 评审 Y-4）：泛型化 PairCluster<T> ────────

  it('轻列行（结构性最小输入）→ 折叠成立且出参 pairs 保留入参元素类型', () => {
    const light = [
      { id: 'c1', left_video_id: 'a', right_video_id: 'b', identity_score: '0.9000', canonical_pair_key: 'a|b' },
      { id: 'c2', left_video_id: 'b', right_video_id: 'c', identity_score: '0.8500', canonical_pair_key: 'b|c' },
    ]
    const r = collapsePairs(light)
    expect(r).toHaveLength(1)
    expect(r[0]!.clusterKey).toBe('a|b|c')
    // 出参元素 = 入参元素（泛型保留：轻列字段可访问，无 evidence 重列）
    expect(r[0]!.pairs.map((p) => p.canonical_pair_key)).toEqual(['a|b', 'b|c'])
    expect(r[0]!.pairs.map((p) => p.identity_score)).toEqual(['0.9000', '0.8500'])
  })
})
