'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import {
  MINI_GEOMETRY_CONSTRAINTS,
  MINI_GEOMETRY_DEFAULTS,
  computeDockPosition,
  type MiniGeometryV1,
} from '@/stores/_persist/mini-geometry'
import { attachMiniPlayerDrag, attachViewportResizeWatcher } from '@/lib/mini-player/drag'

/**
 * MiniPlayer — HANDOFF-03 B 站风浮窗播放器（桌面专属）。
 *
 * 交互契约：
 *   - 顶部 32px drag handle：pointer events 手写拖拽 → 松手吸附最近角 260ms spring
 *   - 右下 16×16px resize handle：保持 16:9，240–480px clamp
 *   - 关闭按钮 → closeHost() → hostMode='closed'
 *   - 展开（双击容器非控件区 / click 占位）→ setHostMode('full')
 *   - takeoverActive=true 时 display:none（护栏优先级最高，Storage 协调协议）
 *   - @media (hover:none) and (pointer:coarse) → 移动端 display:none（严格屏蔽 iOS PiP 限制冲突）
 *   - data-mini-video-slot：container 里的占位 slot，由 GlobalPlayerHost 在 full⇄mini 切换时 appendChild <video>
 *
 * 颜色全部走 CSS 变量（player.mini.* tokens 经 tokens.css 映射为 --color-player-mini-*）。
 */
export function MiniPlayer() {
  const shortId = usePlayerStore((s) => s.shortId)
  const geometry = usePlayerStore((s) => s.geometry)
  const takeoverActive = usePlayerStore((s) => s.takeoverActive)
  const setGeometry = usePlayerStore((s) => s.setGeometry)
  const setHostMode = usePlayerStore((s) => s.setHostMode)
  const closeHost = usePlayerStore((s) => s.closeHost)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragHandleRef = useRef<HTMLDivElement | null>(null)
  const resizeHandleRef = useRef<HTMLDivElement | null>(null)
  const videoSlotRef = useRef<HTMLDivElement | null>(null)

  // 保存最新 geometry 的 ref，供 drag.ts 的 getGeometry 回调读取（避免闭包陈旧）
  const geometryRef = useRef<MiniGeometryV1>(geometry ?? MINI_GEOMETRY_DEFAULTS)
  useEffect(() => {
    geometryRef.current = geometry ?? MINI_GEOMETRY_DEFAULTS
  }, [geometry])

  // guard：drag.ts 的 commitGeometry 已经在 drag-end / resize-end 后应用了 spring transition
  // 并直接写入 container.style.left/top/width/height。useLayoutEffect 此时不得再次覆写
  // （否则 transition 会被重置为 'none' 样式，spring 动画被打断）。
  const userInteractingRef = useRef(false)

  const [visible, setVisible] = useState(false)

  // mount 后下一帧 fade in + spring pop-in
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // 浮层规范（ui-rules.md §浮层组件）：Esc 关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHost()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [closeHost])

  // 初次 mount 应用 geometry 到 DOM（left/top/width/height 由 computeDockPosition 计算）
  // guard：若用户正在交互（drag / resize），drag.ts 已在 commit 时写入了带 spring
  // transition 的 style，此处必须跳过，避免覆写 transition 导致 spring 动画中断。
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (userInteractingRef.current) return
    const geom = geometry ?? MINI_GEOMETRY_DEFAULTS
    const vw = window.innerWidth
    const vh = window.innerHeight
    const { left, top } = computeDockPosition(geom, vw, vh)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.width = `${geom.width}px`
    el.style.height = `${geom.height}px`
  }, [geometry])

  // attach pointer events（拖拽 + 缩放 + window.resize 越界 re-snap）
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
      onInteractionChange: (interacting) => {
        userInteractingRef.current = interacting
      },
    })
    const detachResizeWatcher = attachViewportResizeWatcher(container, getGeometry, commitGeometry)

    return () => {
      detachDrag()
      detachResizeWatcher()
    }
  }, [setGeometry])

  function handleExpand() {
    setHostMode('full')
  }

  return (
    <div
      ref={containerRef}
      data-mini-player
      data-testid="mini-player"
      className="mini-player-root"
      style={{
        position: 'fixed',
        // left/top/width/height 由 useLayoutEffect 写入；此处仅给兜底值避免初次闪烁
        left: 0,
        top: 0,
        width: `${MINI_GEOMETRY_DEFAULTS.width}px`,
        height: `${MINI_GEOMETRY_DEFAULTS.height}px`,
        minWidth: `${MINI_GEOMETRY_CONSTRAINTS.MIN_WIDTH}px`,
        maxWidth: `${MINI_GEOMETRY_CONSTRAINTS.MAX_WIDTH}px`,
        aspectRatio: '16 / 9',
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg, 12px)',
        // 使用 player.mini.shadow token（HANDOFF-01 已导出为 --player-mini-shadow）
        boxShadow: 'var(--player-mini-shadow)',
        zIndex: 'var(--z-mini-player, 48)',
        overflow: 'hidden',
        display: takeoverActive ? 'none' : 'flex',
        flexDirection: 'column',
        pointerEvents: 'all',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
        transition: visible
          ? 'opacity 180ms cubic-bezier(0.4, 0, 1, 1), transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          : 'none',
      }}
    >
      {/* 顶部 drag handle（32px 可拖拽区） */}
      <div
        ref={dragHandleRef}
        data-mini-drag-handle
        data-testid="mini-player-drag-handle"
        style={{
          height: '32px',
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          cursor: 'move',
          touchAction: 'none', // 禁止触摸滚动干扰 pointer events
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--fg-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            pointerEvents: 'none',
          }}
        >
          {shortId ? '迷你播放器' : '正在播放'}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="展开播放器"
            title="展开"
            onClick={handleExpand}
            style={{
              width: '24px',
              height: '24px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 3h7v2H5v5H3V3zm18 0v7h-2V5h-5V3h7zM3 21v-7h2v5h5v2H3zm18 0h-7v-2h5v-5h2v7z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="关闭播放器"
            title="关闭"
            onClick={closeHost}
            style={{
              width: '24px',
              height: '24px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 视频 slot：GlobalPlayerHost 在 full⇄mini 切换时把 <video> appendChild 到此容器 */}
      <div
        ref={videoSlotRef}
        data-mini-video-slot
        data-testid="mini-player-video-slot"
        style={{
          flex: 1,
          background: 'var(--bg-surface-sunken)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
          color: 'var(--fg-subtle)',
          fontSize: '0.75rem',
        }}
      >
        {/* 当 video 尚未 appendChild 进来时的占位文案 */}
        {shortId ? '' : '无正在播放的视频'}
      </div>

      {/* 右下 resize handle（16×16px） */}
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
          // 视觉提示：用渐变对角线表达"可调整大小"
          background:
            'linear-gradient(135deg, transparent 0%, transparent 40%, var(--fg-subtle) 40%, var(--fg-subtle) 45%, transparent 45%, transparent 60%, var(--fg-subtle) 60%, var(--fg-subtle) 65%, transparent 65%)',
          zIndex: 1,
        }}
      />
    </div>
  )
}
