/**
 * banners/types.ts — `/admin/home` Banner tab 的 home_banners 桥接类型
 * （CHG-HOME-BANNER-UNIFY-A / ADR-181 D-181-1）
 *
 * 真源：packages/types/src/banner.types.ts（home_banners 表，Hero 首屏唯一真源）。
 * 消费端点：apps/api/src/routes/admin/banners.ts 既有 6 端点（零新端点）。
 */

import type {
  Banner,
  BannerTitle,
  BannerLinkType,
  BannerBrandScope,
  CreateBannerInput,
  UpdateBannerInput,
} from '@resovo/types'

export type { Banner, BannerTitle, BannerLinkType, BannerBrandScope, CreateBannerInput, UpdateBannerInput }

export interface BannerListFilter {
  readonly page?: number
  readonly limit?: number
  readonly sortField?: string
  readonly sortDir?: 'asc' | 'desc'
}

/** GET /admin/banners 响应形态（v1 时代 pagination 包络，与 home-modules 的扁平包络不同） */
export interface BannerListResult {
  readonly data: Banner[]
  readonly pagination: {
    readonly total: number
    readonly page: number
    readonly limit: number
    readonly hasNext: boolean
  }
}

/** PATCH /admin/banners/reorder body 条目（注意：字段为 sortOrder，body 键为 orders） */
export interface BannerReorderItem {
  readonly id: string
  readonly sortOrder: number
}
