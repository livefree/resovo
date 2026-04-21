import type { VideoType } from '@resovo/types'

// series (连续剧/tvshow) and anime get the stacked-card cue per ADR-048
const EPISODIC_TYPES = new Set<VideoType>(['series', 'anime'])

export function getStackLevel(type: VideoType): 0 | 1 {
  return EPISODIC_TYPES.has(type) ? 1 : 0
}
