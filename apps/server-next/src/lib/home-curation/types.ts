/**
 * home-curation/types.ts — Home Curation 聚合门面桥接类型
 * （CHG-HOME-CANVAS-A / ADR-182）
 *
 * 真源：packages/types/src/home-section.types.ts（ADR-182 D-182-2/D-182-4）。
 */

import type {
  HomePreview,
  HomePreviewCard,
  HomePreviewCardFlag,
  HomePreviewCardSource,
  HomePreviewSection,
  HomeSectionKey,
  HomeSectionSettings,
  HomeSectionSummary,
} from '@resovo/types'

export type {
  HomePreview,
  HomePreviewCard,
  HomePreviewCardFlag,
  HomePreviewCardSource,
  HomePreviewSection,
  HomeSectionKey,
  HomeSectionSettings,
  HomeSectionSummary,
}

/** GET /admin/home/preview query（D-182-4 #1） */
export interface HomePreviewQuery {
  readonly brandSlug?: string
  readonly locale?: string
  /** ISO datetime；仅影响时间窗判定 */
  readonly at?: string
  readonly device?: 'desktop' | 'mobile'
}
