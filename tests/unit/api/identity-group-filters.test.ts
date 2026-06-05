/**
 * identity-group-filters.test.ts — 候选组级筛选/搜索谓词 + 组级排序
 * （ADR-105a AMENDMENT 2026-06-05 D-105a-19 / CHG-VIR-16-TBL-BE）
 *
 * identity/legacy 双路径共用纯函数：区间谓词 / q 双口径（评审 Y-2）/ 排序白名单 +
 * clusterKey tiebreak（评审 Y-3 最弱链接主导组序）。
 */

import { describe, it, expect } from 'vitest'
import {
  groupMatchesFilters,
  titleMatchesQuery,
  clusterTitles,
  sortIdentityClusterEntries,
  type IdentityClusterEntry,
  type GroupMetaLight,
} from '@/api/services/identity/groupFilters'

describe('titleMatchesQuery（q 双口径 / 评审 Y-2）', () => {
  it('原始 title lower-case contains 命中（主口径）', () => {
    expect(titleMatchesQuery('斗破', '斗破苍穹 年番', '斗破苍穹年番')).toBe(true)
    expect(titleMatchesQuery('DOU', 'Dou Po Cang Qiong', 'doupocangqiong')).toBe(true)
  })

  it('normalizeMergeKey(q) contains title_normalized 辅召回（标点剥除对齐；词间空格保留 R1）', () => {
    // raw q 带顿号在原始 title 上漏检 → normalized 辅口径召回（normalizeMergeKey 剥 \p{P}/\p{S}）
    expect(titleMatchesQuery('当前、正被打扰', '当前正被打扰中！', '当前正被打扰中')).toBe(true)
  })

  it('双口径均不命中 → false', () => {
    expect(titleMatchesQuery('完美世界', '斗破苍穹', '斗破苍穹')).toBe(false)
  })
})

describe('groupMatchesFilters（区间 AND q 任一成员命中）', () => {
  const base = { identityScore: 0.9, videoCount: 3 }

  it('参数缺省 = 不约束', () => {
    expect(groupMatchesFilters(base, {})).toBe(true)
  })

  it('identityScore 区间（含边界）', () => {
    expect(groupMatchesFilters(base, { identityScoreMin: 0.9 })).toBe(true)
    expect(groupMatchesFilters(base, { identityScoreMin: 0.91 })).toBe(false)
    expect(groupMatchesFilters(base, { identityScoreMax: 0.9 })).toBe(true)
    expect(groupMatchesFilters(base, { identityScoreMax: 0.89 })).toBe(false)
  })

  it('videoCount 区间', () => {
    expect(groupMatchesFilters(base, { videoCountMin: 3, videoCountMax: 3 })).toBe(true)
    expect(groupMatchesFilters(base, { videoCountMin: 4 })).toBe(false)
    expect(groupMatchesFilters(base, { videoCountMax: 2 })).toBe(false)
  })

  it('q 任一成员命中即过；titles 缺省（空集）→ q 激活时不命中', () => {
    const titles = [
      { title: '星辰变', titleNormalized: '星辰变' },
      { title: '斗破苍穹', titleNormalized: '斗破苍穹' },
    ]
    expect(groupMatchesFilters({ ...base, titles }, { q: '斗破' })).toBe(true)
    expect(groupMatchesFilters({ ...base, titles }, { q: '完美' })).toBe(false)
    expect(groupMatchesFilters(base, { q: '斗破' })).toBe(false)
  })

  it('区间 AND q 联合（任一不满足即拒）', () => {
    const titles = [{ title: '斗破苍穹', titleNormalized: '斗破苍穹' }]
    expect(groupMatchesFilters({ ...base, titles }, { identityScoreMin: 0.8, q: '斗破' })).toBe(true)
    expect(groupMatchesFilters({ ...base, titles }, { identityScoreMin: 0.95, q: '斗破' })).toBe(false)
  })
})

describe('clusterTitles（meta 缺行防御性跳过）', () => {
  it('按成员序提取 title/titleNormalized；缺 meta 成员跳过', () => {
    const metaMap = new Map<string, GroupMetaLight>([
      ['a', { id: 'a', title: 'A 篇', title_normalized: 'a篇', year: 2020 }],
      ['c', { id: 'c', title: 'C 篇', title_normalized: 'c篇', year: 2021 }],
    ])
    expect(clusterTitles(['a', 'b', 'c'], metaMap)).toEqual([
      { title: 'A 篇', titleNormalized: 'a篇' },
      { title: 'C 篇', titleNormalized: 'c篇' },
    ])
  })
})

describe('sortIdentityClusterEntries（D-105a-19 stage 4）', () => {
  function entry(clusterKey: string, identityScore: number, videoCount: number, videoIds?: string[]): IdentityClusterEntry & { clusterKey: string } {
    return { clusterKey, videoIds: videoIds ?? clusterKey.split('|'), identityScore, videoCount }
  }

  it('缺省（无 sortField）→ identityScore DESC + clusterKey tiebreak', () => {
    const entries = [entry('a|b', 0.8, 2), entry('x|y', 0.9, 2), entry('m|n', 0.8, 2)]
    sortIdentityClusterEntries(entries, undefined, undefined, undefined)
    expect(entries.map((e) => e.clusterKey)).toEqual(['x|y', 'a|b', 'm|n'])
  })

  it('白名单外字段（score=legacyScore 轻列不可得）→ 走缺省 identityScore', () => {
    const entries = [entry('a|b', 0.8, 2), entry('x|y', 0.9, 2)]
    sortIdentityClusterEntries(entries, 'score', 'asc', undefined)
    // 字段回落 identityScore，方向尊重 asc
    expect(entries.map((e) => e.clusterKey)).toEqual(['a|b', 'x|y'])
  })

  it('videoCount asc/desc', () => {
    const entries = [entry('a|b|c', 0.8, 3), entry('x|y', 0.9, 2)]
    sortIdentityClusterEntries(entries, 'videoCount', 'asc', undefined)
    expect(entries[0]!.clusterKey).toBe('x|y')
    sortIdentityClusterEntries(entries, 'videoCount', 'desc', undefined)
    expect(entries[0]!.clusterKey).toBe('a|b|c')
  })

  it('titleNormalized / year 经组代表 meta（升序首个有 meta 成员）排序', () => {
    const metaMap = new Map<string, GroupMetaLight>([
      ['a', { id: 'a', title: 'Beta', title_normalized: 'beta', year: 2022 }],
      ['x', { id: 'x', title: 'Alpha', title_normalized: 'alpha', year: 2020 }],
    ])
    const entries = [entry('a|b', 0.8, 2), entry('x|y', 0.9, 2)]
    sortIdentityClusterEntries(entries, 'titleNormalized', 'asc', metaMap)
    expect(entries[0]!.clusterKey).toBe('x|y') // alpha < beta
    sortIdentityClusterEntries(entries, 'year', 'desc', metaMap)
    expect(entries[0]!.clusterKey).toBe('a|b') // 2022 > 2020
  })
})
