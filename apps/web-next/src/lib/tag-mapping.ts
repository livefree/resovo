import type { VideoCard } from '@resovo/types'
import type { TagLayerProps, LifecycleTag, SpecTag } from '@/types/tag'

const STATUS_TO_LIFECYCLE: Partial<Record<string, LifecycleTag>> = {
  ongoing:   'ongoing',
  completed: 'completed',
}

function deriveSpecs(video: Pick<VideoCard, 'subtitleLangs'>): SpecTag[] {
  const specs: SpecTag[] = []
  if (video.subtitleLangs.length > 0) specs.push('subtitled')
  // 4k/hdr/dolby/multilang: pending API fields (no DB source yet)
  return specs
}

export function videoCardToTagProps(
  video: Pick<VideoCard, 'status' | 'rating' | 'subtitleLangs'>,
): TagLayerProps {
  const lifecycle = STATUS_TO_LIFECYCLE[video.status]
  const rating =
    video.rating !== null
      ? { source: 'douban' as const, value: video.rating }
      : undefined
  const specs = deriveSpecs(video)

  return {
    lifecycle,
    rating,
    specs: specs.length > 0 ? specs : undefined,
    // trending: pending — no DB/API field available yet
  }
}
