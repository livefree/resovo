'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayerStore } from '@/stores/playerStore'

const EDGE_THRESHOLD_PX = 20
const DISTANCE_RATIO = 0.3
const VELOCITY_THRESHOLD = 0.5 // px/ms

export interface EdgeSwipeBackOptions {
  /** Reverse animation duration in ms (default: 240) */
  animationDuration?: number
  /** Whether to disable the gesture entirely */
  disabled?: boolean
}

export function useEdgeSwipeBack(
  containerRef: React.RefObject<HTMLElement | null>,
  options: EdgeSwipeBackOptions = {},
): void {
  const { animationDuration = 240, disabled = false } = options
  const router = useRouter()
  const hostMode = usePlayerStore((s) => s.hostMode)

  const swipeState = useRef<{
    active: boolean
    startX: number
    startY: number
    startTime: number
    lastX: number
    lastTime: number
  } | null>(null)

  const prefersReduced = useRef(false)

  // Check reduced-motion once on mount
  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const goBack = useCallback(() => {
    router.back()
  }, [router])

  const runReverseAnimation = useCallback(
    (el: HTMLElement) => {
      if (prefersReduced.current) return
      el.animate(
        [
          { transform: 'translateX(30%)' },
          { transform: 'translateX(0)' },
        ],
        {
          duration: animationDuration,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
          fill: 'backwards',
        },
      )
    },
    [animationDuration],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Only listen on touch devices — @media (hover: none) equivalent
    if (!window.matchMedia('(hover: none)').matches) return

    // GlobalPlayerHost full state: disable gesture
    if (hostMode === 'full') return

    if (disabled) return

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      if (!touch) return
      if (touch.clientX > EDGE_THRESHOLD_PX) return

      swipeState.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
        lastX: touch.clientX,
        lastTime: performance.now(),
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!swipeState.current?.active) return
      const touch = e.touches[0]
      if (!touch) return

      const now = performance.now()
      swipeState.current.lastX = touch.clientX
      swipeState.current.lastTime = now
    }

    function handleTouchEnd() {
      const state = swipeState.current
      if (!state?.active) return
      swipeState.current = null

      const dx = state.lastX - state.startX
      const dt = state.lastTime - state.startTime
      if (dx <= 0 || dt <= 0) return

      const velocity = dx / dt
      const screenRatio = dx / window.innerWidth
      const triggered = screenRatio >= DISTANCE_RATIO || velocity >= VELOCITY_THRESHOLD

      if (!triggered) return

      const container = containerRef.current
      if (container) runReverseAnimation(container)
      // Small delay lets animation start before route change
      setTimeout(goBack, prefersReduced.current ? 0 : 16)
    }

    function handleTouchCancel() {
      swipeState.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [containerRef, disabled, goBack, hostMode, runReverseAnimation])
}
