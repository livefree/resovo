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
    <div className={cn('p-2', className)} data-testid="source-bar">
      <div
        className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5"
        data-testid="source-grid"
      >
        {sources.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSourceChange(i)}
            className={cn(
              'py-2 text-center text-sm rounded transition-colors',
              i === activeIndex
                ? 'font-bold shadow-sm'
                : 'hover:bg-[var(--bg-surface-sunken)]'
            )}
            style={
              i === activeIndex
                ? { background: 'var(--accent-default)', color: 'var(--accent-fg)' }
                : { background: 'var(--bg-surface)', color: 'var(--fg-default)' }
            }
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
