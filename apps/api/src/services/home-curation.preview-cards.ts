/**
 * home-curation.preview-cards.ts — preview 卡片映射纯函数
 * （ADR-182 D-182-4 #1 / D-181-3；自 HomeCurationService.ts 拆出——file-size-budget
 * 500 行硬限，CHG-HOME-AUTOFILL-APPLY）
 */

import type {
  Banner,
  HomeModule,
  HomePreviewCard,
  HomePreviewCardFlag,
  HomeSectionKey,
  VideoCard,
} from '@resovo/types'

/** brand_scope 协议过滤（ADR-046：all-brands 或 brand_slug 匹配） */
export function brandVisible(row: { brandScope: string; brandSlug: string | null }, brandSlug: string | null): boolean {
  return row.brandScope === 'all-brands' || (brandSlug !== null && row.brandSlug === brandSlug)
}

/** 时间窗 flags 派生（D-181-3 统一口径；at 模拟时间） */
export function timeWindowFlags(startAt: string | null, endAt: string | null, enabled: boolean, at: Date): HomePreviewCardFlag[] {
  const flags: HomePreviewCardFlag[] = []
  if (!enabled) flags.push('disabled')
  if (endAt && new Date(endAt).getTime() <= at.getTime()) flags.push('expired')
  else if (startAt && new Date(startAt).getTime() > at.getTime()) flags.push('pending')
  return flags
}

/** banner 行 → 卡（D-181-3 字段映射：active_from→startAt / active_to→endAt / is_active→enabled） */
export function bannerToCard(banner: Banner, at: Date): HomePreviewCard {
  return {
    source: 'pinned',
    refId: banner.id,
    videoId: banner.linkType === 'video' ? banner.linkTarget : null,
    title: banner.title['zh-CN'] ?? banner.title['en'] ?? Object.values(banner.title)[0] ?? null,
    imageUrl: banner.imageUrl,
    linkHint: banner.linkTarget || null,
    startAt: banner.activeFrom,
    endAt: banner.activeTo,
    enabled: banner.isActive,
    // image_url NOT NULL（049）→ missing_image 不触发；尺寸/比例警告归 Phase 2 IMAGE-GUARD-BANNER
    flags: timeWindowFlags(banner.activeFrom, banner.activeTo, banner.isActive, at),
    explain: null,
  }
}

/** home_modules pinned 行 → 卡（video 充实经 cardMap；ref_broken = video 引用 404） */
export function moduleToCard(module: HomeModule, cardMap: ReadonlyMap<string, VideoCard>, at: Date): HomePreviewCard {
  const isVideo = module.contentRefType === 'video'
  const video = isVideo ? cardMap.get(module.contentRefId) : undefined
  const flags = timeWindowFlags(module.startAt, module.endAt, module.enabled, at)
  if (isVideo && !video) flags.push('ref_broken')
  if (video && video.sourceCount === 0) flags.push('unplayable')
  const imageUrl = module.imageUrl ?? video?.coverUrl ?? null
  if (!imageUrl) flags.push('missing_image')
  return {
    source: 'pinned',
    refId: module.id,
    videoId: isVideo ? module.contentRefId : null,
    title: module.title['zh-CN'] ?? module.title['en'] ?? video?.title ?? null,
    imageUrl,
    linkHint: isVideo ? (video?.slug ?? module.contentRefId) : module.contentRefId,
    startAt: module.startAt,
    endAt: module.endAt,
    enabled: module.enabled,
    flags,
    explain: null,
  }
}

/**
 * 自动补位视频 → 卡（origin 开放字符串：trending / rating / douban / bangumi，D-182-4.4 同口径）。
 * score 缺省取 video.rating（站内信号补位）；快照候选传 D-183-4 策略分 0–1
 * （ADR-184 D-184-4.6：explain.score 口径开放演进，CanvasCard 仅消费 origin 无区间假设）。
 */
export function videoToAutoCard(video: VideoCard, origin: string, rank: number, source: 'auto' | 'fallback', score?: number): HomePreviewCard {
  const flags: HomePreviewCardFlag[] = []
  if (!video.coverUrl) flags.push('missing_image')
  if (video.sourceCount === 0) flags.push('unplayable')
  return {
    source,
    refId: null,
    videoId: video.id,
    title: video.title,
    imageUrl: video.coverUrl,
    linkHint: video.slug,
    startAt: null,
    endAt: null,
    enabled: true,
    flags,
    explain: { origin, rank, score: score ?? video.rating ?? null },
  }
}

export const EMPTY_CARD: HomePreviewCard = {
  source: 'empty',
  refId: null,
  videoId: null,
  title: null,
  imageUrl: null,
  linkHint: null,
  startAt: null,
  endAt: null,
  enabled: true,
  flags: [],
  explain: null,
}

/** hot shelf section → 站内 trending 兜底的 video type（D-183-1 三池映射） */
export const HOT_SECTION_TYPE: Partial<Record<HomeSectionKey, 'movie' | 'series' | 'anime'>> = {
  hot_movies: 'movie',
  hot_series: 'series',
  hot_anime: 'anime',
}
