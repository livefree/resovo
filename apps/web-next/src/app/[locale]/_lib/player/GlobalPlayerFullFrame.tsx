'use client'

import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { PlayerShell } from '@/components/player/PlayerShell'
import { applyFastTakeoverEntry } from '@/components/player/transitions/FastTakeover'
import { applyStandardTakeoverEntry } from '@/components/player/transitions/StandardTakeover'
import { CinemaMode } from './CinemaMode'

export function GlobalPlayerFullFrame() {
  const hostOrigin = usePlayerStore((s) => s.hostOrigin)
  const isHydrated = usePlayerStore((s) => s.isHydrated)
  const setHostMode = usePlayerStore((s) => s.setHostMode)
  const closeHost = usePlayerStore((s) => s.closeHost)
  const transition = usePlayerStore((s) => s.transition)
  const mode = usePlayerStore((s) => s.mode)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!frameRef.current) return
    if (transition === 'fast-takeover') {
      const anim = applyFastTakeoverEntry(frameRef.current)
      anim.onfinish = () => usePlayerStore.setState({ transition: null })
      return () => {
        anim.cancel()
        usePlayerStore.setState({ transition: null })
      }
    }
    if (transition === 'standard-takeover') {
      const anim = applyStandardTakeoverEntry(frameRef.current)
      anim.onfinish = () => usePlayerStore.setState({ transition: null })
      return () => {
        anim.cancel()
        usePlayerStore.setState({ transition: null })
      }
    }
  }, [transition])

  if (!isHydrated || !hostOrigin?.slug) return null

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--fg-muted)',
    cursor: 'pointer',
    fontSize: '1rem',
    flexShrink: 0,
  }

  return (
    <div
      ref={frameRef}
      data-testid="player-frame-full"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-full-player, 70)',
        background: 'var(--bg-canvas)',
        overflowY: 'auto',
        pointerEvents: 'all',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 控制栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <button
          type="button"
          aria-label="缩小为迷你播放器"
          title="缩小"
          onClick={() => setHostMode('mini')}
          style={btnStyle}
        >
          ⊟
        </button>
        <button
          type="button"
          aria-label="关闭播放器"
          title="关闭"
          onClick={closeHost}
          style={btnStyle}
        >
          ✕
        </button>
      </div>

      {/* 内容区：relative 容器用于 CinemaMode 绝对定位 */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <CinemaMode active={mode === 'theater'} />
        <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
          <PlayerShell slug={hostOrigin.slug} portalMode />
        </div>
      </div>
    </div>
  )
}
