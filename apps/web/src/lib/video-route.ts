import type { VideoType } from '@/types'

const PRIMARY_DETAIL_TYPES = new Set<VideoType>(['movie', 'series', 'anime', 'variety'])

function getDetailSegment(type: VideoType): string {
  return PRIMARY_DETAIL_TYPES.has(type) ? type : 'others'
}

export function getVideoDetailHref(video: { type: VideoType; slug: string | null; shortId: string }): string {
  const segment = getDetailSegment(video.type)
  const slugPart = video.slug ? `${video.slug}-${video.shortId}` : video.shortId
  return `/${segment}/${slugPart}`
}
