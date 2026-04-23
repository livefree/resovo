// banner.types.ts — home_banners 表对应的共享类型（M5-API-BANNER-01）

export type BannerLinkType = 'video' | 'external'
export type BannerBrandScope = 'brand-specific' | 'all-brands'

export interface BannerTitle {
  [locale: string]: string
}

export interface Banner {
  id: string
  title: BannerTitle
  imageUrl: string
  linkType: BannerLinkType
  linkTarget: string
  sortOrder: number
  activeFrom: string | null
  activeTo: string | null
  isActive: boolean
  brandScope: BannerBrandScope
  brandSlug: string | null
  createdAt: string
  updatedAt: string
}

export interface BannerCard {
  id: string
  title: BannerTitle
  imageUrl: string
  linkType: BannerLinkType
  linkTarget: string
  sortOrder: number
}

/** 公开 API 响应结构：title 已按 locale 选取为单一字符串 */
export interface LocalizedBannerCard {
  id: string
  title: string
  imageUrl: string
  linkType: BannerLinkType
  linkTarget: string
  sortOrder: number
  /** linkType='video' 时携带，用于前端构造 getVideoDetailHref */
  videoType?: string | null
  videoSlug?: string | null
  /** HeroV2 扩展字段（可选），API 未填充时为 undefined/null */
  rating?: number | null
  year?: number | null
  episodeCount?: number | null
  specs?: string[] | null
  blurb?: string | null
}

export interface CreateBannerInput {
  title: BannerTitle
  imageUrl: string
  linkType: BannerLinkType
  linkTarget: string
  sortOrder?: number
  activeFrom?: string | null
  activeTo?: string | null
  isActive?: boolean
  brandScope?: BannerBrandScope
  brandSlug?: string | null
}

export type UpdateBannerInput = Partial<CreateBannerInput>
