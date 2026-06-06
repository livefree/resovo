/**
 * home-curation.preview.ts — 端点 #1 整页预览聚合（ADR-182 D-182-4 #1）
 *
 * 自 HomeCurationService.ts 拆出（file-size-budget 500 行硬限，
 * CHG-HOME-AUTOFILL-APPLY）；Service.buildPreview 单点委托本模块。
 * Phase 1 = 正式配置预览（无草稿叠加）；**跳过 Redis 缓存**（方案 §12）；
 * `at` 仅影响时间窗判定，不回放历史数据。
 * 跨区块去重 = 聚合层唯一权威（ADR-183 D-183-6）：按 HOME_SECTION_KEYS 渲染序
 * 先到先得，pinned 进占用集、auto/fallback 补位跳过已占用；allow_duplicates 豁免。
 */

import type { z } from 'zod'
import type { Pool } from 'pg'
import {
  HOME_SECTION_KEYS,
  type HomeModule,
  type HomePreview,
  type HomePreviewCard,
  type HomePreviewSection,
  type HomeSectionKey,
  type HomeSectionSettings,
  type VideoCard,
} from '@resovo/types'
import { listHomeSectionSettings } from '@/api/db/queries/home-section-settings'
import { listAllBanners } from '@/api/db/queries/home-banners'
import { listAdminHomeModules } from '@/api/db/queries/home-modules'
import { listTrendingVideos } from '@/api/db/queries/videos'
import { listVideosByRatingDesc, listVideoCardsByIds } from '@/api/db/queries/videos.status'
import { occupyVideoIds, isOccupied } from '@/api/services/home-autofill'
import type { PreviewQuerySchema } from '@/api/services/home-curation.schemas'
import {
  brandVisible,
  bannerToCard,
  moduleToCard,
  videoToAutoCard,
  EMPTY_CARD,
  HOT_SECTION_TYPE,
} from '@/api/services/home-curation.preview-cards'

export async function buildHomePreview(
  db: Pool,
  query: z.infer<typeof PreviewQuerySchema>,
): Promise<HomePreview> {
  const at = query.at ? new Date(query.at) : new Date()
  const brandSlug = query.brand_slug ?? null

  const [settingsRows, bannersResult, modulesResult] = await Promise.all([
    listHomeSectionSettings(db),
    listAllBanners(db, { page: 1, limit: 100 }),
    listAdminHomeModules(db, { page: 1, limit: 500 }),
  ])
  const settingsBySection = new Map(settingsRows.map((s) => [s.section, s]))

  // brand 过滤（ADR-046 协议）+ 按 section 分组（banner slot 行已冻结，归冻结存量不进 preview）
  const banners = bannersResult.rows.filter((b) => brandVisible(b, brandSlug))
  const modulesBySlot = new Map<string, HomeModule[]>()
  for (const m of modulesResult.rows) {
    if (m.slot === 'banner' || !brandVisible(m, brandSlug)) continue
    const list = modulesBySlot.get(m.slot) ?? []
    list.push(m)
    modulesBySlot.set(m.slot, list)
  }

  // video 引用批量充实（避免 N+1）
  const videoIds = [...modulesBySlot.values()].flat()
    .filter((m) => m.contentRefType === 'video')
    .map((m) => m.contentRefId)
  const cardMap = new Map(
    (videoIds.length > 0 ? await listVideoCardsByIds(db, videoIds) : []).map((v) => [v.id, v]),
  )

  // 跨区块占用集（聚合层唯一权威，D-183-6；去重纯函数单一实现 services/home-autofill/dedup）
  const occupied = new Set<string>()

  const sections: HomePreviewSection[] = []
  for (const key of HOME_SECTION_KEYS) {
    const settings = settingsBySection.get(key)
    if (!settings) continue // seed 恒存在；缺行 = 迁移漂移，跳过

    let cards: HomePreviewCard[]
    if (key === 'banner') {
      cards = banners.map((b) => bannerToCard(b, at))
    } else {
      const pinned = (modulesBySlot.get(key) ?? []).map((m) => moduleToCard(m, cardMap, at))
      cards = pinned
      // pinned 视频进占用集（人工优先，不被去重）
      occupyVideoIds(occupied, pinned.map((c) => c.videoId), settings.allowDuplicates)
      // 自动补位（活跃 pinned 计数后补到 displayCount；Phase 3 候选快照实装前走站内信号）
      const activeCount = pinned.filter((c) => c.enabled && c.flags.length === 0).length
      const need = Math.max(0, settings.displayCount - activeCount)
      if (need > 0 && settings.autofillMode !== 'manual_only' && key !== 'type_shortcuts') {
        const fill = await fetchAutoFill(db, key, need, pinned, occupied, settings)
        cards = [...pinned, ...fill]
        occupyVideoIds(occupied, fill.map((c) => c.videoId), settings.allowDuplicates)
      }
    }

    // 空卡片占位 = max(0, displayCount − 非 empty 卡数)（D-182-3 公式）
    const emptyCount = Math.max(0, settings.displayCount - cards.length)
    for (let i = 0; i < emptyCount; i += 1) cards.push({ ...EMPTY_CARD })

    sections.push({ key, settings, cards })
  }

  return {
    sections,
    generatedAt: new Date().toISOString(),
    context: { brandSlug, locale: query.locale ?? null, at: query.at ?? null, device: query.device },
  }
}

/** 自动补位取数（Phase 1：top10 走 rating、featured 走 trending、hot_* 走 trending 兜底） */
async function fetchAutoFill(
  db: Pool,
  key: HomeSectionKey,
  need: number,
  pinned: HomePreviewCard[],
  occupied: ReadonlySet<string>,
  settings: HomeSectionSettings,
): Promise<HomePreviewCard[]> {
  const pinnedIds = pinned.flatMap((c) => (c.videoId ? [c.videoId] : []))
  const skip = (id: string) => pinnedIds.includes(id) || isOccupied(occupied, id, settings.allowDuplicates)

  let candidates: VideoCard[]
  let origin: string
  let source: 'auto' | 'fallback'
  if (key === 'top10') {
    // 取 need + 占用余量，过滤后截断（excludeIds 仅排 pinned，占用集本地过滤）
    candidates = await listVideosByRatingDesc(db, Math.min(need + occupied.size, 100), pinnedIds)
    origin = 'rating'
    source = 'auto'
  } else {
    const type = HOT_SECTION_TYPE[key]
    candidates = await listTrendingVideos(db, { period: 'week', type, limit: Math.min(need + occupied.size, 50) })
    origin = 'trending'
    // hot_*：豆瓣/Bangumi 候选快照实装（Phase 3）前为 fallback 语义；featured 为 auto
    source = type ? 'fallback' : 'auto'
  }

  const fill: HomePreviewCard[] = []
  let rank = 1
  for (const video of candidates) {
    if (fill.length >= need) break
    if (skip(video.id)) continue
    fill.push(videoToAutoCard(video, origin, rank, source))
    rank += 1
  }
  return fill
}
