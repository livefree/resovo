'use client'

import { useEffect, useLayoutEffect, type RefObject } from 'react'
import { consumeSnapshot } from '@/components/primitives/shared-element/registry'

// SSR-safe: useLayoutEffect on client (measures before paint), useEffect on server (no-op)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Runs a FLIP animation from a previously-captured snapshot to the element's
 * current position. Must be called inside a 'use client' component.
 *
 * Primary snapshot path: captureSnapshot() called on navigation intent.
 * Returns an Animation cancel function as cleanup to avoid stale animations
 * on quick navigation back-and-forth.
 */
export function useFLIP(id: string, elementRef: RefObject<HTMLElement | null>): void {
  useIsoLayoutEffect(() => {
    const el = elementRef.current
    if (!el) return

    const snap = consumeSnapshot(id)
    if (!snap) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const last = el.getBoundingClientRect()

    if (prefersReduced) {
      // Reduced-motion fallback: opacity 0 → 1 over 120ms, no transform
      const anim = el.animate(
        [{ opacity: '0' }, { opacity: '1' }],
        { duration: 120, easing: 'linear', fill: 'backwards' },
      )
      return () => { anim.cancel() }
    }

    const dx = snap.rect.left - last.left
    const dy = snap.rect.top - last.top
    const sx = last.width === 0 ? 1 : snap.rect.width / last.width
    const sy = last.height === 0 ? 1 : snap.rect.height / last.height

    // fill:'backwards' applies the first keyframe before the first paint,
    // preventing the 1-frame flash of the element at its final position.
    const anim = el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: '0 0',
        },
        {
          transform: 'translate(0,0) scale(1,1)',
          transformOrigin: '0 0',
        },
      ],
      { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' },
    )

    return () => { anim.cancel() }
    // id and elementRef.current are stable per component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
}
