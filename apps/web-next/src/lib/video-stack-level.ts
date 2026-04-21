import type { VideoType } from '@resovo/types'

// series / anime / variety — variety is routed as /tvshow/ (ADR-048 §4)
const EPISODIC_TYPES = new Set<VideoType>(['series', 'anime', 'variety'])

export function getStackLevel(type: VideoType): 0 | 1 {
  return EPISODIC_TYPES.has(type) ? 1 : 0
}
