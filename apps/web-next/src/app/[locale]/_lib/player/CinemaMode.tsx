'use client'

import { useEffect, useRef } from 'react'

interface CinemaModeProps {
  active: boolean
}

/**
 * 影院模式遮罩：active 时以 600ms 过渡渐暗背景。
 * 绝对定位，pointer-events: none，不拦截播放器控件交互。
 */
export function CinemaMode({ active }: CinemaModeProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = prefersReduced ? 0 : 600

    el.animate(
      [{ opacity: active ? '0' : '1' }, { opacity: active ? '1' : '0' }],
      { duration, easing: 'ease', fill: 'forwards' },
    )
  }, [active])

  return (
    <div
      ref={ref}
      aria-hidden
      data-testid="cinema-mode-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--cinema-overlay-bg)',
        pointerEvents: 'none',
        opacity: 0,
        zIndex: 1,
      }}
    />
  )
}
