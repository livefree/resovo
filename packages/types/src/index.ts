export * from './api-errors'
export type * from './api.types'
export type * from './banner.types'
export type * from './home-module.types'
export type * from './home.types'
export type * from './user.types'
export type * from './video.types'
export type * from './search.types'
export type * from './list.types'
export type * from './player.types'

export type * from './crawler.types'
export type * from './system.types'
export type * from './external.types'

export type * from './admin-moderation.types'
// CHG-360-A / ADR-159：runtime helper（非 type-only）
export { deriveAggregateState } from './admin-moderation.types'
export type * from './video-merge.types'
export type * from './sources-matrix.types'
export type * from './admin-audit.types'
export type * from './admin-shell.types'
export type * from './dashboard'

export { DEFAULT_INGEST_POLICY } from './system.types'

// ── ADR-157 D-157-1 视频枚举值常量（双形态，12 enum 全集 P0/P1/P2）─
export {
  VIDEO_TYPES, VIDEO_GENRES, VIDEO_STATUSES, REVIEW_STATUSES,
  VISIBILITY_STATUSES, CONTENT_FORMATS, EPISODE_PATTERNS, TRENDING_TAGS,
  DOUBAN_STATUSES, SOURCE_CHECK_STATUSES, VIDEO_QUALITIES, SOURCE_TYPES,
} from './video.types'

// ── ADR-157 D-157-1 类型守卫工具 ────────────────────────────────
export * from './utils/exhaustive'
