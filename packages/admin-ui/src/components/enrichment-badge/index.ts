/**
 * enrichment-badge/index.ts — EnrichmentBadge 共享组件公开 API（ADR-172 / ADR-E）
 *
 * 落地：META-10（SEQ-20260530-01 P2 共享层；arch-reviewer Opus PASS 契约）
 *
 * 消费方（P3 接入，本卡不接）：视频库 columns / VideoEditDrawer QUICK_HEAD / moderation / TabLines
 */

export { EnrichmentBadge, deriveEnrichmentBadge } from './enrichment-badge'
export type { DerivedEnrichmentBadge } from './enrichment-badge'
export { EnrichmentBadgeCluster } from './enrichment-badge-cluster'
export {
  META_SCORE_THRESHOLDS,
} from './enrichment-badge.types'
export type {
  EnrichmentBadgeProps,
  EnrichmentBadgeClusterProps,
  EnrichmentBadgeKind,
  EnrichmentBadgeSize,
  EnrichmentBadgeDensity,
  DoubanBadgeProps,
  BangumiBadgeProps,
  SourceBadgeProps,
  MetaBadgeProps,
  PinyinBadgeProps,
} from './enrichment-badge.types'
