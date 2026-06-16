/**
 * identity-scorer.test.ts — 多证据身份评分纯函数单测（SEQ-20260602-03 / CHG-VIR-7 Phase 2a）
 *
 * 覆盖 ADR-105a：
 *  - D-105a-3 聚合公式（rawScore / nonExactScore 封顶 0.90 / exactScore 饱和 0.95 / 强负 veto 不减分）
 *  - D-105a-5 type 矩阵 + exact 仅豁免 type_incompatible 单条（YY-3）
 *  - D-105a-14 release_marker_mismatch（双非 null 不同才 veto；null↔非 null 弱信号不 veto）
 *  - D-105a-15 group→单值（min over pairs / union reasons）
 */

import { describe, it, expect } from 'vitest'
import type { VideoType, PairScore } from '@resovo/types'
import type { TitleFacets } from '@/api/services/TitleIdentityParser'
import {
  scorePair,
  aggregateGroup,
  classifyTypePair,
  scoreGroup,
  SCORER_VERSION,
  type PairSideInput,
  type ExternalIdSummary,
} from '@/api/services/identity'

// ── helpers ───────────────────────────────────────────────────────

function facets(over: Partial<TitleFacets> = {}): TitleFacets {
  return {
    seasonNumber: null,
    edition: null,
    audioLanguage: null, subtitleMarker: null, subtitleLanguages: [],
    releaseMarker: null,
    qualityNoise: [],
    sourceNoise: [],
    bracketTokens: [],
    ...over,
  }
}

function side(over: Partial<PairSideInput> = {}): PairSideInput {
  return {
    videoId: 'v',
    coreTitleKey: 'core',
    facets: facets(),
    year: 2020,
    type: 'movie',
    sourceSiteKeys: [],
    ...over,
  }
}

const exactIds = (ids: Record<string, string>): ExternalIdSummary => ({ exactIds: ids })

// ── D-105a-3 聚合公式 ──────────────────────────────────────────────

describe('scorePair — D-105a-3 聚合公式', () => {
  it('基线：core+year+type 中正 = 0.60（< 0.75，none 区间）', () => {
    const p = scorePair(side({ videoId: 'a' }), side({ videoId: 'b' }))
    expect(p.identityScore).toBeCloseTo(0.6, 4)
    expect(p.blockingReasons).toEqual(
      expect.arrayContaining(['core_title_key_equal', 'year_equal_or_off_by_one', 'type_compatible']),
    )
    expect(p.autoMergeBlocked).toBe(false)
  })

  it('+source_fingerprint 高重叠 = 0.90（恰封顶 NON_EXACT_CAP）', () => {
    const keys = ['s1', 's2', 's3']
    const p = scorePair(side({ videoId: 'a', sourceSiteKeys: keys }), side({ videoId: 'b', sourceSiteKeys: keys }))
    expect(p.identityScore).toBeCloseTo(0.9, 4)
    expect(p.blockingReasons).toContain('source_fingerprint_high_overlap')
  })

  it('非 exact 路径永不越 0.92（封顶守卫）', () => {
    const keys = ['s1', 's2']
    const p = scorePair(side({ videoId: 'a', sourceSiteKeys: keys }), side({ videoId: 'b', sourceSiteKeys: keys }))
    expect(p.identityScore).toBeLessThan(0.92)
  })

  it('source_fingerprint Jaccard < 0.6 不命中', () => {
    const p = scorePair(
      side({ videoId: 'a', sourceSiteKeys: ['s1', 's2', 's3', 's4'] }),
      side({ videoId: 'b', sourceSiteKeys: ['s1'] }),
    )
    // Jaccard = 1/4 = 0.25 < 0.6
    expect(p.blockingReasons).not.toContain('source_fingerprint_high_overlap')
  })

  it('core_title_key 不同 → core_title_key_equal 不命中（仅 year+type = 0.25）', () => {
    const p = scorePair(side({ videoId: 'a', coreTitleKey: 'x' }), side({ videoId: 'b', coreTitleKey: 'y' }))
    expect(p.blockingReasons).not.toContain('core_title_key_equal')
    expect(p.identityScore).toBeCloseTo(0.25, 4)
  })
})

