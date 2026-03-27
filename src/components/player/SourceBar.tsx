/**
 * SourceBar.tsx — 线路选择栏（播放器下方）
 * Resovo 特有：同一视频的多个 CDN 提供商/线路切换
 * CHG-20: 移除 video.js Player 依赖，由 PlayerShell 通过 src prop 控制播放源
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface SourceItem {
  src: string
  type: string
  label?: string
}

interface SourceBarProps {
  sources: SourceItem[]
  activeIndex: number
  onSourceChange: (index: number) => void
  className?: string
}

export function SourceBar({ sources, activeIndex, onSourceChange, className }: SourceBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (sources.length === 0) return null

  const SHOW_LIMIT = 3
  const showAll = sources.length <= SHOW_LIMIT
  const displaySources = showAll || isExpanded ? sources : sources.slice(0, SHOW_LIMIT - 1)

  return (
    <div
      className={cn('flex items-center gap-2 px-3 py-1', className)}
      data-testid="source-bar"
    >
      <span className="text-xs shrink-0" style={{ color: 'var(--muted-foreground)' }}>线路</span>

      <div className="flex flex-wrap gap-1.5">
        {displaySources.map((src, i) => (
          <button
            key={i}
            onClick={() => onSourceChange(i)}
            className={cn(
              'px-2.5 py-0.5 rounded text-xs transition-colors',
              i === activeIndex
                ? 'font-semibold'
                : 'hover:bg-[var(--border)]'
            )}
            style={
              i === activeIndex
                ? { background: 'var(--gold)', color: 'black' }
                : { color: 'var(--foreground)' }
            }
            data-testid={`source-btn-${i}`}
          >
            {src.label ?? `线路${i + 1}`}
          </button>
        ))}

        {!showAll && (
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="px-2.5 py-0.5 rounded text-xs transition-colors hover:bg-[var(--border)]"
            style={{ color: 'var(--muted-foreground)' }}
            data-testid="source-expand-btn"
          >
            {isExpanded ? '收起' : `+${sources.length - (SHOW_LIMIT - 1)} 条`}
          </button>
        )}
      </div>
    </div>
  )
}
