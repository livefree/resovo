/**
 * ControlBar.tsx — 播放器自定义控制栏
 * 左侧：播放/暂停、下一集、音量（悬停展开滑条）、时间
 * 右侧：CC、倍速（显示当前值）、设置、剧场模式（桌面端）、全屏
 * ADR-011: 键盘状态机（PLAYER-05 实现）
 */

'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import type Player from 'video.js/dist/types/player'

interface ControlBarProps {
  player: Player | null
  onNextEpisode?: () => void
  className?: string
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function ControlBar({ player, onNextEpisode, className }: ControlBarProps) {
  const {
    isPlaying,
    volume,
    isMuted,
    playbackSpeed,
    currentTime,
    duration,
    mode,
    isSpeedPanelOpen,
    isCCPanelOpen,
    isSettingsPanelOpen,
    toggleMode,
    openPanel,
    closePanel,
    setVolume,
    setMuted,
  } = usePlayerStore()

  const [isVolumeHovered, setIsVolumeHovered] = useState(false)
  const volumeHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handlePlayPause() {
    if (!player) return
    if (isPlaying) {
      player.pause()
    } else {
      void player.play()
    }
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value)
    setVolume(v)
    player?.volume(v)
  }

  function handleMuteToggle() {
    const next = !isMuted
    setMuted(next)
    player?.muted(next)
  }

  function handleVolumeMouseEnter() {
    if (volumeHoverTimeout.current) clearTimeout(volumeHoverTimeout.current)
    setIsVolumeHovered(true)
  }

  function handleVolumeMouseLeave() {
    volumeHoverTimeout.current = setTimeout(() => setIsVolumeHovered(false), 300)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value)
    player?.currentTime(t)
  }

  function handleFullscreen() {
    if (!player) return
    if (player.isFullscreen()) {
      void player.exitFullscreen()
    } else {
      void player.requestFullscreen()
    }
  }

  function handleSpeedToggle() {
    if (isSpeedPanelOpen) {
      closePanel('speed')
    } else {
      openPanel('speed')
    }
  }

  function handleCCToggle() {
    if (isCCPanelOpen) {
      closePanel('cc')
    } else {
      openPanel('cc')
    }
  }

  function handleSettingsToggle() {
    if (isSettingsPanelOpen) {
      closePanel('settings')
    } else {
      openPanel('settings')
    }
  }

  const displayVolume = isMuted ? 0 : volume

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 px-3 py-2',
        'bg-gradient-to-t from-black/80 to-transparent',
        className
      )}
      data-testid="control-bar"
    >
      {/* 进度条 */}
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1 mb-2 cursor-pointer appearance-none rounded"
        style={{ accentColor: 'var(--gold)' }}
        data-testid="progress-bar"
        aria-label="Seek"
      />

      <div className="flex items-center justify-between gap-2">
        {/* ── 左侧控制区 ───────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* 播放/暂停 */}
          <button
            onClick={handlePlayPause}
            className="text-white hover:text-[var(--gold)] transition-colors text-lg w-8 h-8 flex items-center justify-center"
            data-testid="play-pause-btn"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* 下一集 */}
          {onNextEpisode && (
            <button
              onClick={onNextEpisode}
              className="text-white hover:text-[var(--gold)] transition-colors text-sm w-8 h-8 flex items-center justify-center"
              data-testid="next-episode-btn"
              aria-label="Next episode"
            >
              ⏭
            </button>
          )}

          {/* 音量 */}
          <div
            className="flex items-center gap-1"
            onMouseEnter={handleVolumeMouseEnter}
            onMouseLeave={handleVolumeMouseLeave}
            data-testid="volume-control"
          >
            <button
              onClick={handleMuteToggle}
              className="text-white hover:text-[var(--gold)] transition-colors text-sm w-8 h-8 flex items-center justify-center"
              data-testid="mute-btn"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {displayVolume === 0 ? '🔇' : displayVolume < 0.5 ? '🔉' : '🔊'}
            </button>

            {/* 音量滑条（移动端通过 CSS 隐藏） */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={displayVolume}
              onChange={handleVolumeChange}
              className={cn(
                'h-1 cursor-pointer appearance-none rounded transition-all duration-200',
                // 移动端隐藏，桌面端根据 hover 状态显示
                'hidden sm:block',
                isVolumeHovered ? 'w-20 opacity-100' : 'w-0 opacity-0'
              )}
              style={{ accentColor: 'var(--gold)' }}
              data-testid="volume-slider"
              aria-label="Volume"
            />
          </div>

          {/* 时间显示 */}
          <span
            className="text-white text-xs font-mono tabular-nums"
            data-testid="time-display"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* ── 右侧控制区 ───────────────────────────────────── */}
        <div className="flex items-center gap-1">
          {/* CC 字幕 */}
          <button
            onClick={handleCCToggle}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors',
              isCCPanelOpen
                ? 'text-black font-semibold'
                : 'text-white hover:text-[var(--gold)]'
            )}
            style={isCCPanelOpen ? { background: 'var(--gold)' } : {}}
            data-testid="cc-btn"
            aria-label="Subtitles"
          >
            CC
          </button>

          {/* 倍速 */}
          <button
            onClick={handleSpeedToggle}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors',
              isSpeedPanelOpen
                ? 'text-black font-semibold'
                : 'text-white hover:text-[var(--gold)]'
            )}
            style={isSpeedPanelOpen ? { background: 'var(--gold)' } : {}}
            data-testid="speed-btn"
            aria-label="Playback speed"
          >
            {playbackSpeed}x
          </button>

          {/* 设置 */}
          <button
            onClick={handleSettingsToggle}
            className={cn(
              'text-sm w-8 h-8 flex items-center justify-center rounded transition-colors',
              isSettingsPanelOpen
                ? 'text-black'
                : 'text-white hover:text-[var(--gold)]'
            )}
            style={isSettingsPanelOpen ? { background: 'var(--gold)' } : {}}
            data-testid="settings-btn"
            aria-label="Settings"
          >
            ⚙
          </button>

          {/* 剧场模式（仅桌面端） */}
          <button
            onClick={toggleMode}
            className="hidden lg:flex text-white hover:text-[var(--gold)] transition-colors text-sm w-8 h-8 items-center justify-center"
            data-testid="control-theater-btn"
            aria-label={mode === 'theater' ? 'Exit theater mode' : 'Theater mode'}
          >
            {mode === 'theater' ? '⊡' : '⊞'}
          </button>

          {/* 全屏 */}
          <button
            onClick={handleFullscreen}
            className="text-white hover:text-[var(--gold)] transition-colors text-sm w-8 h-8 flex items-center justify-center"
            data-testid="fullscreen-btn"
            aria-label="Fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>
    </div>
  )
}
