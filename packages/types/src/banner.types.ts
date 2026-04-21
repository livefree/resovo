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
