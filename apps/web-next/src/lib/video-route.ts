import type { VideoType } from '@resovo/types'

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
