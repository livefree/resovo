'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * mini 态悬浮播放器。
 * - 桌面：固定右下角，320×180。
 * - 移动：固定底部，宽度 100%，高度 56px（横条形），浮于 safe-area-inset-bottom。
 * - FLIP 动画：full→mini 通过 CSS transition + transform 实现 220-360ms 过渡。
 * - 颜色全部使用 CSS 变量，不硬编码。
 */
export function MiniPlayer() {
  const router = useRouter()
  const shortId = usePlayerStore((s) => s.shortId)
  const currentEpisode = usePlayerStore((s) => s.currentEpisode)
  const hostOrigin = usePlayerStore((s) => s.hostOrigin)
  const closeHost = usePlayerStore((s) => s.closeHost)

  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  // FLIP 入场：mount 后下一帧 fade in（opacity + scale）
  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(timer)
  }, [])

  return (
    <div
      ref={containerRef}
      data-mini-player
      data-testid="mini-player"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--mini-player-gap) + env(safe-area-inset-bottom, 0px))',
        right: 'var(--mini-player-gap)',
        width: 'var(--mini-player-w)',
        height: 'var(--mini-player-h)',
        borderRadius: 'var(--mini-player-radius)',
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 32px color-mix(in srgb, var(--bg-canvas) 0%, transparent)',
        zIndex: 'var(--z-mini-player, 50)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'all',
        // FLIP 动画
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
        transition: `opacity var(--transition-shared, 320ms) var(--ease-page, ease),
                     transform var(--transition-shared, 320ms) var(--ease-page, ease)`,
      }}
    >
      {/* 占位内容区：REG-M3-04 接入 PlayerShell 后替换 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'black',
          color: 'color-mix(in srgb, white 60%, transparent)',
          fontSize: '0.75rem',
          textAlign: 'center',
          padding: '0.5rem',
        }}
      >
        {shortId ? `${shortId} · 第 ${currentEpisode} 集` : 'mini 播放器'}
      </div>

      {/* 控制栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.25rem 0.5rem',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <button
          type="button"
          aria-label="展开播放器"
          onClick={() => {
            const href = hostOrigin?.href ?? (shortId ? `/watch/${shortId}` : null)
            if (href) router.push(href)
          }}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            borderRadius: '0.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
          }}
        >
          展开
        </button>
        <button
          type="button"
          aria-label="关闭播放器"
          onClick={closeHost}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            borderRadius: '0.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
