/**
 * filters.ts — 候选通用过滤链纯函数（ADR-183 D-183-4.5 / 方案 §7.1）
 *
 * 只做**单区块确定性过滤**——跨区块去重不在快照阶段执行（D-183-6.1 改裁），
 * 快照内不产生 occupied_by_* 类 reason。被过滤候选保留在快照（filtered: true +
 * filterReason），供端点 #4 include_filtered 解释展示（方案 §2.3 自动可解释）。
 * 信号取数（DB 字段 → 布尔输入）归候选源 queries，本层无 IO。
 */

/**
 * filterReason 常量集（开放字符串，与 AutofillCandidate.origin 同演进范式：
 * 新 reason 随 POLICY_VERSION 递增引入，消费端对未知值降级展示）。
 */
export const FILTER_REASONS = {
  NOT_PUBLISHED: 'not_published',
  NOT_VISIBLE: 'not_visible',
  ADULT_CONTENT: 'adult_content',
  NO_PLAYABLE_SOURCE: 'no_playable_source',
  MISSING_IMAGE: 'missing_image',
  BRAND_RESTRICTED: 'brand_restricted',
} as const

export type FilterReason = (typeof FILTER_REASONS)[keyof typeof FILTER_REASONS]

export interface CandidateFilterInput {
  /** videos.is_published */
  readonly isPublished: boolean
  /** visibility_status 前台可见 */
  readonly visibleOnFrontend: boolean
  /** 成人内容标记 */
  readonly isAdult: boolean
  /** 可播放源计数（≥1 通过） */
  readonly playableSourceCount: number
  /** 图片可用，或有明确 fallback（二者其一即通过） */
  readonly hasImage: boolean
  readonly hasImageFallback: boolean
  /** 当前 brand / locale 可展示 */
  readonly brandLocaleVisible: boolean
}

/**
 * 过滤链（方案 §7.1 顺序，首中即返）。
 * @returns filtered=false 时无 filterReason；filtered=true 时携首个不通过项。
 */
export function evaluateCandidateFilters(
  input: CandidateFilterInput,
): { filtered: boolean; filterReason?: FilterReason } {
  if (!input.isPublished) return { filtered: true, filterReason: FILTER_REASONS.NOT_PUBLISHED }
  if (!input.visibleOnFrontend) return { filtered: true, filterReason: FILTER_REASONS.NOT_VISIBLE }
  if (input.isAdult) return { filtered: true, filterReason: FILTER_REASONS.ADULT_CONTENT }
  if (input.playableSourceCount < 1) {
    return { filtered: true, filterReason: FILTER_REASONS.NO_PLAYABLE_SOURCE }
  }
  if (!input.hasImage && !input.hasImageFallback) {
    return { filtered: true, filterReason: FILTER_REASONS.MISSING_IMAGE }
  }
  if (!input.brandLocaleVisible) {
    return { filtered: true, filterReason: FILTER_REASONS.BRAND_RESTRICTED }
  }
  return { filtered: false }
}
