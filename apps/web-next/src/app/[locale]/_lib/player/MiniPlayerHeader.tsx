'use client'

import type { PlayerHostOrigin } from '@/stores/playerStore'

interface MiniPlayerHeaderProps {
  dragHandleRef: React.RefObject<HTMLDivElement | null>
  headerVisible: boolean
  isExpanded: boolean
  shortId: string | null
  hostOrigin: PlayerHostOrigin | null
  onReturnToWatch: () => void
  onToggleExpand: () => void
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
  isExpanded,
  shortId,
  hostOrigin,
  onReturnToWatch,
  onToggleExpand,
  onClose,
}: MiniPlayerHeaderProps) {
  const tabIdx = headerVisible ? 0 : -1
  const canReturn = Boolean(hostOrigin?.slug)

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

      {/* 标题区 */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '12px',
          color: 'var(--fg-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {shortId ? '正在播放' : '迷你播放器'}
      </span>

      {/* 展开/折叠按钮 */}
      <button
        type="button"
        data-testid="mini-player-toggle-expand"
        aria-label={isExpanded ? '折叠' : '展开'}
        aria-expanded={isExpanded}
        tabIndex={tabIdx}
        onClick={onToggleExpand}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={BtnHover}
        onMouseLeave={BtnLeave}
        style={{ ...btnStyle, cursor: 'pointer' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {isExpanded
            ? <path d="M18 15l-6-6-6 6" />
            : <path d="M6 9l6 6 6-6" />
          }
        </svg>
      </button>

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
