'use client'

import type { PlayerHostOrigin } from '@/stores/playerStore'

interface MiniPlayerHeaderProps {
  dragHandleRef: React.RefObject<HTMLDivElement | null>
  headerVisible: boolean
  shortId: string | null
  hostOrigin: PlayerHostOrigin | null
  videoTitle: string | null
  currentEpisode: number
  episodeCount: number
  onReturnToWatch: () => void
  onClose: () => void
}

const btnStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: 'none',
  borderRadius: '4px',
  background: 'transparent',
  color: 'var(--player-mini-btn-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

function BtnHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'var(--player-mini-btn-hover-bg)'
}
function BtnLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'transparent'
}

export function MiniPlayerHeader({
  dragHandleRef,
  headerVisible,
  shortId,
  hostOrigin,
  videoTitle,
  currentEpisode,
  episodeCount,
  onReturnToWatch,
  onClose,
}: MiniPlayerHeaderProps) {
  const tabIdx = headerVisible ? 0 : -1
  const canReturn = Boolean(hostOrigin?.slug)
  // 仅在 shortId 存在时显示视频信息；title 未到位时降级为 shortId（避免 fetch 中显示空白）
  const titleText = shortId ? (videoTitle ?? '正在加载…') : '迷你播放器'
  const showEpisode = shortId !== null && episodeCount > 1 && currentEpisode > 0

  return (
    <div
      ref={dragHandleRef}
      data-mini-drag-handle
      data-testid="mini-player-drag-handle"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '32px',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '6px',
        background: 'var(--player-mini-header-bg)',
        opacity: headerVisible ? 1 : 0,
        pointerEvents: headerVisible ? 'all' : 'none',
        transition: 'opacity 150ms ease',
        cursor: 'move',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* 返回播放页按钮 */}
      <button
        type="button"
        data-testid="mini-player-return-btn"
        aria-label="返回播放页"
        aria-disabled={!canReturn}
        tabIndex={tabIdx}
        onClick={onReturnToWatch}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={BtnHover}
        onMouseLeave={BtnLeave}
        style={{
          ...btnStyle,
          cursor: canReturn ? 'pointer' : 'default',
          opacity: canReturn ? 1 : 0.4,
          pointerEvents: canReturn ? 'auto' : 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
        </svg>
      </button>

      {/* 标题区：视频名称 + 集数（多集时）。title 区可截断，集数 flex-shrink:0 永远可见 */}
      <div
        data-testid="mini-player-title"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: 'var(--fg-muted)',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {titleText}
        </span>
        {showEpisode && (
          <span
            data-testid="mini-player-episode"
            style={{
              flexShrink: 0,
              color: 'var(--accent-default)',
              fontWeight: 600,
            }}
          >
            第 {currentEpisode} 集
          </span>
        )}
      </div>

      {/* 关闭按钮 */}
      <button
        type="button"
        data-testid="mini-player-close-btn"
        aria-label="关闭播放器"
        tabIndex={tabIdx}
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={BtnHover}
        onMouseLeave={BtnLeave}
        style={{ ...btnStyle, cursor: 'pointer' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
