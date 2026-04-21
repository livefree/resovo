'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface SearchCircularRevealProps {
  children: ReactNode
  /** 动画起始 x 坐标（px），默认 calc(100% - 48px) ≈ 搜索图标位置 */
  originX?: string
  /** 动画起始 y 坐标（px），默认 40px ≈ Header 搜索图标中心 */
  originY?: string
}

/**
 * 全屏搜索页圆形扩散入场动效（§9.x）。
 * - 桌面端：clip-path circle 从搜索图标位置扩散，250ms
 * - reduced-motion：opacity 0→1，150ms
 * - 服务端渲染时内容正常显示（无动画），避免 hydration 闪烁
 */
export function SearchCircularReveal({
  children,
  originX = 'calc(100% - 48px)',
  originY = '40px',
}: SearchCircularRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const el = containerRef.current
    if (!el) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const supportsClipPath = CSS.supports('clip-path', `circle(0% at 0 0)`)

    if (prefersReducedMotion || !supportsClipPath) {
      el.animate([{ opacity: '0' }, { opacity: '1' }], {
        duration: 150,
        easing: 'ease-out',
        fill: 'forwards',
      })
      return
    }

    el.animate(
      [
        { clipPath: `circle(0% at ${originX} ${originY})` },
        { clipPath: `circle(150% at ${originX} ${originY})` },
      ],
      {
        duration: 250,
        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
        fill: 'forwards',
      }
    )
  }, [mounted, originX, originY])

  return (
    <div ref={containerRef} style={{ willChange: mounted ? 'clip-path' : undefined }}>
      {children}
    </div>
  )
}
