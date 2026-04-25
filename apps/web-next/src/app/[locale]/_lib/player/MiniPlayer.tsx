'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { usePlayerStore } from '@/stores/playerStore'
import {
  MINI_GEOMETRY_CONSTRAINTS,
  MINI_GEOMETRY_DEFAULTS,
  computeDockPosition,
  deriveHeightFromWidth,
  type MiniGeometryV1,
} from '@/stores/_persist/mini-geometry'
import { attachMiniPlayerDrag, attachViewportResizeWatcher } from '@/lib/mini-player/drag'

/**
 * MiniPlayer — HANDOFF-31 骨架重构（非交互基础层）
 *
 * 几何模型（UI Contract §2）：
 *   - 容器 position: fixed，overflow: hidden，所有子元素绝对定位
 *   - Collapsed：height = videoH（= width × 9/16）
 *   - Expanded：height = videoH + 44px（控制栏）
 *   - Header（32px）position: absolute; top:0 叠加视频，不占容器高度
 *   - Header 默认 opacity:0 + pointer-events:none；hover 容器时显现
 *
 * 产品决策变更（2026-04-24）：
 *   - 展开/折叠按钮：切换 isExpanded（不再 setHostMode('full')）
 *   - 返回播放页：独立 ← 按钮，router.push 到 /watch
 *   - 关闭：handleClose() → releaseMiniPlayer()（完整清零 store）
 *   - 移动端：releaseMiniPlayer()（CSS display:none 为双保险，见 globals.css HANDOFF-31）
 *   - PiP：从 MiniPlayer 移除，由 PlayerShell 独占
 */
