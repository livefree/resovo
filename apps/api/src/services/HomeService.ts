/**
 * HomeService.ts — 首页运营位聚合服务（HANDOFF-04，ADR-052/053）
 *
 * 职责：
 *   - topTen()：编排 top10 运营位（人工置顶 + rating DESC fallback）
 *   - listActiveBySlot()：按 slot + brand_scope 查询当前激活的 home_modules
 *   - shelf()：公开 hot shelf 聚合门面（ADR-184；合成委托 home-curation.shelf）
 *
 * null brandSlug 仅命中 brand_scope='all-brands' 的记录，不是全量聚合池。
 */

import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import type { HomeModule, HomeModuleSlot, HomeShelfResponse, HomeShelfSection, Top10Item, Top10Response } from '@/types'
import * as homeModuleQueries from '@/api/db/queries/home-modules'
import * as videoQueries from '@/api/db/queries/videos'
import { CACHE_PREFIXES } from '@/api/services/CacheService'
import { buildHomeShelves, buildHomeShelfCacheKey } from '@/api/services/home-curation.shelf'

const TOP10_TTL = 60
/** D-184-5.1：与 top10 同口径短 TTL（方案 §12；主动失效见 home-cache-invalidation） */
const SHELF_TTL = 60

/** top10 键族子前缀（ADR-185 D-185-5.1 失效接口位，CHG-HOME-CACHE-INVALIDATE） */
export const HOME_TOP10_CACHE_PREFIX = `${CACHE_PREFIXES.home}top10:`

function buildTop10CacheKey(brandSlug: string | null): string {
  return `${HOME_TOP10_CACHE_PREFIX}${brandSlug != null ? `b:${brandSlug}` : 'none'}`
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

  /**
   * 公开 hot shelf 聚合（ADR-184 D-184-5/6）。
   * 缓存 miss 时整页合成一次 → 同 brand 三个 hot section 的 key 同写
   * （一次 miss 填三键；brand 隔离硬约束——三键严格限定 b:{brandSlug} 同命名空间）。
   */
  async shelf(section: HomeShelfSection, brandSlug: string | null): Promise<HomeShelfResponse> {
    const cacheKey = buildHomeShelfCacheKey(section, brandSlug)
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as HomeShelfResponse
    }

    const shelves = await buildHomeShelves(this.db, brandSlug)
    await Promise.all(
      [...shelves].map(([key, value]) =>
        this.redis.setex(buildHomeShelfCacheKey(key, brandSlug), SHELF_TTL, JSON.stringify(value)),
      ),
    )

    // seed 7 行恒存在；缺行 = 迁移漂移 → 空 shelf 防御（与 preview 跳过语义一致）
    return (
      shelves.get(section) ?? { items: [], snapshotAt: null, generatedAt: new Date().toISOString() }
    )
  }
}
