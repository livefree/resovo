'use client'

import type { VideoStatus } from './useMiniPlayerVideo'

interface MiniPlayerControlsProps {
  visible: boolean
  isPlaying: boolean
  localCurrentTime: number
  localDuration: number
  isMuted: boolean
  videoStatus: VideoStatus
  onTogglePlay: () => void
  onToggleMute: () => void
  onProgressPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onProgressPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onProgressPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onProgressKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function MiniPlayerControls({
  visible,
  isPlaying,
  localCurrentTime,
  localDuration,
  isMuted,
  videoStatus,
  onTogglePlay,
  onToggleMute,
  onProgressPointerDown,
  onProgressPointerMove,
  onProgressPointerUp,
  onProgressKeyDown,
}: MiniPlayerControlsProps) {
  const hasSource = videoStatus !== 'no-src' && videoStatus !== 'error'
  const hasDuration = localDuration > 0 && !isNaN(localDuration)
  const fillPct = hasDuration ? Math.min(100, (localCurrentTime / localDuration) * 100) : 0

  return (
    <div
      data-testid="mini-player-controls"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        background: 'color-mix(in srgb, var(--player-mini-ctrl-bg) 75%, transparent)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '8px',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'all' : 'none',
        transition: 'opacity 150ms ease',
        zIndex: 2,
      }}
    >
      {/* Play/Pause 按钮 */}
      <button
        type="button"
        data-testid="mini-player-play-pause"
        aria-label={isPlaying ? '暂停' : '播放'}
        onClick={onTogglePlay}
        disabled={!hasSource}
        style={{
          width: '24px',
          height: '24px',
          border: 'none',
          borderRadius: '4px',
          background: 'transparent',
          cursor: hasSource ? 'pointer' : 'not-allowed',
          opacity: hasSource ? 1 : 0.4,
          color: 'var(--player-mini-ctrl-fg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          {isPlaying
            ? <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>
            : <path d="M6 4l15 8-15 8V4z" />
          }
        </svg>
      </button>

      {/* 进度条 */}
      <div
        data-testid="mini-player-progress"
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={Math.round(hasDuration ? localDuration : 0)}
        aria-valuenow={Math.round(localCurrentTime)}
        aria-valuetext={`${formatTime(localCurrentTime)} / ${formatTime(localDuration)}`}
        tabIndex={hasDuration ? 0 : -1}
        onPointerDown={onProgressPointerDown}
        onPointerMove={onProgressPointerMove}
        onPointerUp={onProgressPointerUp}
        onKeyDown={onProgressKeyDown}
        style={{
          flex: 1,
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          cursor: hasDuration ? 'pointer' : 'default',
          pointerEvents: hasDuration ? 'auto' : 'none',
          opacity: hasDuration ? 1 : 0.4,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '4px', borderRadius: '2px', background: 'var(--player-mini-progress-track)' }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillPct}%`,
            background: 'var(--player-mini-progress-fill)',
            borderRadius: '2px',
          }} />
        </div>
      </div>

      {/* 时间显示 */}
      <span style={{
        fontSize: '10px',
        color: 'var(--player-mini-ctrl-fg)',
        minWidth: '64px',
        textAlign: 'center',
        flexShrink: 0,
      }}>
        {formatTime(localCurrentTime)} / {formatTime(localDuration)}
      </span>

      {/* 静音按钮 */}
      <button
        type="button"
        data-testid="mini-player-mute"
        aria-label={isMuted ? '取消静音' : '静音'}
        onClick={onToggleMute}
        disabled={!hasSource}
        style={{
          width: '24px',
          height: '24px',
          border: 'none',
          borderRadius: '4px',
          background: 'transparent',
          cursor: hasSource ? 'pointer' : 'not-allowed',
          opacity: hasSource ? 1 : 0.4,
          color: 'var(--player-mini-ctrl-fg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {isMuted
            ? <><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
            : <><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></>
          }
        </svg>
      </button>
    </div>
  )
}
