/**
 * SpeedPanel.tsx — 倍速面板
 * 4 预设（0.5/1.0/1.5/2.0）+ 自定义滑条
 * 数字键 1-4 选预设；面板打开时 ←→ 调滑条（ADR-011）
 * 位置：position: fixed; bottom: 80px; right: 20px
 */

'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import type Player from 'video.js/dist/types/player'

interface SpeedPanelProps {
  player: Player | null
  className?: string
}

const SPEED_PRESETS = [0.5, 1.0, 1.5, 2.0] as const

export function SpeedPanel({ player, className }: SpeedPanelProps) {
  const { playbackSpeed, setPlaybackSpeed, closePanel, isSpeedPanelOpen } = usePlayerStore()

  function applySpeed(speed: number) {
    setPlaybackSpeed(speed)
    player?.playbackRate(speed)
  }

  // 数字键 1-4 选预设，← → 调滑条（ADR-011 键盘状态机）
  useEffect(() => {
    if (!isSpeedPanelOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const keyMap: Record<string, number> = {
        '1': SPEED_PRESETS[0],
        '2': SPEED_PRESETS[1],
        '3': SPEED_PRESETS[2],
        '4': SPEED_PRESETS[3],
      }

      if (keyMap[e.key] !== undefined) {
        e.stopPropagation()
        applySpeed(keyMap[e.key])
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // 拦截 ← → 防止触发播放器快进后退（ADR-011 约束）
        e.stopPropagation()
        const step = e.key === 'ArrowRight' ? 0.1 : -0.1
        const next = Math.min(2.5, Math.max(0.25, playbackSpeed + step))
        applySpeed(Math.round(next * 10) / 10)
        return
      }

      if (e.key === 's' || e.key === 'S' || e.key === 'Escape') {
        closePanel('speed')
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeedPanelOpen, playbackSpeed])

  return (
    <div
      className={cn('rounded-lg overflow-hidden w-52', className)}
      style={{ background: 'rgba(0,0,0,0.85)' }}
      data-testid="speed-panel"
    >
      <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
        播放速度
      </div>

      {/* 预设按钮 */}
      <div className="grid grid-cols-4 gap-1 px-3 pb-2">
        {SPEED_PRESETS.map((speed, i) => (
          <button
            key={speed}
            onClick={() => applySpeed(speed)}
            className={cn(
              'py-1.5 rounded text-sm transition-colors font-medium',
              playbackSpeed === speed ? 'text-black font-semibold' : 'text-white hover:bg-white/10'
            )}
            style={playbackSpeed === speed ? { background: 'var(--gold)' } : {}}
            data-testid={`speed-preset-${speed}`}
            aria-label={`${speed}x speed (key ${i + 1})`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* 自定义滑条 */}
      <div className="px-4 pb-3 space-y-1">
        <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span>0.25x</span>
          <span className="font-semibold" style={{ color: 'var(--gold)' }}>
            {playbackSpeed}x
          </span>
          <span>2.5x</span>
        </div>
        <input
          type="range"
          min={0.25}
          max={2.5}
          step={0.05}
          value={playbackSpeed}
          onChange={(e) => applySpeed(Number(e.target.value))}
          className="w-full h-1 cursor-pointer appearance-none rounded"
          style={{ accentColor: 'var(--gold)' }}
          data-testid="speed-slider"
          aria-label="Custom speed"
        />
      </div>
    </div>
  )
}