// ── D-105a-14 release_marker_mismatch ──────────────────────────────

describe('scorePair — D-105a-14 release_marker', () => {
  it('双非 null 不同（剧场版 vs OVA）→ veto + autoMergeBlocked', () => {
    const p = scorePair(
      side({ videoId: 'a', facets: facets({ releaseMarker: '剧场版' }) }),
      side({ videoId: 'b', facets: facets({ releaseMarker: 'OVA' }) }),
    )
    expect(p.strongNegativeReasons).toContain('release_marker_mismatch')
    expect(p.autoMergeBlocked).toBe(true)
    // veto 命中时 identityScore 仍计算（D-105a-3）
    expect(p.identityScore).toBeGreaterThan(0)
  })

  it('null ↔ 非 null（正篇 vs 剧场版）→ 不 veto，产弱信号', () => {
    const p = scorePair(
      side({ videoId: 'a', facets: facets({ releaseMarker: null }) }),
      side({ videoId: 'b', facets: facets({ releaseMarker: '剧场版' }) }),
    )
    expect(p.strongNegativeReasons).not.toContain('release_marker_mismatch')
    expect(p.autoMergeBlocked).toBe(false)
    expect(p.evidence.some((e) => e.type === 'release_marker_weak_signal' && e.hit)).toBe(true)
    // 弱信号不计入 blockingReasons（不计分）
    expect(p.blockingReasons).not.toContain('release_marker_weak_signal')
  })

  it('双非 null 同值（剧场版 vs 剧场版）→ 不冲突不 veto', () => {
    const p = scorePair(
      side({ videoId: 'a', facets: facets({ releaseMarker: '剧场版' }) }),
      side({ videoId: 'b', facets: facets({ releaseMarker: '剧场版' }) }),
    )
    expect(p.strongNegativeReasons).not.toContain('release_marker_mismatch')
    expect(p.autoMergeBlocked).toBe(false)
  })
})

// ── season_mismatch（口径对齐 D-105a-14）────────────────────────────

describe('scorePair — season_mismatch', () => {
  it('双非 null 不同 → veto', () => {
    const p = scorePair(
      side({ videoId: 'a', facets: facets({ seasonNumber: 1 }) }),
      side({ videoId: 'b', facets: facets({ seasonNumber: 2 }) }),
    )
    expect(p.strongNegativeReasons).toContain('season_mismatch')
    expect(p.autoMergeBlocked).toBe(true)
  })

  it('null ↔ 非 null 不 veto（保守口径）', () => {
    const p = scorePair(
      side({ videoId: 'a', facets: facets({ seasonNumber: null }) }),
      side({ videoId: 'b', facets: facets({ seasonNumber: 2 }) }),
    )
    expect(p.strongNegativeReasons).not.toContain('season_mismatch')
  })
})

// ── D-105a-5 exact 豁免（YY-3：仅豁免 type_incompatible 单条）──────────

