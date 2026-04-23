/**
 * home-module.types.ts — 首页模块化编排（ADR-052）
 */

export type HomeModuleSlot =
  | 'banner'
  | 'featured'
  | 'top10'
  | 'type_shortcuts'

export type HomeModuleContentRefType =
  | 'video'         // content_ref_id = videos.id
  | 'external_url'  // content_ref_id = 完整 URL
  | 'custom_html'   // content_ref_id = 富文本片段的 sanitized ID（载荷存 metadata.html）
  | 'video_type'    // content_ref_id = VideoType 枚举字符串

/** 品牌作用域（与 home_banners 对齐，ADR-046/ADR-052） */
export type HomeBrandScope = 'all-brands' | 'brand-specific'

/**
 * 首页模块运营条目
 *
 * slot × content_ref_type 约束（DB CHECK 强制，ADR-052）：
 *   banner         → video | external_url | custom_html
 *   featured       → video
 *   top10          → video（人工置顶专用；period-based trending 另走 listTrendingVideos）
 *   type_shortcuts → video_type
 */
export interface HomeModule {
  id: string
  slot: HomeModuleSlot
  brandScope: HomeBrandScope
  brandSlug: string | null
  ordering: number
  contentRefType: HomeModuleContentRefType
  contentRefId: string
  startAt: string | null
  endAt: string | null
  enabled: boolean
  /** 非关键运营展示数据（自定义文案、样式 override）。禁止放入关键业务状态。 */
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateHomeModuleInput {
  slot: HomeModuleSlot
  brandScope: HomeBrandScope
  brandSlug?: string | null
  ordering?: number
  contentRefType: HomeModuleContentRefType
  contentRefId: string
  startAt?: string | null
  endAt?: string | null
  enabled?: boolean
  metadata?: Record<string, unknown>
}

export interface UpdateHomeModuleInput {
  slot?: HomeModuleSlot
  brandScope?: HomeBrandScope
  brandSlug?: string | null
  ordering?: number
  contentRefType?: HomeModuleContentRefType
  contentRefId?: string
  startAt?: string | null
  endAt?: string | null
  enabled?: boolean
  metadata?: Record<string, unknown>
}

export interface ReorderHomeModuleItem {
  id: string
  ordering: number
}
