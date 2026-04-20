'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PageTransitionProps } from './types'

function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const getSnapshot = () =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false

  const subscribe = (cb: () => void) => {
    if (typeof window === 'undefined') return () => {}
    const mql = window.matchMedia(query)
    mql.addEventListener('change', cb)
    return () => mql.removeEventListener('change', cb)
  }

  // SSR-safe inline useSyncExternalStore pattern via ref
  const valueRef = useRef(false)
  useEffect(() => {
    valueRef.current = getSnapshot()
    const unsub = subscribe(() => {
      valueRef.current = getSnapshot()
    })
    return unsub
  }, [])

  return valueRef.current
}

export function PageTransitionController({
  transitionKey,
  disabled,
  children,
}: PageTransitionProps) {
  const prevKeyRef = useRef(transitionKey)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    if (prevKeyRef.current === transitionKey) return
    prevKeyRef.current = transitionKey

    if (disabled) return

    const supportsVT =
      typeof document !== 'undefined' &&
      typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function'

    if (reducedMotion || !supportsVT) {
      if (reducedMotion && typeof document !== 'undefined') {
        document.documentElement.classList.add('vt-reduced')
        const timer = setTimeout(() => {
          document.documentElement.classList.remove('vt-reduced')
        }, 100)
        return () => clearTimeout(timer)
      }
      return
    }

    // React commit 已完成，触发 View Transitions crossfade
    ;(document as Document & { startViewTransition: (cb: () => Promise<void>) => void })
      .startViewTransition(() => Promise.resolve())
  }, [transitionKey, disabled, reducedMotion])

  return <>{children}</>
}
