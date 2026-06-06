/**
 * home-autofill — Home 自动填充策略层（ADR-183；SEQ-20260605-05 Phase 3）
 *
 * 全模块纯函数无 IO：候选源取数归 queries（DOUBAN / BANGUMI 卡），
 * 编排与快照写入归 worker（REFRESH 卡），聚合消费归 HomeCurationService。
 */

export {
  POLICY_VERSION,
  DOUBAN_WEIGHTS,
  PENALTY_MISSING_IMAGE,
  PENALTY_UNSTABLE_SOURCE,
  RECENCY_HALF_LIFE_DAYS,
  SOURCE_HEALTH_SATURATION,
  CANDIDATE_POOL_LIMIT,
  GAP_TOP_N,
  GAP_SCAN_WINDOW,
} from './policy'
export {
  normVotes,
  recencyWeight,
  sourceHealthFromCount,
  doubanScore,
  compareBangumiCandidates,
  type DoubanScoreInput,
  type BangumiOrderInput,
} from './score'
export {
  FILTER_REASONS,
  evaluateCandidateFilters,
  type FilterReason,
  type CandidateFilterInput,
} from './filters'
export { occupyVideoIds, isOccupied } from './dedup'
export {
  buildDoubanCandidates,
  buildDoubanGaps,
  generateDoubanSectionCandidates,
  type DoubanSection,
} from './douban'
export {
  buildBangumiCandidates,
  buildBangumiGaps,
  generateBangumiSectionCandidates,
} from './bangumi'
export {
  buildTrendingCandidates,
  generateTrendingSectionCandidates,
  type TrendingSection,
} from './trending'
export {
  recalculateSectionSnapshot,
  type RecalculateResult,
} from './recalculate'