describe('scorePair — exact 豁免边界', () => {
  it('exact 命中 + type_incompatible → 豁免 type_incompatible，identityScore=0.95', () => {
    const ext = exactIds({ imdb: 'tt1' })
    const p = scorePair(
      side({ videoId: 'a', type: 'movie' as VideoType, externalIds: ext }),
      side({ videoId: 'b', type: 'series' as VideoType, externalIds: ext }),
    )
    expect(p.identityScore).toBeCloseTo(0.95, 4)
    expect(p.strongNegativeReasons).not.toContain('type_incompatible')
    expect(p.blockingReasons).toContain('external_exact_id_match')
    expect(p.autoMergeBlocked).toBe(false)
  })

  it('exact 命中 + season_mismatch → season 仍 veto（exact 不豁免其余）', () => {
    const ext = exactIds({ imdb: 'tt1' })
    const p = scorePair(
      side({ videoId: 'a', facets: facets({ seasonNumber: 1 }), externalIds: ext }),
      side({ videoId: 'b', facets: facets({ seasonNumber: 2 }), externalIds: ext }),
    )
    expect(p.strongNegativeReasons).toContain('season_mismatch')
    expect(p.autoMergeBlocked).toBe(true)
    expect(p.identityScore).toBeCloseTo(0.95, 4) // 分仍饱和，但 blocked
  })

  it('exact 命中 + release_marker_mismatch → 仍 veto（D-105a-14 A2）', () => {
    const ext = exactIds({ imdb: 'tt1' })
    const p = scorePair(
      side({ videoId: 'a', facets: facets({ releaseMarker: '剧场版' }), externalIds: ext }),
      side({ videoId: 'b', facets: facets({ releaseMarker: 'OVA' }), externalIds: ext }),
    )
    expect(p.strongNegativeReasons).toContain('release_marker_mismatch')
    expect(p.autoMergeBlocked).toBe(true)
  })

  it('exact 不命中（同 provider 不同 id）→ external_id_conflict veto', () => {
    const p = scorePair(
      side({ videoId: 'a', externalIds: exactIds({ imdb: 'tt1' }) }),
      side({ videoId: 'b', externalIds: exactIds({ imdb: 'tt2' }) }),
    )
    expect(p.strongNegativeReasons).toContain('external_id_conflict')
    expect(p.blockingReasons).not.toContain('external_exact_id_match')
  })

  it('Phase 2a 外部 ID 未拉取 → 不产 external 占位 evidence（p95 预算 / D-105a-10）', () => {
    const p = scorePair(side({ videoId: 'a' }), side({ videoId: 'b' }))
    const ext = p.evidence.filter((e) => e.type.startsWith('external_') || e.type === 'same_site_canonical_id')
    expect(ext.length).toBe(0)
    expect(p.blockingReasons).not.toContain('external_exact_id_match')
  })
})

// ── D-105a-5 type 矩阵 ──────────────────────────────────────────────

describe('classifyTypePair — D-105a-5 矩阵', () => {
  it('同 type → compatible', () => {
    expect(classifyTypePair('movie', 'movie')).toBe('compatible')
  })
  it('anime ↔ series → compatible（常见误标）', () => {
    expect(classifyTypePair('anime', 'series')).toBe('compatible')
    expect(classifyTypePair('series', 'anime')).toBe('compatible') // 双向归一
  })
  it('movie ↔ series → incompatible', () => {
    expect(classifyTypePair('movie', 'series')).toBe('incompatible')
  })
  it('movie ↔ short → weak', () => {
    expect(classifyTypePair('movie', 'short')).toBe('weak')
  })
  it('含 other → weak', () => {
    expect(classifyTypePair('other', 'movie')).toBe('weak')
  })
  it('未列组合 → neutral', () => {
    expect(classifyTypePair('documentary', 'series')).toBe('neutral')
  })
})

// ── D-105a-15 group→单值聚合 ────────────────────────────────────────

describe('aggregateGroup — D-105a-15 min/union', () => {
  function pair(over: Partial<PairScore>): PairScore {
    return {
      leftVideoId: 'l',
      rightVideoId: 'r',
      identityScore: 0.8,
      strongNegativeReasons: [],
      blockingReasons: [],
      evidence: [],
      autoMergeBlocked: false,
      ...over,
    }
  }

  it('N=2 退化为单 pair', () => {
    const g = aggregateGroup([pair({ identityScore: 0.7, blockingReasons: ['core_title_key_equal'] })], SCORER_VERSION)
    expect(g.identityScore).toBeCloseTo(0.7, 4)
    expect(g.blockingReasons).toEqual(['core_title_key_equal'])
    expect(g.autoMergeBlocked).toBe(false)
  })

  it('N=3：identityScore=min，reasons=union，任一 veto → group blocked', () => {
    const g = aggregateGroup(
      [
        pair({ identityScore: 0.8, blockingReasons: ['core_title_key_equal'] }),
        pair({ identityScore: 0.6, strongNegativeReasons: ['season_mismatch'], autoMergeBlocked: true }),
        pair({ identityScore: 0.9, blockingReasons: ['source_fingerprint_high_overlap'] }),
      ],
      SCORER_VERSION,
    )
    expect(g.identityScore).toBeCloseTo(0.6, 4) // min
    expect(g.strongNegativeReasons).toEqual(['season_mismatch'])
    expect(g.blockingReasons).toEqual(['core_title_key_equal', 'source_fingerprint_high_overlap']) // union 去重保序
    expect(g.autoMergeBlocked).toBe(true)
    expect(g.scorerVersion).toBe(SCORER_VERSION)
  })

  it('空 pairs 防御（不可达）→ identityScore 0 不 NaN', () => {
    const g = aggregateGroup([], SCORER_VERSION)
    expect(g.identityScore).toBe(0)
    expect(Number.isNaN(g.identityScore)).toBe(false)
  })
})

