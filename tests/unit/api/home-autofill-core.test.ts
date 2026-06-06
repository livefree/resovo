/**
 * home-autofill-core.test.ts — 自动填充纯函数层（CHG-HOME-AUTOFILL-CORE-A / ADR-183）
 *
 * 覆盖 ADR-183 影响面 #8 测试义务：缺失信号按 0 / norm_votes 对数压缩边界 /
 * rank 缺失排后 / 过滤链 reason / 去重豁免语义。
 */

import { describe, it, expect } from 'vitest'
import {
  POLICY_VERSION,
  DOUBAN_WEIGHTS,
  PENALTY_MISSING_IMAGE,
  PENALTY_UNSTABLE_SOURCE,
  SOURCE_HEALTH_SATURATION,
  normVotes,
  recencyWeight,
  sourceHealthFromCount,
  doubanScore,
  compareBangumiCandidates,
  FILTER_REASONS,
  evaluateCandidateFilters,
  occupyVideoIds,
  isOccupied,
  type DoubanScoreInput,
  type CandidateFilterInput,
} from '@/api/services/home-autofill'

// ── policy ────────────────────────────────────────────────────────

describe('policy 常量（D-183-4 / D-183-5）', () => {
  it('POLICY_VERSION 初值 hp-v1（D-183-5）', () => {
    expect(POLICY_VERSION).toBe('hp-v1')
  })

  it('豆瓣权重和为 1（score 上界自然 ≤ 1）', () => {
    const sum = DOUBAN_WEIGHTS.votes + DOUBAN_WEIGHTS.rating + DOUBAN_WEIGHTS.recency + DOUBAN_WEIGHTS.sourceHealth
    expect(sum).toBeCloseTo(1, 10)
  })
})

// ── normVotes（对数压缩边界）─────────────────────────────────────

describe('normVotes（D-183-4.1 对数压缩）', () => {
  it('votes = max → 1（归一上界）', () => {
    expect(normVotes(50000, 50000)).toBeCloseTo(1, 10)
  })

  it('缺失（null / 0 / 负值）按 0 计入', () => {
    expect(normVotes(null, 50000)).toBe(0)
    expect(normVotes(undefined, 50000)).toBe(0)
    expect(normVotes(0, 50000)).toBe(0)
    expect(normVotes(-5, 50000)).toBe(0)
  })

  it('maxVotes 非正（池内全缺失）整项归 0，不产生 NaN', () => {
    expect(normVotes(100, 0)).toBe(0)
    expect(normVotes(100, -1)).toBe(0)
  })

  it('对数压缩防头部碾压：10% 票数得分远高于线性 10%', () => {
    const tenth = normVotes(5000, 50000)
    expect(tenth).toBeGreaterThan(0.7) // ln 压缩后 ≈ 0.787
    expect(tenth).toBeLessThan(1)
  })

  it('votes 超出 max 钳到 max（防外部数据漂移越界 > 1）', () => {
    expect(normVotes(99999, 50000)).toBeCloseTo(1, 10)
  })
})

// ── recencyWeight / sourceHealth ─────────────────────────────────

