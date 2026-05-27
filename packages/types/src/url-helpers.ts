/**
 * url-helpers.ts — 跨 app 共享 URL 派生 helper（ADR-160 D-160-7）
 *
 * 沉淀自 apps/web-next/src/lib/video-route.ts（CHG-361-A）。
 * 与 VIDEO_TYPES 真源同包，纯函数 / 无 React 依赖 / 可被 server-next + web-next + apps/api 共享。
 *
 * 关联：ADR-002（Slug + 短 ID 混合 URL）/ ADR-160（Admin Preview）
 */

import type { VideoType } from './video.types'

const URL_SEGMENT_MAP: Partial<Record<VideoType, string>> = {
  variety: 'tvshow',
}

const PRIMARY_DETAIL_TYPES = new Set<VideoType>(['movie', 'series', 'anime', 'variety'])

function getDetailSegment(type: VideoType): string {
  if (!PRIMARY_DETAIL_TYPES.has(type)) return 'others'
  return URL_SEGMENT_MAP[type] ?? type
}

export function getVideoDetailHref(video: { type: VideoType; slug: string | null; shortId: string }): string {
  const segment = getDetailSegment(video.type)
  const slugPart = video.slug ? `${video.slug}-${video.shortId}` : video.shortId
  return `/${segment}/${slugPart}`
}