// ── scoreGroup 端到端（parseTitle → 评分）────────────────────────────

describe('scoreGroup — 端到端 D-105a-14 核心场景', () => {
  function video(id: string, title: string) {
    return {
      id,
      title,
      titleNormalized: 'x',
      year: 2020,
      type: 'anime' as VideoType,
      createdAt: '2026-01-01T00:00:00Z',
      sourceCount: 1,
      sourceSiteKeys: [] as string[],
    }
  }

  it('正篇 vs 剧场版（null↔非 null）→ 不 blocked（弱信号走人工候选）', () => {
    const g = scoreGroup([video('a', '某科幻动画'), video('b', '某科幻动画 剧场版')])
    expect(g.autoMergeBlocked).toBe(false)
    expect(g.pairs).toHaveLength(1)
  })

  it('剧场版 vs OVA（双非 null 不同）→ blocked + release_marker_mismatch', () => {
    const g = scoreGroup([video('a', '某科幻动画 剧场版'), video('b', '某科幻动画 OVA')])
    expect(g.autoMergeBlocked).toBe(true)
    expect(g.strongNegativeReasons).toContain('release_marker_mismatch')
  })

  it('确定性：同输入恒等产出', () => {
    const vids = [video('a', '某动画'), video('b', '某动画')]
    expect(scoreGroup(vids)).toEqual(scoreGroup(vids))
  })
})

// ── ADR-206 M-2A-3：aliasBlockingKeys 对评分零影响（休眠 external_alias_match 不激活的代码级保证）──

describe('scorePair — aliasBlockingKeys 零 diff 守护（M-2A-3）', () => {
  it('有/无 aliasBlockingKeys → PairScore 逐字段恒等（评分逻辑绝不读取段③字段）', () => {
    const baseA = side({ videoId: 'a', coreTitleKey: '海贼王', sourceSiteKeys: ['s1'] })
    const baseB = side({ videoId: 'b', coreTitleKey: '航海王', sourceSiteKeys: ['s1'] })
    const withAlias = scorePair(
      { ...baseA, aliasBlockingKeys: ['海贼王', '航海王', 'one piece'] },
      { ...baseB, aliasBlockingKeys: ['航海王', 'one piece'] },
    )
    const without = scorePair(baseA, baseB)
    // identityScore / evidence / strongNegativeReasons / blockingReasons 全等
    expect(withAlias).toEqual(without)
  })

  it('含 externalIds + aliasBlockingKeys → 与仅 externalIds 评分恒等（别名键不串入 external_alias_match）', () => {
    const a = side({ videoId: 'a', coreTitleKey: 'k', externalIds: exactIds({ imdb: 'tt1' }) })
    const b = side({ videoId: 'b', coreTitleKey: 'k', externalIds: exactIds({ imdb: 'tt1' }) })
    const withAlias = scorePair(
      { ...a, aliasBlockingKeys: ['x', 'y'] },
      { ...b, aliasBlockingKeys: ['x', 'y'] },
    )
    const without = scorePair(a, b)
    expect(withAlias).toEqual(without)
    // external_alias_match evidence 不得出现（休眠维度未激活）
    expect(withAlias.evidence.some((e) => e.type === 'external_alias_match')).toBe(false)
  })
})
