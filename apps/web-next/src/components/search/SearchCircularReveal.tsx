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
const ORIGIN_KEY = 'resovo:search-reveal-origin'

function readStoredOrigin(): { x: string; y: string } | null {
  try {
    const raw = sessionStorage.getItem(ORIGIN_KEY)
    if (!raw) return null
    sessionStorage.removeItem(ORIGIN_KEY)
    const parsed = JSON.parse(raw) as { x: number; y: number }
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: `${parsed.x}px`, y: `${parsed.y}px` }
    }
    return null
  } catch {
    return null
  }
}

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

    // 读取 Nav 存储的实际搜索框坐标，降级到 prop 默认值
    const stored = readStoredOrigin()
    const ox = stored?.x ?? originX
    const oy = stored?.y ?? originY

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
        { clipPath: `circle(0% at ${ox} ${oy})` },
        { clipPath: `circle(150% at ${ox} ${oy})` },
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