describe('recencyWeight（指数半衰）', () => {
  it('0 天 = 1；半衰期天数 = 0.5；单调递减', () => {
    expect(recencyWeight(0)).toBe(1)
    expect(recencyWeight(30)).toBeCloseTo(0.5, 10)
    expect(recencyWeight(60)).toBeCloseTo(0.25, 10)
    expect(recencyWeight(10)).toBeGreaterThan(recencyWeight(20))
  })

  it('缺失 / 负值 / 非有限值按最旧 0', () => {
    expect(recencyWeight(null)).toBe(0)
    expect(recencyWeight(undefined)).toBe(0)
    expect(recencyWeight(-1)).toBe(0)
    expect(recencyWeight(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('sourceHealthFromCount（线性爬升饱和）', () => {
  it('0 源 = 0；饱和阈值及以上 = 1；线性爬升', () => {
    expect(sourceHealthFromCount(0)).toBe(0)
    expect(sourceHealthFromCount(SOURCE_HEALTH_SATURATION)).toBe(1)
    expect(sourceHealthFromCount(SOURCE_HEALTH_SATURATION + 5)).toBe(1)
    expect(sourceHealthFromCount(1)).toBeCloseTo(1 / SOURCE_HEALTH_SATURATION, 10)
  })
})

// ── doubanScore（加权 + 惩罚 + 钳位）─────────────────────────────

const FULL_SIGNALS: DoubanScoreInput = {
  votes: 50000,
  rating: 10,
  ageDays: 0,
  activeSourceCount: SOURCE_HEALTH_SATURATION,
  missingImage: false,
  unstableSource: false,
}

describe('doubanScore（D-183-4.1）', () => {
  it('全满信号无惩罚 → 1（权重和上界）', () => {
    expect(doubanScore(FULL_SIGNALS, 50000)).toBeCloseTo(1, 10)
  })

  it('缺失信号按 0 计入：全缺失 → 0', () => {
    const empty: DoubanScoreInput = {
      votes: null, rating: null, ageDays: null, activeSourceCount: 0,
      missingImage: false, unstableSource: false,
    }
    expect(doubanScore(empty, 50000)).toBe(0)
  })

  it('单信号贡献 = 对应权重（rating 满分独立验证）', () => {
    const ratingOnly: DoubanScoreInput = {
      votes: null, rating: 10, ageDays: null, activeSourceCount: 0,
      missingImage: false, unstableSource: false,
    }
    expect(doubanScore(ratingOnly, 50000)).toBeCloseTo(DOUBAN_WEIGHTS.rating, 10)
  })

  it('惩罚项叠加扣分（图片缺失 + 源不稳定）', () => {
    const penalized = doubanScore({ ...FULL_SIGNALS, missingImage: true, unstableSource: true }, 50000)
    expect(penalized).toBeCloseTo(1 - PENALTY_MISSING_IMAGE - PENALTY_UNSTABLE_SOURCE, 10)
  })

  it('惩罚后下钳 0（弱信号 + 双惩罚不出负分）', () => {
    const weak: DoubanScoreInput = {
      votes: null, rating: 1, ageDays: null, activeSourceCount: 0,
      missingImage: true, unstableSource: true,
    }
    expect(doubanScore(weak, 50000)).toBe(0)
  })

  it('rating 超 10 钳到 10（防外部数据越界）', () => {
    const over = doubanScore({ ...FULL_SIGNALS, rating: 12 }, 50000)
    expect(over).toBeCloseTo(1, 10)
  })
})

// ── compareBangumiCandidates（rank 主序）─────────────────────────

describe('compareBangumiCandidates（D-183-4.2）', () => {
  it('主序 rank ASC', () => {
    const sorted = [{ rank: 30, rating: 5 }, { rank: 1, rating: 2 }, { rank: 10, rating: 9 }]
      .sort(compareBangumiCandidates)
    expect(sorted.map((x) => x.rank)).toEqual([1, 10, 30])
  })

  it('rank 缺失项整体排在有 rank 项之后，组内 rating DESC', () => {
    const sorted = [
      { rank: null, rating: 6.5 },
      { rank: 500, rating: 1 },
      { rank: null, rating: 9.2 },
      { rank: 3, rating: 8 },
    ].sort(compareBangumiCandidates)
    expect(sorted.map((x) => [x.rank, x.rating])).toEqual([
      [3, 8], [500, 1], [null, 9.2], [null, 6.5],
    ])
  })

  it('rank 与 rating 双缺失垫底', () => {
    const sorted = [
      { rank: null, rating: null },
      { rank: null, rating: 2 },
      { rank: 99, rating: null },
    ].sort(compareBangumiCandidates)
    expect(sorted.map((x) => [x.rank, x.rating])).toEqual([
      [99, null], [null, 2], [null, null],
    ])
  })
})

// ── 过滤链（D-183-4.5）───────────────────────────────────────────

const PASSING: CandidateFilterInput = {
  isPublished: true,
  visibleOnFrontend: true,
  isAdult: false,
  playableSourceCount: 2,
  hasImage: true,
  hasImageFallback: false,
  brandLocaleVisible: true,
}

describe('evaluateCandidateFilters（D-183-4.5 / 方案 §7.1）', () => {
  it('全通过 → filtered=false 无 reason', () => {
    expect(evaluateCandidateFilters(PASSING)).toEqual({ filtered: false })
  })

  it.each([
    [{ isPublished: false }, FILTER_REASONS.NOT_PUBLISHED],
    [{ visibleOnFrontend: false }, FILTER_REASONS.NOT_VISIBLE],
    [{ isAdult: true }, FILTER_REASONS.ADULT_CONTENT],
    [{ playableSourceCount: 0 }, FILTER_REASONS.NO_PLAYABLE_SOURCE],
    [{ hasImage: false }, FILTER_REASONS.MISSING_IMAGE],
    [{ brandLocaleVisible: false }, FILTER_REASONS.BRAND_RESTRICTED],
  ] as const)('单项不通过 %o → %s', (patch, reason) => {
    expect(evaluateCandidateFilters({ ...PASSING, ...patch })).toEqual({
      filtered: true,
      filterReason: reason,
    })
  })

  it('链式首中即返（未发布 + 成人 → 报 not_published）', () => {
    const r = evaluateCandidateFilters({ ...PASSING, isPublished: false, isAdult: true })
    expect(r.filterReason).toBe(FILTER_REASONS.NOT_PUBLISHED)
  })

  it('图片缺失但有 fallback → 通过（方案 §7.1「图片可用，或有明确 fallback」）', () => {
    expect(evaluateCandidateFilters({ ...PASSING, hasImage: false, hasImageFallback: true }))
      .toEqual({ filtered: false })
  })

  it('快照阶段无跨区块去重 reason（D-183-6.1：occupied_by_* 不存在于常量集）', () => {
    expect(Object.values(FILTER_REASONS).some((r) => r.startsWith('occupied'))).toBe(false)
  })
})

// ── 去重纯函数（D-183-6）─────────────────────────────────────────

describe('occupyVideoIds / isOccupied（D-183-6 聚合层唯一权威）', () => {
  it('登记占用：null/undefined 跳过', () => {
    const occupied = new Set<string>()
    occupyVideoIds(occupied, ['v1', null, 'v2', undefined], false)
    expect([...occupied].sort()).toEqual(['v1', 'v2'])
  })

  it('allowDuplicates 区块豁免：不写入占用集', () => {
    const occupied = new Set<string>()
    occupyVideoIds(occupied, ['v1'], true)
    expect(occupied.size).toBe(0)
  })

  it('占用判定：渲染序先到先得', () => {
    const occupied = new Set<string>(['v1'])
    expect(isOccupied(occupied, 'v1', false)).toBe(true)
    expect(isOccupied(occupied, 'v9', false)).toBe(false)
  })

  it('allowDuplicates 区块豁免：不受占用集约束', () => {
    const occupied = new Set<string>(['v1'])
    expect(isOccupied(occupied, 'v1', true)).toBe(false)
  })
})
