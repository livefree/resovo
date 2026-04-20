'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

export interface PrefetchOnHoverProps {
  href: string
  delay?: number
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: none)').matches
}

/**
 * 包裹任意元素，hover 停留 delay ms 后触发 router.prefetch(href)。
 * 移动端（hover: none）不触发，避免 touch 设备误触。
 */
export function PrefetchOnHover({
  href,
  delay = 150,
  children,
  className,
  style,
}: PrefetchOnHoverProps) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefetchedRef = useRef(false)

  const handleMouseEnter = useCallback(() => {
    if (isTouchDevice() || prefetchedRef.current) return
    timerRef.current = setTimeout(() => {
      router.prefetch(href)
      prefetchedRef.current = true
    }, delay)
  }, [href, delay, router])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return (
    <div
      className={className}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  )
}
