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
import { useMiniPlayerVideo } from './useMiniPlayerVideo'
import { MiniPlayerHeader } from './MiniPlayerHeader'
import { MiniPlayerControls } from './MiniPlayerControls'

/**
 * MiniPlayer — HANDOFF-32 视频交互核心层
 *
 * 几何模型（UI Contract §2）：
 *   - 容器 position: fixed，overflow: hidden，所有子元素绝对定位
 *   - Collapsed：height = videoH（= width × 9/16）
 *   - Expanded：height = videoH + 44px（控制栏）
 *
 * 视频逻辑由 useMiniPlayerVideo 钩子封装；Header/Controls 已拆为子组件。
 */
export function MiniPlayer() {
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? 'zh-CN'

  const shortId = usePlayerStore((s) => s.shortId)
  const hostOrigin = usePlayerStore((s) => s.hostOrigin)
  const geometry = usePlayerStore((s) => s.geometry)
  const takeoverActive = usePlayerStore((s) => s.takeoverActive)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const setGeometry = usePlayerStore((s) => s.setGeometry)
  const releaseMiniPlayer = usePlayerStore((s) => s.releaseMiniPlayer)

  const [isExpanded, setIsExpanded] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(false)
  const [visible, setVisible] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragHandleRef = useRef<HTMLDivElement | null>(null)
  const resizeHandleRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const geometryRef = useRef<MiniGeometryV1>(geometry ?? MINI_GEOMETRY_DEFAULTS)
  useEffect(() => {
    geometryRef.current = geometry ?? MINI_GEOMETRY_DEFAULTS
  }, [geometry])

  const userInteractingRef = useRef(false)
  const headerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoPointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const seekingRef = useRef(false)

  // mount 后下一帧 fade in
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Video logic hook ────────────────────────────────────────────
  const {
    activeSrc,
    videoStatus,
    isMuted,
    localCurrentTime,
    localDuration,
    handleToggleMute,
    handleTogglePlay,
    handleVideoCanPlay,
    handleVideoPlay,
    handleVideoPause,
    handleVideoError,
    handleVideoTimeUpdate,
    handleVideoLoadedMetadata,
    handleAutoplayBlockedClick,
  } = useMiniPlayerVideo(videoRef)

  const handleClose = useCallback(() => {
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.src = ''
    releaseMiniPlayer()
  }, [releaseMiniPlayer])

  // 移动端防护（UI Contract §13.6）
  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)')
    if (mq.matches) { handleClose(); return }
    const handler = (e: MediaQueryListEvent) => { if (e.matches) handleClose() }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [handleClose])

  // Esc 关闭 + m 键静音（UI Contract §9.2）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { handleClose(); return }
      if (e.key === 'm' || e.key === 'M') handleToggleMute()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handleClose, handleToggleMute])

  // 应用 geometry + isExpanded 到 DOM
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
    return () => { detachDrag(); detachResizeWatcher() }
  }, [setGeometry])

  function handleReturnToWatch() {
    if (hostOrigin?.slug) router.push(`/${locale}/watch/${hostOrigin.slug}`)
  }

  function handleToggleExpand() {
    setIsExpanded((prev) => !prev)
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

  // ── Video area click-vs-drag discrimination (UI Contract §4.3) ─
  function handleVideoAreaPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    videoPointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }

  function handleVideoAreaPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const pd = videoPointerDownRef.current
    videoPointerDownRef.current = null
    if (!pd) return
    const dx = e.clientX - pd.x
    const dy = e.clientY - pd.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 5 && Date.now() - pd.time < 300) {
      if (videoStatus === 'autoplay-blocked') {
        handleAutoplayBlockedClick()
      } else {
        handleTogglePlay()
      }
    }
  }

  // ── Progress bar seek handlers ──────────────────────────────────
  function seekFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const video = videoRef.current
    const el = e.currentTarget
    if (!video || isNaN(video.duration) || video.duration === 0) return
    const rect = el.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.currentTime = fraction * video.duration
  }

  function handleProgressPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    seekingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seekFromPointer(e)
  }

  function handleProgressPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!seekingRef.current) return
    seekFromPointer(e)
  }

  function handleProgressPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!seekingRef.current) return
    seekingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    seekFromPointer(e)
  }

  function handleProgressKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const video = videoRef.current
    if (!video || isNaN(video.duration)) return
    if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5)
    else if (e.key === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 5)
    else if (e.key === 'Home') video.currentTime = 0
    else if (e.key === 'End') video.currentTime = video.duration
    else return
    e.preventDefault()
  }

  const geom = geometry ?? MINI_GEOMETRY_DEFAULTS
  const videoH = deriveHeightFromWidth(geom.width)

  // Overlay rendering logic
  const showNoSrc = videoStatus === 'no-src'
  const showLoading = videoStatus === 'loading'
  const showError = videoStatus === 'error'
  const showAutoplayBlocked = videoStatus === 'autoplay-blocked'
  const showPauseOverlay = !showNoSrc && !showLoading && !showError && !showAutoplayBlocked && !isPlaying
  const showPlayingOverlay = !showNoSrc && !showLoading && !showError && !showAutoplayBlocked && isPlaying && headerVisible

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
        zIndex: 'var(--z-mini-player)',
        overflow: 'hidden',
        display: takeoverActive ? 'none' : 'block',
        pointerEvents: 'all',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
        transition: visible
          ? 'opacity 180ms cubic-bezier(0.4,0,1,1), transform 240ms cubic-bezier(0.34,1.56,0.64,1)'
          : 'none',
      }}
    >
      {/* ── 视频区（绝对定位） ────────────────────────────────── */}
      <div
        data-testid="mini-player-video-area"
        onPointerDown={handleVideoAreaPointerDown}
        onPointerUp={handleVideoAreaPointerUp}
        style={{
          position: 'absolute',
          inset: isExpanded ? '0 0 44px 0' : '0 0 0 0',
          background: 'var(--player-video-area-bg)',
          cursor: !showNoSrc ? 'pointer' : 'default',
        }}
      >
        {/* 真实 video 元素（UI Contract §4.1） */}
        {activeSrc && (
          <video
            ref={videoRef}
            onCanPlay={handleVideoCanPlay}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onError={handleVideoError}
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedMetadata={handleVideoLoadedMetadata}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            playsInline
          />
        )}

        {/* 无播放源 */}
        {showNoSrc && (
          <div
            data-testid="mini-no-source"
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--fg-muted)', cursor: 'default' }}
          >
            暂无可用播放源
          </div>
        )}

        {/* 加载中 */}
        <div
          data-testid="mini-loading"
          aria-hidden={!showLoading}
          style={{ position: 'absolute', inset: 0, display: showLoading ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--player-mini-overlay-icon)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>

        {/* 播放错误 */}
        <div
          data-testid="mini-error"
          aria-hidden={!showError}
          style={{ position: 'absolute', inset: 0, display: showError ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--player-mini-danger-fg)' }} aria-hidden>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>播放失败</span>
        </div>

        {/* Autoplay blocked */}
        {showAutoplayBlocked && (
          <div
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--player-mini-overlay-bg)' }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="var(--player-mini-overlay-icon)" aria-hidden>
              <path d="M6 4l15 8-15 8V4z" />
            </svg>
            <span style={{ fontSize: '10px', color: 'var(--fg-muted)' }}>点击播放</span>
          </div>
        )}

        {/* Play/Pause overlay（UI Contract §4.2） */}
        <div
          data-testid="mini-play-overlay"
          className="mini-video-overlay"
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: (showPauseOverlay || showPlayingOverlay) ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--player-mini-overlay-bg)',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="var(--player-mini-overlay-icon)" aria-hidden>
            {showPauseOverlay
              ? <path d="M6 4l15 8-15 8V4z" />
              : <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>
            }
          </svg>
        </div>
      </div>

      {/* ── Header overlay ───────────────────────────────────── */}
      <MiniPlayerHeader
        dragHandleRef={dragHandleRef}
        headerVisible={headerVisible}
        isExpanded={isExpanded}
        shortId={shortId}
        hostOrigin={hostOrigin}
        onReturnToWatch={handleReturnToWatch}
        onToggleExpand={handleToggleExpand}
        onClose={handleClose}
      />

      {/* ── Controls bar（Expanded 态） ───────────────────────── */}
      {isExpanded && (
        <MiniPlayerControls
          isPlaying={isPlaying}
          localCurrentTime={localCurrentTime}
          localDuration={localDuration}
          isMuted={isMuted}
          videoStatus={videoStatus}
          onTogglePlay={handleTogglePlay}
          onToggleMute={handleToggleMute}
          onProgressPointerDown={handleProgressPointerDown}
          onProgressPointerMove={handleProgressPointerMove}
          onProgressPointerUp={handleProgressPointerUp}
          onProgressKeyDown={handleProgressKeyDown}
        />
      )}

      {/* ── Resize handle ───────────────────────────────────── */}
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
