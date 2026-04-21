import type { VideoType } from '@resovo/types'

// Episode-based types show a stacked-card effect to signal "multiple entries"
const EPISODIC_TYPES = new Set<VideoType>(['series', 'anime', 'variety', 'documentary'])

export function getStackLevel(type: VideoType): 0 | 1 {
  return EPISODIC_TYPES.has(type) ? 1 : 0
}
