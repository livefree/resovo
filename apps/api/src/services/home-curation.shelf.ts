/**
 * home-curation.shelf.ts — 公开 hot shelf 聚合投影（ADR-184）
 *
 * 合成单一实现 = buildHomePreview 整页合成（D-184-3.1：「preview ≡ 公开页」
 * 由结构保证；禁止为公开端点另写第二份排序/去重/补位逻辑）。本模块只做投影：
 * 丢 empty / 阻断 flags / 非 video 卡 → 读时复核（最终权威，D-184-4.5）→
 * rank 重排。复核丢弃不二次回填（D-184-3.3，下个缓存周期自愈）。
 *
 * 缓存 key builder 为 Phase 4 CHG-HOME-CACHE-INVALIDATE 唯一失效寻址入口
 * （D-184-5.2）；TTL 与缓存读写归 HomeService.shelf()（公开门面）。
 */

import type { Pool } from 'pg'
import {
  HOME_SHELF_SECTIONS,
  type HomePreviewCard,
  type HomeShelfItem,
  type HomeShelfResponse,
  type HomeShelfSection,
} from '@resovo/types'
import { listVideoCardsByIds } from '@/api/db/queries/videos.status'
import { buildHomePreview } from '@/api/services/home-curation.preview'
import { CACHE_PREFIXES } from '@/api/services/CacheService'

// ── 缓存失效接口位（D-184-5）─────────────────────────────────────────────────

export const HOME_SHELF_CACHE_PREFIX = `${CACHE_PREFIXES.home}shelf:`

/** key = home:shelf:{section}:b:{brandSlug|none}（brand 隔离硬约束，D-184-5.4） */
export function buildHomeShelfCacheKey(section: HomeShelfSection, brandSlug: string | null): string {
  return `${HOME_SHELF_CACHE_PREFIX}${section}:b:${brandSlug ?? 'none'}`
}

// ── 投影 ─────────────────────────────────────────────────────────────────────

/** 阻断 flags（D-184-3.2）；missing_image 警告级放行——前台 SafeImage 降级链承接 */
const BLOCKING_FLAGS: ReadonlySet<HomePreviewCard['flags'][number]> = new Set([
  'disabled', 'pending', 'expired', 'ref_broken', 'unplayable',
] as const)

function isDisplayable(card: HomePreviewCard): boolean {
  return card.source !== 'empty'
    && card.videoId !== null
    && !card.flags.some((f) => BLOCKING_FLAGS.has(f))
}

/**
 * 整页合成一次 → 三个 hot section 的公开 shelf 投影（D-184-5.4 一次 miss 填三键的数据源）。
 * 读时复核（D-184-3.3 双查显式接受）：3 section 一次批量 listVideoCardsByIds——
 * 查询内建 published+public+未删过滤（复核①可见性）+ sourceCount>0（复核②可播性）。
 */
export async function buildHomeShelves(
  db: Pool,
  brandSlug: string | null,
): Promise<Map<HomeShelfSection, HomeShelfResponse>> {
  const preview = await buildHomePreview(db, {
    device: 'desktop',
    ...(brandSlug !== null ? { brand_slug: brandSlug } : {}),
  })

  // 投影候选收集（保持 preview 内合成序）
  const projected = new Map<HomeShelfSection, { cards: HomePreviewCard[]; snapshotAt: string | null }>()
  const allVideoIds: string[] = []
  for (const section of preview.sections) {
    if (!(HOME_SHELF_SECTIONS as readonly string[]).includes(section.key)) continue
    const cards = section.cards.filter(isDisplayable)
    projected.set(section.key as HomeShelfSection, {
      cards,
      snapshotAt: section.consumedSnapshotAt ?? null,
    })
    for (const card of cards) {
      if (card.videoId) allVideoIds.push(card.videoId)
    }
  }

  const freshById = new Map(
    (allVideoIds.length > 0 ? await listVideoCardsByIds(db, allVideoIds) : []).map((v) => [v.id, v]),
  )

  const shelves = new Map<HomeShelfSection, HomeShelfResponse>()
  for (const [section, { cards, snapshotAt }] of projected) {
    const items: HomeShelfItem[] = []
    for (const card of cards) {
      const video = card.videoId ? freshById.get(card.videoId) : undefined
      // 复核丢弃不回填（D-184-3.3：items ≤ displayCount 合法）
      if (!video || video.sourceCount === 0) continue
      items.push({ video, rank: items.length + 1, isPinned: card.source === 'pinned' })
    }
    shelves.set(section, { items, snapshotAt, generatedAt: preview.generatedAt })
  }
  return shelves
}