export function MiniPlayer() {
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? 'zh-CN'

  const shortId = usePlayerStore((s) => s.shortId)
  const hostOrigin = usePlayerStore((s) => s.hostOrigin)
  const geometry = usePlayerStore((s) => s.geometry)
  const takeoverActive = usePlayerStore((s) => s.takeoverActive)
  const setGeometry = usePlayerStore((s) => s.setGeometry)
  const releaseMiniPlayer = usePlayerStore((s) => s.releaseMiniPlayer)

  const [isExpanded, setIsExpanded] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(false)
  const [visible, setVisible] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragHandleRef = useRef<HTMLDivElement | null>(null)
  const resizeHandleRef = useRef<HTMLDivElement | null>(null)
  // videoRef：HANDOFF-32 接入，此阶段始终 null
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const geometryRef = useRef<MiniGeometryV1>(geometry ?? MINI_GEOMETRY_DEFAULTS)
  useEffect(() => {
    geometryRef.current = geometry ?? MINI_GEOMETRY_DEFAULTS
  }, [geometry])

  const userInteractingRef = useRef(false)
  const headerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // mount 后下一帧 fade in + spring pop-in
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = useCallback(() => {
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.src = ''
    releaseMiniPlayer()
  }, [releaseMiniPlayer])

  // 移动端防护（UI Contract §13.6）：MQ 匹配时立即 release，不仅靠 CSS display:none
  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)')
    if (mq.matches) {
      handleClose()
      return
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) handleClose()
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [handleClose])

  // Esc 关闭 + m 键静音占位（HANDOFF-32 接入 videoRef 后实现 toggle mute）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
      // m 键静音：videoRef.current?.muted = !videoRef.current?.muted（HANDOFF-32）
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handleClose])

  // 应用 geometry + isExpanded 到 DOM（left/top/width/height）
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || userInteractingRef.current) return
    const geom = geometry ?? MINI_GEOMETRY_DEFAULTS
    const vw = window.innerWidth
    const vh = window.innerHeight
    const videoH = deriveHeightFromWidth(geom.width)
    const height = isExpanded ? videoH + 44 : videoH
    const dockGeom: MiniGeometryV1 = { ...geom, height }
    const { left, top } = computeDockPosition(dockGeom, vw, vh)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.width = `${geom.width}px`
    el.style.height = `${height}px`
  }, [geometry, isExpanded])

  // attach drag + viewport resize watcher
  useEffect(() => {
    const container = containerRef.current
    const dragHandle = dragHandleRef.current
    const resizeHandle = resizeHandleRef.current
    if (!container || !dragHandle || !resizeHandle) return

    const getGeometry = () => geometryRef.current
    const commitGeometry = (g: MiniGeometryV1) => {
      geometryRef.current = g
      setGeometry(g)
    }
    const detachDrag = attachMiniPlayerDrag({
      container,
      dragHandle,
      resizeHandle,
      getGeometry,
      commitGeometry,
      onInteractionChange: (interacting) => { userInteractingRef.current = interacting },
    })
    const detachResizeWatcher = attachViewportResizeWatcher(container, getGeometry, commitGeometry)
    return () => {
      detachDrag()
      detachResizeWatcher()
    }
  }, [setGeometry])

  function handleReturnToWatch() {
    if (hostOrigin?.slug) {
      router.push(`/${locale}/watch/${hostOrigin.slug}`)
    }
  }

  function handleToggleExpand() {
    setIsExpanded((prev) => !prev)
    // useLayoutEffect 依赖 isExpanded，会自动重算 top（底角 dock 防超出）
  }

  function handleContainerMouseEnter() {
    if (headerHideTimerRef.current !== null) {
      clearTimeout(headerHideTimerRef.current)
      headerHideTimerRef.current = null
    }
    setHeaderVisible(true)
  }

  function handleContainerMouseLeave() {
    headerHideTimerRef.current = setTimeout(() => {
      headerHideTimerRef.current = null
      setHeaderVisible(false)
    }, 200)
  }

  const geom = geometry ?? MINI_GEOMETRY_DEFAULTS
  const videoH = deriveHeightFromWidth(geom.width)

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="迷你播放器"
      data-mini-player
      data-testid="mini-player"
      onMouseEnter={handleContainerMouseEnter}
      onMouseLeave={handleContainerMouseLeave}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: `${geom.width}px`,
        height: `${isExpanded ? videoH + 44 : videoH}px`,
        minWidth: `${MINI_GEOMETRY_CONSTRAINTS.MIN_WIDTH}px`,
        maxWidth: `${MINI_GEOMETRY_CONSTRAINTS.MAX_WIDTH}px`,
        background: 'var(--player-mini-bg)',
        border: '1px solid var(--player-mini-border)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: 'var(--player-mini-shadow)',
        zIndex: 'var(--z-mini-player, 48)',
        overflow: 'hidden',
        display: takeoverActive ? 'none' : 'block',
        pointerEvents: 'all',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
        transition: visible
          ? 'opacity 180ms cubic-bezier(0.4, 0, 1, 1), transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          : 'none',
      }}
    >
      {/* ── 视频区（绝对定位，Expanded 时底部为控制栏让出 44px） ── */}
      <div
        data-testid="mini-player-video-area"
        style={{
          position: 'absolute',
          inset: isExpanded ? '0 0 44px 0' : '0 0 0 0',
          background: 'var(--player-video-area-bg)',
          cursor: shortId ? 'pointer' : 'default',
        }}
      >
        {/* 无播放源占位（HANDOFF-32 接入 video 后替换） */}
        {!shortId && (
          <div
            data-testid="mini-no-source"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--fg-muted)',
              cursor: 'default',
            }}
          >
            暂无可用播放源
          </div>
        )}

        {/* Play/Pause overlay 占位（HANDOFF-32 填充，class="mini-video-overlay"） */}
        <div
          data-testid="mini-player-play-pause"
          className="mini-video-overlay"
          aria-hidden
          style={{ position: 'absolute', inset: 0, display: 'none' }}
        />

        {/* Loading overlay 占位（HANDOFF-32 填充） */}
        <div
          data-testid="mini-loading"
          aria-hidden
          style={{ position: 'absolute', inset: 0, display: 'none' }}
        />

        {/* Error overlay 占位（HANDOFF-32 填充） */}
        <div
          data-testid="mini-error"
          aria-hidden
          style={{ position: 'absolute', inset: 0, display: 'none' }}
        />
      </div>

      {/* ── Header overlay（32px，hover 时显现，UI Contract §2 + §3） ── */}
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
        {/* 返回播放页按钮（UI Contract §3.3） */}
        <button
          type="button"
          data-testid="mini-player-return-btn"
          aria-label="返回播放页"
          aria-disabled={!hostOrigin?.slug}
          tabIndex={headerVisible ? 0 : -1}
          onClick={handleReturnToWatch}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: '28px',
            height: '28px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            cursor: hostOrigin?.slug ? 'pointer' : 'default',
            color: 'var(--player-mini-btn-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: hostOrigin?.slug ? 1 : 0.4,
            pointerEvents: hostOrigin?.slug ? 'auto' : 'none',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--player-mini-btn-hover-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
          </svg>
        </button>

        {/* 标题区（flex-1，单行截断） */}
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

        {/* 展开/折叠按钮（UI Contract §3.3） */}
        <button
          type="button"
          data-testid="mini-player-toggle-expand"
          aria-label={isExpanded ? '折叠' : '展开'}
          aria-expanded={isExpanded}
          tabIndex={headerVisible ? 0 : -1}
          onClick={handleToggleExpand}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: '28px',
            height: '28px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--player-mini-btn-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--player-mini-btn-hover-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {isExpanded
              ? <path d="M18 15l-6-6-6 6" />
              : <path d="M6 9l6 6 6-6" />
            }
          </svg>
        </button>

        {/* 关闭按钮（UI Contract §3.3） */}
        <button
          type="button"
          data-testid="mini-player-close-btn"
          aria-label="关闭播放器"
          tabIndex={headerVisible ? 0 : -1}
          onClick={handleClose}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: '28px',
            height: '28px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--player-mini-btn-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--player-mini-btn-hover-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── 控制栏占位（Expanded 态，HANDOFF-32 填充内容） ── */}
      {isExpanded && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '44px',
            background: 'var(--player-mini-ctrl-bg)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: '8px',
          }}
        >
          {/* Play/Pause 按钮（HANDOFF-32 激活） */}
          <button
            type="button"
            data-testid="mini-player-play-pause"
            aria-label="播放"
            disabled
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '4px',
              background: 'transparent',
              cursor: 'not-allowed',
              opacity: 0.4,
              color: 'var(--player-mini-ctrl-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 4l15 8-15 8V4z" />
            </svg>
          </button>

          {/* 进度条（HANDOFF-32 激活） */}
          <div
            data-testid="mini-player-progress"
            role="slider"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={0}
            aria-valuenow={0}
            aria-valuetext="00:00 / --:--"
            tabIndex={0}
            style={{
              flex: 1,
              height: '4px',
              background: 'var(--player-mini-progress-track)',
              borderRadius: '2px',
              pointerEvents: 'none',
              opacity: 0.4,
            }}
          />

          {/* 时间显示 */}
          <span
            style={{
              fontSize: '11px',
              color: 'var(--player-mini-ctrl-fg)',
              minWidth: '72px',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            00:00 / --:--
          </span>

          {/* 静音按钮（HANDOFF-32 激活） */}
          <button
            type="button"
            data-testid="mini-player-mute"
            aria-label="静音"
            disabled
            style={{
              width: '24px',
              height: '24px',
              border: 'none',
              borderRadius: '4px',
              background: 'transparent',
              cursor: 'not-allowed',
              opacity: 0.4,
              color: 'var(--player-mini-ctrl-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Resize handle（右下角，UI Contract §2.3） ── */}
      <div
        ref={resizeHandleRef}
        data-mini-resize-handle
        data-testid="mini-player-resize-handle"
        aria-label="拖拽调整大小"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '16px',
          height: '16px',
          cursor: 'nwse-resize',
          touchAction: 'none',
          background:
            'linear-gradient(135deg, transparent 0%, transparent 40%, var(--fg-subtle) 40%, var(--fg-subtle) 45%, transparent 45%, transparent 60%, var(--fg-subtle) 60%, var(--fg-subtle) 65%, transparent 65%)',
          zIndex: 3,
        }}
      />
    </div>
  )
}
