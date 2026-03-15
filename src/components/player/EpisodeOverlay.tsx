/**
 * EpisodeOverlay.tsx — 选集矩阵浮层（从播放器左下角向上滑出）
 * 半透明背景 + backdrop-filter
 * 8 列网格；方向键导航；Enter 确认；Esc/外部点击关闭
 * ADR-011: 选集浮层打开时键盘最高优先级
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'

interface EpisodeOverlayProps {
  episodeCount: number
  currentEpisode: number
  onSelect: (episode: number) => void
  className?: string
}

const COLS = 8

export function EpisodeOverlay({
  episodeCount,
  currentEpisode,
  onSelect,
  className,
}: EpisodeOverlayProps) {
  const { isEpisodePanelOpen, closePanel } = usePlayerStore()
  const [focusedIndex, setFocusedIndex] = useState(currentEpisode - 1)
  const overlayRef = useRef<HTMLDivElement>(null)

  // 打开时聚焦当前集数
  useEffect(() => {
    if (isEpisodePanelOpen) {
      setFocusedIndex(currentEpisode - 1)
    }
  }, [isEpisodePanelOpen, currentEpisode])

  // 键盘导航（ADR-011 最高优先级）
  useEffect(() => {
    if (!isEpisodePanelOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(episodeCount - 1, i + 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setFocusedIndex((i) => Math.max(0, i - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(episodeCount - 1, i + COLS))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((i) => Math.max(0, i - COLS))
          break
        case 'Enter':
          e.preventDefault()
          onSelect(focusedIndex + 1)
          closePanel('episode')
          break
        case 'Escape':
          e.preventDefault()
          closePanel('episode')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEpisodePanelOpen, focusedIndex, episodeCount])

  if (!isEpisodePanelOpen) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 z-10"
        onClick={() => closePanel('episode')}
        data-testid="episode-overlay-backdrop"
      />

      {/* 浮层（左下角向上滑出） */}
      <div
        ref={overlayRef}
        className={cn(
          'absolute left-0 bottom-16 z-20 w-full max-h-72 overflow-y-auto',
          'rounded-t-lg p-4',
          className
        )}
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          animation: 'slideUp 0.2s ease-out',
        }}
        data-testid="episode-overlay"
      >
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          选集（共 {episodeCount} 集）
        </h3>

        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {Array.from({ length: episodeCount }, (_, i) => i + 1).map((ep) => {
            const isCurrent = ep === currentEpisode
            const isFocused = ep === focusedIndex + 1
            return (
              <button
                key={ep}
                onClick={() => { onSelect(ep); closePanel('episode') }}
                className={cn(
                  'h-8 rounded text-xs font-medium transition-colors',
                  isFocused && !isCurrent && 'ring-1 ring-white/50'
                )}
                style={
                  isCurrent
                    ? { background: 'var(--gold)', color: 'black' }
                    : { background: 'rgba(255,255,255,0.1)', color: 'white' }
                }
                data-testid={`overlay-episode-${ep}`}
              >
                {ep}
              </button>
            )
          })}
        </div>
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
