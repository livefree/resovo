'use client'

import { useEffect, useRef } from 'react'

interface KenBurnsLayerProps {
  /** 0 = 向右放大，1 = 向左放大（交替方向） */
  direction?: 0 | 1
  /** 动画总时长，默认 6000ms */
  duration?: number
  children: React.ReactNode
}

/**
 * Ken Burns 缓慢缩放平移效果包裹层。
 * 每次 direction 变化时重新触发动画（slide 切换场景）。
 * prefers-reduced-motion → 静止无动效。
 */
export function KenBurnsLayer({ direction = 0, duration = 6000, children }: KenBurnsLayerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const fromX = direction === 0 ? '-1%' : '1%'
    const toX = direction === 0 ? '1%' : '-1%'

    const anim = el.animate(
      [
        { transform: `scale(1.0) translate(${fromX}, -0.5%)` },
        { transform: `scale(1.08) translate(${toX}, 0.5%)` },
      ],
      { duration, easing: 'linear', fill: 'forwards' },
    )

    return () => { anim.cancel() }
  }, [direction, duration])

  return (
    <div
      ref={ref}
      className="absolute inset-0 will-change-transform"
      style={{ transformOrigin: 'center center' }}
    >
      {children}
    </div>
  )
}
