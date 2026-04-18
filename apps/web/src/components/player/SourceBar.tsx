/**
 * SourceBar.tsx — 线路选择栏（固定网格）
 * Resovo 特有：同一视频的多个 CDN 提供商/线路切换
 * CHG-20: 移除 video.js Player 依赖，由 PlayerShell 通过 src prop 控制播放源
 */

'use client'

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
  if (sources.length === 0) return null

  return (
    <div
      className={cn('p-2', className)}
      data-testid="source-bar"
    >
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5" data-testid="source-grid">
        {sources.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSourceChange(i)}
            className={cn(
              'py-2 text-center text-sm rounded transition-colors',
              i === activeIndex
                ? 'bg-[var(--accent)] text-black font-bold shadow-sm'
                : 'bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--foreground)]'
            )}
            data-testid={`source-btn-${i}`}
            title={src.label ?? `线路${i + 1}`}
          >
            {src.label ?? `线路${i + 1}`}
          </button>
        ))}
      </div>
    </div>
  )
}
