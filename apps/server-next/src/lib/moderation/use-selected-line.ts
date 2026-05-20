'use client'

/**
 * use-selected-line.ts — LinesPanel ↔ AdminPlayer 桥接 hook（FIX-D）
 *
 * 职责：将 LinesPanel.onLineSelect 回调转换为 AdminPlayer 消费的
 *   { lineKey, sourceUrl, sourceId } 受控状态。
 *
 * sourceId = 选中线路第一个活跃集的 EpisodeMini.id（video_sources.id），
 *   用于 POST /v1/feedback/playback 去抖键。
 */

import { useState, useCallback } from 'react'
import type { LineAggregate } from '@resovo/admin-ui'

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

export function useSelectedLine() {
  const [selected, setSelected] = useState<SelectedLine | null>(null)

  const onLineSelect = useCallback(({ lineKey, line, firstActiveUrl }: SelectArgs) => {
    const firstEp = line.episodes.find(e => e.isActive)
    if (!firstEp || !firstActiveUrl) {
      setSelected(null)
      return
    }
    setSelected({ lineKey, sourceUrl: firstActiveUrl, sourceId: firstEp.id })
  }, [])

  const clearSelection = useCallback(() => setSelected(null), [])

  return { selected, onLineSelect, clearSelection } as const
}
