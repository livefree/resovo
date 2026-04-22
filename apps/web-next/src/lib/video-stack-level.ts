import type { VideoType } from '@resovo/types'

// series / anime / variety — variety is routed as /tvshow/ (ADR-048 §4)
const EPISODIC_TYPES = new Set<VideoType>(['series', 'anime', 'variety'])

export function getStackLevel(type: VideoType): 0 | 2 {
  return EPISODIC_TYPES.has(type) ? 2 : 0
}
