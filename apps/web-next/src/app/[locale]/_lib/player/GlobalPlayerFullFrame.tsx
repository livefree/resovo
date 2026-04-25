'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
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
  const setTakeoverActive = usePlayerStore((s) => s.setTakeoverActive)
  const mode = usePlayerStore((s) => s.mode)
  const flipOrigin = usePlayerStore((s) => s.flipOrigin)
  const setFlipOrigin = usePlayerStore((s) => s.setFlipOrigin)
  const frameRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const isWatchPage = /\/watch\//.test(pathname)

  // FLIP 动画：mini → full 切换时从 mini 容器位置展开
  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el || !flipOrigin) return
    const targetRect = el.getBoundingClientRect()
    const scaleX = flipOrigin.width / targetRect.width
    const scaleY = flipOrigin.height / targetRect.height
    const originCX = flipOrigin.left + flipOrigin.width / 2
    const originCY = flipOrigin.top + flipOrigin.height / 2
    const targetCX = targetRect.left + targetRect.width / 2
    const targetCY = targetRect.top + targetRect.height / 2
    const dx = originCX - targetCX
    const dy = originCY - targetCY

    el.style.transformOrigin = 'center center'
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`
    el.style.transition = 'none'
    setFlipOrigin(null)

    const rafId = requestAnimationFrame(() => {
      void el.offsetWidth  // force reflow so initial transform is painted
      el.style.transition = 'transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      el.style.transform = 'none'
      el.addEventListener('transitionend', () => {
        el.style.transform = ''
        el.style.transition = ''
        el.style.transformOrigin = ''
      }, { once: true })
    })
    return () => {
      cancelAnimationFrame(rafId)
      el.style.transform = ''
      el.style.transition = ''
      el.style.transformOrigin = ''
    }
  }, [flipOrigin, setFlipOrigin])

  useEffect(() => {
    if (!frameRef.current) return
    if (transition === 'fast-takeover' || transition === 'standard-takeover') {
      // HANDOFF-03 Takeover 护栏：动画期间 MiniPlayer display:none，防止 z-index 冲突。
      setTakeoverActive(true)
      const anim =
        transition === 'fast-takeover'
          ? applyFastTakeoverEntry(frameRef.current)
          : applyStandardTakeoverEntry(frameRef.current)
      anim.onfinish = () => {
        setTakeoverActive(false)
        usePlayerStore.setState({ transition: null })
      }
      return () => {
        anim.cancel()
        setTakeoverActive(false)
        usePlayerStore.setState({ transition: null })
      }
    }
  }, [transition, setTakeoverActive])

  if (!isHydrated || !hostOrigin?.slug) return null
  // Watch 页面由 WatchPage 内嵌 PlayerShell 负责渲染，此处返回 null 避免 fixed 覆盖层遮挡 Nav/Footer
  if (isWatchPage) return null

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
        zIndex: 'var(--z-full-player)',
        background: 'var(--bg-canvas)',
        overflowY: 'auto',
        pointerEvents: 'all',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 控制栏：watch 页面内嵌显示时隐藏，其余页面显示 minimize/close */}
      {!isWatchPage && (
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
            onClick={() => closeHost()}
            style={btnStyle}
          >
            ✕
          </button>
        </div>
      )}

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
