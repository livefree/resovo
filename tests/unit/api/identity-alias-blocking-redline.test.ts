/**
 * identity-alias-blocking-redline.test.ts — alias blocking 误并防护回归锁（META-50-2B / ADR-206 D-206-6/6a/10）
 *
 * 2A-2 段③ 扩了 blocking 召回面（跨译名 pair 进评分）。本卡以显式 fixture 锁定误并三红线，
 * 防未来误激活 alias-as-evidence / 误并同名不同作：
 *  ① external_alias_match 永久休眠（D-206-6a）：scorePair 永不发射该 evidence；激活须另开 ADR amendment。
 *  ② alias 召回不入评分（D-206-6a）：仅共享 alias 桶不改 identityScore（alias 贡献 0 分）。
 *  ③ 同名不同作不误并（D-206-6/10）：同 core + year_far → year_far_no_exact 强负 veto，alias 不削弱。
 *  ④ 跨译名不自动合并（D-206-6c）：非 exact 封顶 NON_EXACT_CAP(0.90) < 0.92 → 结构上永不自动绑定。
 *
 * 纯 scorePair/weights 层（无 DB / 无 mock）——评分契约不变是误并防护的代码级真源。
 */

import { describe, it, expect } from 'vitest'
import type { VideoType } from '@resovo/types'
import type { TitleFacets } from '@/api/services/TitleIdentityParser'
import { scorePair, type PairSideInput, type ExternalIdSummary } from '@/api/services/identity'
import {
  POSITIVE_WEIGHTS,
  EVIDENCE_POLARITY,
  NON_EXACT_CAP,
  STRONG_NEGATIVE_SET,
} from '@/api/services/identity/weights'

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
    type: 'movie' as VideoType,
    sourceSiteKeys: [],
    ...over,
  }
}

const exactIds = (ids: Record<string, string>, aliasKeys?: string[]): ExternalIdSummary =>
  aliasKeys ? { exactIds: ids, aliasKeys } : { exactIds: ids }

// ── ① external_alias_match 永久休眠（D-206-6a 回归锁）──────────────────────

describe('误并红线①：external_alias_match 永久休眠（D-206-6a）', () => {
  it('weights 中定义存在但 scorePair 永不发射该 evidence（任意输入）', () => {
    // 权重表保留定义（休眠，未删）——但无任何 eval 消费
    expect(POSITIVE_WEIGHTS.external_alias_match).toBe(0.45)
    expect(EVIDENCE_POLARITY.external_alias_match).toBe('strong-positive')

    const variants: PairSideInput[][] = [
      [side({ videoId: 'a' }), side({ videoId: 'b' })],
      // externalIds.aliasKeys 双设（休眠字段）——仍不得激活
      [
        side({ videoId: 'a', externalIds: exactIds({}, ['航海王', 'one piece']) }),
        side({ videoId: 'b', externalIds: exactIds({}, ['航海王', 'one piece']) }),
      ],
      // 段③ aliasBlockingKeys 双设——blocking 字段不入评分
      [
        side({ videoId: 'a', aliasBlockingKeys: ['航海王', 'one piece'] }),
        side({ videoId: 'b', aliasBlockingKeys: ['航海王', 'one piece'] }),
      ],
    ]
    for (const [l, r] of variants) {
      const p = scorePair(l, r)
      expect(p.evidence.some((e) => e.type === 'external_alias_match')).toBe(false)
      expect(p.blockingReasons).not.toContain('external_alias_match')
    }
  })

  it('externalIds.aliasKeys 设值不改变 identityScore（休眠字段对评分零贡献）', () => {
    const base = [side({ videoId: 'a', coreTitleKey: 'k' }), side({ videoId: 'b', coreTitleKey: 'k' })] as const
    const withAliasKeys = scorePair(
      { ...base[0], externalIds: exactIds({}, ['x', 'y']) },
      { ...base[1], externalIds: exactIds({}, ['x', 'y']) },
    )
    // externalIds 设了（即便 exactIds 空）会触发 evalExternalIds 产 2 条 evidence；故与「无 externalIds」对比
    // 用「externalIds 空 exactIds 无 aliasKeys」作基线，验证 aliasKeys 字段本身零贡献
    const withoutAliasKeys = scorePair(
      { ...base[0], externalIds: exactIds({}) },
      { ...base[1], externalIds: exactIds({}) },
    )
    expect(withAliasKeys.identityScore).toBe(withoutAliasKeys.identityScore)
    expect(withAliasKeys.evidence).toEqual(withoutAliasKeys.evidence)
  })
})

// ── ② alias 桶召回不入评分（D-206-6a）────────────────────────────────────

