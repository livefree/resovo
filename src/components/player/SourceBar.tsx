/**
 * SourceBar.tsx — 线路选择栏（位于进度条上方）
 * ≤3 条全显，>3 条折叠；切换线路保留播放进度
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type Player from 'video.js/dist/types/player'
import type { VideoSource as PlayerSource } from './VideoPlayer'

interface SourceBarProps {
  sources: PlayerSource[]
  activeIndex: number
  player: Player | null
  onSourceChange: (index: number) => void
  className?: string
}

export function SourceBar({ sources, activeIndex, player, onSourceChange, className }: SourceBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (sources.length === 0) return null

  const SHOW_LIMIT = 3
  const showAll = sources.length <= SHOW_LIMIT
  const displaySources = showAll || isExpanded ? sources : sources.slice(0, SHOW_LIMIT - 1)

  function handleSelect(index: number) {
    const currentTime = player?.currentTime() ?? 0
    onSourceChange(index)
    // 切换源后恢复播放进度
    setTimeout(() => {
      player?.currentTime(currentTime)
    }, 500)
  }

  return (
    <div
      className={cn('flex items-center gap-2 px-3 py-1', className)}
      data-testid="source-bar"
    >
      <span className="text-white/60 text-xs shrink-0">线路</span>

      <div className="flex flex-wrap gap-1.5">
        {displaySources.map((src, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            className={cn(
              'px-2.5 py-0.5 rounded text-xs transition-colors',
              i === activeIndex
                ? 'font-semibold'
                : 'text-white/70 hover:text-white'
            )}
            style={i === activeIndex ? { background: 'var(--gold)', color: 'black' } : {}}
            data-testid={`source-btn-${i}`}
          >
            {src.label ?? `线路${i + 1}`}
          </button>
        ))}

        {/* 展开/收起按钮 */}
        {!showAll && (
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="px-2.5 py-0.5 rounded text-xs text-white/70 hover:text-white transition-colors"
            data-testid="source-expand-btn"
          >
            {isExpanded ? '收起' : `+${sources.length - (SHOW_LIMIT - 1)} 条`}
          </button>
        )}
      </div>
    </div>
  )
}
