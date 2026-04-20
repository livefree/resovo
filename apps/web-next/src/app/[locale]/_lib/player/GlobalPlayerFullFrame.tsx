'use client'

import { usePlayerStore } from '@/stores/playerStore'

/**
 * full 态占位框架（REG-M3-01）。
 * REG-M3-04 将 PlayerShell 逻辑迁入后替换此组件。
 */
export function GlobalPlayerFullFrame() {
  const shortId = usePlayerStore((s) => s.shortId)
  const currentEpisode = usePlayerStore((s) => s.currentEpisode)
  const closeHost = usePlayerStore((s) => s.closeHost)

  return (
    <div
      data-testid="global-player-full"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-player-host, 40)',
        background: 'var(--bg-canvas)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'all',
      }}
    >
      <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
        {shortId ? `全局播放宿主 full — ${shortId} 第 ${currentEpisode} 集` : '播放器就绪（等待 REG-M3-04 接入）'}
      </p>
      <button
        type="button"
        onClick={closeHost}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--fg-default)',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        关闭
      </button>
    </div>
  )
}
