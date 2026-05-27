'use client'

/**
 * use-selected-line.ts — LinesPanel ↔ EpisodeSelector ↔ AdminPlayer 三方桥接 hook
 *
 * 职责（CHG-345）：
 *   - 接收 LinesPanel.onLineSelect 选中的 LineAggregate
 *   - 接收 EpisodeSelector 当前 currentEp（默认 1，保持向后兼容）
 *   - 派生 { lineKey, sourceUrl, sourceId } 供 AdminPlayer 消费
 *   - currentEp 改变时自动重算 sourceUrl（修复 CHG-345 P0 真 bug）
 *
 * 匹配规则:
 *   1. line.episodes.find(e => e.episodeNumber === currentEp && e.isActive)
 *   2. fallback: line.episodes.find(e => e.isActive)  — 当前 line 不含 currentEp 或非 active 时
 *   3. 全部 dead → null
 */

import { useState, useCallback, useMemo } from 'react'
import type { LineAggregate, EpisodeMini } from '@resovo/admin-ui'

export interface SelectedLine {
  readonly lineKey: string
  /** 第一个活跃集的 source_url，直接传给 Player.src */
  readonly sourceUrl: string
  /** 第一个活跃集的 video_sources.id，用于 feedback 上报 */
  readonly sourceId: string
}

interface SelectArgs {
  readonly lineKey: string
  readonly line: LineAggregate
  readonly firstActiveUrl: string | null
}

function findEpisode(line: LineAggregate, currentEp: number): EpisodeMini | null {
  const exact = line.episodes.find(e => e.episodeNumber === currentEp && e.isActive)
  if (exact) return exact
  return line.episodes.find(e => e.isActive) ?? null
}

export function useSelectedLine(currentEp: number = 1) {
  const [selectedLine, setSelectedLine] = useState<LineAggregate | null>(null)

  const selected = useMemo<SelectedLine | null>(() => {
    if (!selectedLine) return null
    const matched = findEpisode(selectedLine, currentEp)
    if (!matched) return null
    return {
      lineKey: selectedLine.key,
      sourceUrl: matched.sourceUrl,
      sourceId: matched.id,
    }
  }, [selectedLine, currentEp])

  const onLineSelect = useCallback((args: SelectArgs) => {
    setSelectedLine(args.line)
  }, [])

  const clearSelection = useCallback(() => setSelectedLine(null), [])

  return { selected, onLineSelect, clearSelection } as const
}
