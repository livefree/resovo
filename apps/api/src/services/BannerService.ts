// BannerService.ts — Banner 业务逻辑
// 所有查询通过 db/queries/home-banners.ts，不直接拼 SQL

import type { Pool } from 'pg'
import type { Banner, BannerCard, BannerTitle, LocalizedBannerCard, CreateBannerInput, UpdateBannerInput } from '@/types'
import * as bannerQueries from '@/api/db/queries/home-banners'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const FALLBACK_LOCALES = ['zh-CN', 'en', 'zh']

function resolveTitle(title: BannerTitle, locale?: string): string {
  if (locale && title[locale]) return title[locale]
  for (const fb of FALLBACK_LOCALES) {
    if (title[fb]) return title[fb]
  }
  const first = Object.values(title)[0]
  return first ?? ''
}

function localizeCard(card: BannerCard, locale?: string): LocalizedBannerCard {
  return {
    id: card.id,
    title: resolveTitle(card.title, locale),
    imageUrl: card.imageUrl,
    linkType: card.linkType,
    linkTarget: card.linkTarget,
    sortOrder: card.sortOrder,
  }
}

export class BannerService {
  constructor(private db: Pool) {}

  async listActive(opts: {
    locale?: string
    brandSlug?: string | null
  }): Promise<LocalizedBannerCard[]> {
    const cards = await bannerQueries.listActiveBanners(this.db, opts)
    return cards.map((c) => localizeCard(c, opts.locale))
  }

  async listAll(opts: {
    page?: number
    limit?: number
  }): Promise<{ data: Banner[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, opts.page ?? 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT))
    const { rows, total } = await bannerQueries.listAllBanners(this.db, { page, limit })
    return { data: rows, total, page, limit }
  }

  async getById(id: string): Promise<Banner | null> {
    return bannerQueries.findBannerById(this.db, id)
  }

  async create(input: CreateBannerInput): Promise<Banner> {
    return bannerQueries.createBanner(this.db, input)
  }

  async update(id: string, input: UpdateBannerInput): Promise<Banner | null> {
    return bannerQueries.updateBanner(this.db, id, input)
  }

  async delete(id: string): Promise<boolean> {
    return bannerQueries.deleteBanner(this.db, id)
  }

  async reorder(orders: Array<{ id: string; sortOrder: number }>): Promise<void> {
    return bannerQueries.updateBannerSortOrders(this.db, orders)
  }
}
