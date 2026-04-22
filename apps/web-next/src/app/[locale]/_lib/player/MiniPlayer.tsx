'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * mini 态悬浮播放器。
 * - 桌面：固定右下角，320×180（CSS 变量控制）。
 * - 移动：固定底部，全宽 56px 条形，贴 Tab Bar 顶部（globals.css @media(hover:none) 覆盖）。
 * - 颜色全部使用 CSS 变量，不硬编码。
 */
export function MiniPlayer() {
  const shortId = usePlayerStore((s) => s.shortId)
  const currentEpisode = usePlayerStore((s) => s.currentEpisode)
  const setHostMode = usePlayerStore((s) => s.setHostMode)
  const closeHost = usePlayerStore((s) => s.closeHost)
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  // FLIP 入场：mount 后下一帧 fade in（opacity + scale）
  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(timer)
  }, [])

  function handleExpand() {
    setHostMode('full')
  }

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
        boxShadow: '0 8px 32px color-mix(in srgb, black 40%, transparent)',
        zIndex: 'var(--z-mini-player)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'all',
        // FLIP 入场动画
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
        transition: `opacity var(--transition-shared) var(--ease-page),
                     transform var(--transition-shared) var(--ease-page)`,
      }}
    >
      {/* 内容区：显示当前播放信息 */}
      <button
        type="button"
        aria-label="展开播放器"
        onClick={handleExpand}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-surface-sunken)',
          cursor: 'pointer',
          border: 'none',
          flexDirection: 'column',
          gap: '4px',
          padding: '0 12px',
          minWidth: 0,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          maxWidth: '100%',
        }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            style={{ color: 'var(--accent-default)', flexShrink: 0 }}
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--fg-default)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              textAlign: 'left',
            }}
          >
            {shortId ? `第 ${currentEpisode} 集` : '正在播放'}
          </span>
        </div>
      </button>

      {/* 控制栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.25rem 0.5rem',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label="展开播放器"
          onClick={handleExpand}
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
