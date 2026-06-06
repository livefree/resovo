/**
 * home-module.types.ts — 首页模块化编排（ADR-052 + ADR-181 hot slot 扩展）
 */

export type HomeModuleSlot =
  | 'banner'
  | 'featured'
  | 'top10'
  | 'type_shortcuts'
  // ADR-181 D-181-4（migration 094）：热门 shelf pinned 头部专用（content_ref_type 仅 video）；
  // 自动候选不落 home_modules（候选快照归 ADR-183 home_autofill_snapshots）
  | 'hot_movies'
  | 'hot_series'
  | 'hot_anime'

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
 * slot × content_ref_type 约束（DB CHECK 强制，ADR-052 + ADR-181）：
 *   banner         → video | external_url | custom_html
 *   featured       → video
 *   top10          → video（人工置顶专用；period-based trending 另走 listTrendingVideos）
 *   type_shortcuts → video_type
 *   hot_movies     → video（ADR-181，热门 shelf pinned）
 *   hot_series     → video（ADR-181，热门 shelf pinned）
 *   hot_anime      → video（ADR-181，热门 shelf pinned）
 */
export interface HomeModule {
  id: string
  slot: HomeModuleSlot
  brandScope: HomeBrandScope
  brandSlug: string | null
  ordering: number
  contentRefType: HomeModuleContentRefType
  contentRefId: string
  /**
   * 多语言标题映射 locale→string（与 home_banners.title 同构；ADR-052 AMENDMENT 2026-06-05 D-052-9）。
   * 空 '{}' 时消费端降级：video 类型用视频标题，其余显示 contentRefId 摘要。
   */
  title: Record<string, string>
  /**
   * 运营横图 URL；可空（D-052-10）。
   * video 类型消费端回退 videos.cover_url：降级链 `imageUrl ?? coverUrl ?? placeholder`。
   */
  imageUrl: string | null
  startAt: string | null
  endAt: string | null
  enabled: boolean
  /**
   * 非关键运营展示数据（样式 override 等）。禁止放入关键业务状态。
   * title 覆盖用法已被 ADR-052 AMENDMENT 2026-06-05 取代（一等列），不再用于新写入。
   */
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
  title?: Record<string, string>
  imageUrl?: string | null
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
  title?: Record<string, string>
  imageUrl?: string | null
  startAt?: string | null
  endAt?: string | null
  enabled?: boolean
  metadata?: Record<string, unknown>
}

export interface ReorderHomeModuleItem {
  id: string
  ordering: number
}
