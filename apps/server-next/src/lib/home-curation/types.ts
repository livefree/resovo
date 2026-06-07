/**
 * home-curation/types.ts — Home Curation 聚合门面桥接类型
 * （CHG-HOME-CANVAS-A / ADR-182）
 *
 * 真源：packages/types/src/home-section.types.ts（ADR-182 D-182-2/D-182-4）。
 */

import type {
  AutofillCandidate,
  AutofillCandidatesResult,
  AutofillVideoSummary,
  ContentGap,
  HomeConfigBannerEntry,
  HomeConfigDraft,
  HomeConfigModuleEntry,
  HomeConfigSectionSettingsEntry,
  HomeDraftStaleness,
  HomePageConfig,
  HomePreview,
  HomePreviewCard,
  HomePreviewCardFlag,
  HomePreviewCardSource,
  HomePreviewSection,
  HomePublishVersion,
  HomePublishVersionSummary,
  HomeSectionKey,
  HomeSectionSettings,
  HomeSectionSummary,
} from '@resovo/types'

export type {
  AutofillCandidate,
  AutofillCandidatesResult,
  AutofillVideoSummary,
  ContentGap,
  HomeConfigBannerEntry,
  HomeConfigDraft,
  HomeConfigModuleEntry,
  HomeConfigSectionSettingsEntry,
  HomeDraftStaleness,
  HomePageConfig,
  HomePreview,
  HomePreviewCard,
  HomePreviewCardFlag,
  HomePreviewCardSource,
  HomePreviewSection,
  HomePublishVersion,
  HomePublishVersionSummary,
  HomeSectionKey,
  HomeSectionSettings,
  HomeSectionSummary,
}

/** GET /admin/home/preview query（D-182-4 #1；draft = ADR-185 草稿叠加态） */
export interface HomePreviewQuery {
  readonly brandSlug?: string
  readonly locale?: string
  /** ISO datetime；仅影响时间窗判定 */
  readonly at?: string
  readonly device?: 'desktop' | 'mobile'
  /** true = 草稿叠加消费（无草稿服务端降级发布态，CHG-HOME-DRAFT-PUBLISH-B） */
  readonly draft?: boolean
}
