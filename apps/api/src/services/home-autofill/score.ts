/**
 * score.ts — 候选排序纯函数（ADR-183 D-183-4）
 *
 * 全部无 IO：信号取数归候选源 queries（CHG-HOME-AUTOFILL-DOUBAN/-BANGUMI），
 * 本层只做确定性计算。缺失信号按 0 计入（votes 27.4% / rating 18.5% 非空实测，
 * 缺失即自然降权，不可假定全量可用）。
 */

import {
  DOUBAN_WEIGHTS,
  PENALTY_MISSING_IMAGE,
  PENALTY_UNSTABLE_SOURCE,
  RECENCY_HALF_LIFE_DAYS,
  SOURCE_HEALTH_SATURATION,
} from './policy'

/**
 * 票数对数压缩归一（D-183-4.1）：norm_votes = ln(1+votes)/ln(1+max_votes)。
 * 防头部条目票数碾压；votes 缺失/非正按 0，max_votes 非正（池内全缺失）整项归 0。
 */
export function normVotes(votes: number | null | undefined, maxVotes: number): number {
  if (!votes || votes <= 0 || maxVotes <= 0) return 0
  return Math.log1p(Math.min(votes, maxVotes)) / Math.log1p(maxVotes)
}

/** recency 衰减（指数半衰，半衰期 RECENCY_HALF_LIFE_DAYS 天）：0 天 = 1，缺失/负值按最旧 0 */
export function recencyWeight(ageDays: number | null | undefined): number {
  if (ageDays == null || ageDays < 0 || !Number.isFinite(ageDays)) return 0
  return Math.exp(-ageDays * Math.LN2 / RECENCY_HALF_LIFE_DAYS)
}

/** 可播源健康度：0 源 = 0，线性爬升至 SOURCE_HEALTH_SATURATION 源饱和 1 */
export function sourceHealthFromCount(activeSourceCount: number): number {
  if (activeSourceCount <= 0) return 0
  return Math.min(1, activeSourceCount / SOURCE_HEALTH_SATURATION)
}

export interface DoubanScoreInput {
  /** douban_votes（缺失按 0 计入） */
  readonly votes: number | null
  /** douban rating 0–10（缺失按 0 计入） */
  readonly rating: number | null
  /** 站内最近上线/更新距今天数（缺失按最旧） */
  readonly ageDays: number | null
  /** 站内活跃可播源数 */
  readonly activeSourceCount: number
  /** 惩罚信号 */
  readonly missingImage: boolean
  readonly unstableSource: boolean
}

/**
 * 豆瓣候选加权分（D-183-4.1，hot_movies / hot_series）：
 * 0.4·norm_votes + 0.3·rating/10 + 0.15·recency + 0.15·source_health − penalties，
 * 惩罚后下钳 0（权重和 = 1，上界自然 ≤ 1）。
 */
export function doubanScore(input: DoubanScoreInput, maxVotes: number): number {
  const rating = input.rating != null && input.rating > 0 ? Math.min(input.rating, 10) / 10 : 0
  let score =
    DOUBAN_WEIGHTS.votes * normVotes(input.votes, maxVotes) +
    DOUBAN_WEIGHTS.rating * rating +
    DOUBAN_WEIGHTS.recency * recencyWeight(input.ageDays) +
    DOUBAN_WEIGHTS.sourceHealth * sourceHealthFromCount(input.activeSourceCount)
  if (input.missingImage) score -= PENALTY_MISSING_IMAGE
  if (input.unstableSource) score -= PENALTY_UNSTABLE_SOURCE
  return Math.max(0, score)
}

export interface BangumiOrderInput {
  /** bangumi rank（494/500 非空实测；主序信号） */
  readonly rank: number | null
  /** bangumi rating（rank 缺失项的次序信号） */
  readonly rating: number | null
}

/**
 * Bangumi 候选排序比较器（D-183-4.2，hot_anime）：
 * 主序 rank ASC；rank 缺失项整体排在有 rank 项之后，组内 rating DESC（rating 再缺失垫底）。
 * nsfw 硬过滤不在本层（属候选源 query 责任，增量数据防线）。
 */
export function compareBangumiCandidates(a: BangumiOrderInput, b: BangumiOrderInput): number {
  const aHasRank = a.rank != null
  const bHasRank = b.rank != null
  if (aHasRank && bHasRank) return a.rank! - b.rank!
  if (aHasRank !== bHasRank) return aHasRank ? -1 : 1
  return (b.rating ?? -1) - (a.rating ?? -1)
}
