/**
 * HomeService.ts — 首页运营位聚合服务（HANDOFF-04，ADR-052/053）
 *
 * 职责：
 *   - topTen()：编排 top10 运营位（人工置顶 + rating DESC fallback）
 *   - listActiveBySlot()：按 slot + brand_scope 查询当前激活的 home_modules
 *
 * null brandSlug 仅命中 brand_scope='all-brands' 的记录，不是全量聚合池。
 */

import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import type { HomeModule, HomeModuleSlot, Top10Item, Top10Response } from '@/types'
import * as homeModuleQueries from '@/api/db/queries/home-modules'
import * as videoQueries from '@/api/db/queries/videos'
import { CACHE_PREFIXES } from '@/api/services/CacheService'

const TOP10_TTL = 60

function buildTop10CacheKey(brandSlug: string | null): string {
  return `${CACHE_PREFIXES.home}top10:${brandSlug != null ? `b:${brandSlug}` : 'none'}`
}

export class HomeService {
  constructor(
    private readonly db: Pool,
    private readonly redis: Redis,
  ) {}

  /**
   * 编排 top10 运营位
   *
   * 逻辑：
   * 1. 从 home_modules 取 slot='top10' 的人工置顶（按 ordering ASC）
   * 2. 批量解析 content_ref_id（video.id UUID）→ VideoCard（已下线条目自动丢弃）
   * 3. 不足 size 时，用 rating DESC + year DESC 补位（排除已置顶的 video.id）
   * 4. 合并后按置顶优先顺序分配 rank（1-based）
   * 5. 结果缓存 Redis TTL 60s；null brandSlug 键仅含 all-brands 置顶
   */
  async topTen(brandSlug: string | null, size = 10): Promise<Top10Response> {
    const cacheKey = buildTop10CacheKey(brandSlug)
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as Top10Response
    }

    const pinnedModules = await homeModuleQueries.listActiveHomeModules(
      this.db,
      'top10',
      brandSlug,
    )

    const pinnedIds = pinnedModules
      .filter((m) => m.contentRefType === 'video')
      .map((m) => m.contentRefId)

    const pinnedCards = await videoQueries.listVideoCardsByIds(this.db, pinnedIds)

    const pinnedCardMap = new Map(pinnedCards.map((v) => [v.id, v]))

    const orderedPinned: Top10Item[] = []
    for (const mod of pinnedModules) {
      if (mod.contentRefType !== 'video') continue
      const card = pinnedCardMap.get(mod.contentRefId)
      if (!card) continue
      orderedPinned.push({ video: card, rank: 0, isPinned: true })
    }

    const fillCount = size - orderedPinned.length
    const fillCards =
      fillCount > 0
        ? await videoQueries.listVideosByRatingDesc(this.db, fillCount, pinnedIds)
        : []

    const fillItems: Top10Item[] = fillCards.map((v) => ({
      video: v,
      rank: 0,
      isPinned: false,
    }))

    const items: Top10Item[] = [...orderedPinned, ...fillItems].map((item, i) => ({
      ...item,
      rank: i + 1,
    }))

    const response: Top10Response = { items, sortStrategy: 'manual_plus_rating' }
    await this.redis.setex(cacheKey, TOP10_TTL, JSON.stringify(response))
    return response
  }

  /**
   * 按 slot + brand_scope 查询当前激活的首页模块列表
   * null brandSlug 仅命中 brand_scope='all-brands' 的记录（ADR-052 brand 协议）
   */
  async listActiveBySlot(slot: HomeModuleSlot, brandSlug: string | null): Promise<HomeModule[]> {
    return homeModuleQueries.listActiveHomeModules(this.db, slot, brandSlug)
  }
}
