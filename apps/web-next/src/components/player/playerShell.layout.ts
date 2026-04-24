/**
 * playerShell.layout — HANDOFF-18 对齐 docs/frontend_design_spec_20260423.md §15
 *
 * 布局工具类使用 globals.css 中定义的 .player-layout / .player-side-panel 工具类，
 * 响应式行为（1fr + var(--player-panel-w)）由 CSS 驱动，不在 TS 层硬编码。
 */

import { cn } from '@/lib/utils'

export interface PlayerEpisodeItem {
  title: string
}

export function getPlayerLayoutClass(isTheater: boolean): string {
  return cn('player-layout', isTheater && 'player-layout--theater')
}

export function getSidePanelClass(isTheater: boolean): string {
  return cn('player-side-panel', isTheater && 'player-side-panel--theater')
}

export function getInlineEpisodes(
  isTheater: boolean,
  episodeCount: number
): PlayerEpisodeItem[] | undefined {
  if (!isTheater || episodeCount <= 1) return undefined
  return Array.from({ length: episodeCount }, (_, i) => ({ title: `第${i + 1}集` }))
}
