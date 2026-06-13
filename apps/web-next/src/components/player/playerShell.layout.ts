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

/**
 * PLAYER-LINE-BOUND-EP（红线 3）：inline 选集改为接收"活跃线路实际集号数组"，
 * 渲染真实集号文案（非连续集号 / 不再假设连续 1..N）。player-core onEpisodeChange(index)
 * 的 index 须经调用方映射回 episodeNumbers[index]，activeEpisodeIndex 用 indexOf 反查。
 */
export function getInlineEpisodes(
  isTheater: boolean,
  episodeNumbers: readonly number[]
): PlayerEpisodeItem[] | undefined {
  if (!isTheater || episodeNumbers.length <= 1) return undefined
  return episodeNumbers.map((ep) => ({ title: `第${ep}集` }))
}