describe('误并红线②：alias 桶召回仅扩召回面、不入评分（D-206-6a）', () => {
  it('仅共享 aliasBlockingKeys（无其它差异）→ identityScore 与无 alias 时逐字节相等', () => {
    const l = side({ videoId: 'a', coreTitleKey: 'k', sourceSiteKeys: ['s1'] })
    const r = side({ videoId: 'b', coreTitleKey: 'k', sourceSiteKeys: ['s1'] })
    const withAlias = scorePair(
      { ...l, aliasBlockingKeys: ['航海王'] },
      { ...r, aliasBlockingKeys: ['航海王'] },
    )
    const without = scorePair(l, r)
    expect(withAlias).toEqual(without)
  })
})

// ── ③ 同名不同作不误并（D-206-6/10）──────────────────────────────────────

describe('误并红线③：同名不同作（同 core 但 year_far）→ 强负 veto 不被 alias 削弱（D-206-6/10）', () => {
  it('复仇者 2012 vs 复仇者 1998（共享 alias 桶）→ year_far_no_exact veto + autoMergeBlocked', () => {
    // 两部不同作品恰好同名「复仇者」，年份相差 14（≥2）且无 exact ID → 强负否决
    const l = side({ videoId: 'a', coreTitleKey: '复仇者', year: 2012, aliasBlockingKeys: ['复仇者'] })
    const r = side({ videoId: 'b', coreTitleKey: '复仇者', year: 1998, aliasBlockingKeys: ['复仇者'] })
    const p = scorePair(l, r)

    expect(STRONG_NEGATIVE_SET.has('year_far_no_exact')).toBe(true)
    expect(p.strongNegativeReasons).toContain('year_far_no_exact')
    expect(p.autoMergeBlocked).toBe(true)
  })

  it('veto 不被 aliasBlockingKeys 削弱：有/无 alias 桶 veto 结论恒等', () => {
    const l = side({ videoId: 'a', coreTitleKey: '复仇者', year: 2012 })
    const r = side({ videoId: 'b', coreTitleKey: '复仇者', year: 1998 })
    const withAlias = scorePair(
      { ...l, aliasBlockingKeys: ['复仇者'] },
      { ...r, aliasBlockingKeys: ['复仇者'] },
    )
    const without = scorePair(l, r)
    expect(withAlias).toEqual(without)
    expect(withAlias.autoMergeBlocked).toBe(true)
  })
})

// ── ④ 跨译名不自动合并（D-206-6c / D-105a-3 非 exact 封顶）──────────────────

describe('误并红线④：跨译名 pair 非 exact 封顶 < 0.92 → 永不自动绑定（D-206-6c / D-105a-4 OFF）', () => {
  it('NON_EXACT_CAP 不变量：0.90 < 0.92 自动绑定阈值（D-105a-3）', () => {
    expect(NON_EXACT_CAP).toBe(0.9)
    expect(NON_EXACT_CAP).toBeLessThan(0.92)
  })

  it('跨译名（core 异）经 alias 召回 + 满源指纹重合 → identityScore ≤ NON_EXACT_CAP，永不自动绑定', () => {
    // 海贼王/航海王 core 不同（简繁不归一）；即便源站指纹满重合 + 年同 + type 同，
    // 缺 core_title_key_equal + 无 exact → 封顶非 exact，结构上 < 0.92 不自动绑定
    const keys = ['s1', 's2', 's3']
    const l = side({ videoId: 'a', coreTitleKey: '海贼王', year: 2020, sourceSiteKeys: keys, aliasBlockingKeys: ['航海王'] })
    const r = side({ videoId: 'b', coreTitleKey: '航海王', year: 2020, sourceSiteKeys: keys, aliasBlockingKeys: ['航海王'] })
    const p = scorePair(l, r)

    expect(p.identityScore).toBeLessThanOrEqual(NON_EXACT_CAP)
    expect(p.identityScore).toBeLessThan(0.92)
    // 无 exact 命中（仅 alias 桥接，ID 未都填）
    expect(p.evidence.some((e) => e.type === 'external_exact_id_match' && e.hit)).toBe(false)
  })

  it('跨译名 + 共享 exact ID（post-enrich）→ exact 饱和 0.95，但仍仅产候选（auto-merge OFF / scorePair 不触发合并）', () => {
    const l = side({ videoId: 'a', coreTitleKey: '海贼王', year: 2020, externalIds: exactIds({ tmdb: '37854' }), aliasBlockingKeys: ['航海王'] })
    const r = side({ videoId: 'b', coreTitleKey: '航海王', year: 2020, externalIds: exactIds({ tmdb: '37854' }), aliasBlockingKeys: ['航海王'] })
    const p = scorePair(l, r)
    // exact 命中 → 饱和 0.95（合理高分），但 scorePair 仅产 PairScore 供候选/人工裁定，
    // 不含任何合并副作用；自动合并 Phase 1-4 默认 OFF（D-105a-4 安全网）。
    expect(p.evidence.some((e) => e.type === 'external_exact_id_match' && e.hit)).toBe(true)
    expect(p.identityScore).toBeGreaterThanOrEqual(0.92)
    expect(p.autoMergeBlocked).toBe(false) // 无强负，但「不 blocked」≠「自动合并」——合并由独立闸门（OFF）裁决
  })
})
