import type { VideoCard } from '@resovo/types'
import type { TagLayerProps, LifecycleTag } from '@/types/tag'

const STATUS_TO_LIFECYCLE: Partial<Record<string, LifecycleTag>> = {
  ongoing:   'ongoing',
  completed: 'completed',
}

export function videoCardToTagProps(video: Pick<VideoCard, 'status' | 'rating'>): TagLayerProps {
  const lifecycle = STATUS_TO_LIFECYCLE[video.status]
  const rating =
    video.rating !== null
      ? { source: 'douban' as const, value: video.rating }
      : undefined

  return { lifecycle, rating }
}
