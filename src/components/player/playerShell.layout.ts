import { cn } from '@/lib/utils'

export interface PlayerEpisodeItem {
  title: string
}

export function getPlayerLayoutClass(isTheater: boolean): string {
  return cn(
    'flex transition-all duration-300',
    isTheater ? 'flex-col gap-0' : 'gap-4 lg:flex-row flex-col'
  )
}

export function getSidePanelClass(isTheater: boolean): string {
  return cn(
    'transition-all duration-300 flex flex-col gap-4',
    isTheater
      ? 'max-h-0 overflow-hidden opacity-0 pointer-events-none lg:w-0'
      : 'w-full lg:w-72 xl:w-80 shrink-0 opacity-100 self-stretch'
  )
}

/**
 * 默认模式使用右侧面板选集；剧场模式侧栏收起时，回退到播放器内选集面板。
 */
export function getInlineEpisodes(isTheater: boolean, episodeCount: number): PlayerEpisodeItem[] | undefined {
  if (!isTheater || episodeCount <= 1) return undefined
  return Array.from({ length: episodeCount }, (_, i) => ({ title: `第${i + 1}集` }))
}
