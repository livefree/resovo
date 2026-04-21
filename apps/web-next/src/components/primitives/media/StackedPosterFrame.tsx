'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SafeImage } from '@/components/media'
import type { SafeImageProps } from '@/components/media/types'

export interface StackedPosterFrameProps
  extends Omit<SafeImageProps, 'className' | 'imgClassName'> {
  stackLevel: 0 | 1
  className?: string
}

function layerTransition(delayMs: number, isEntering: boolean): string {
  if (isEntering) {
    return [
      `transform var(--stack-transition-duration) cubic-bezier(0.4,0,0.2,1) ${delayMs}ms`,
      `opacity var(--stack-transition-duration) ease ${delayMs}ms`,
    ].join(', ')
  }
  return [
    'transform var(--stack-transition-duration-reverse) cubic-bezier(0.4,0,0.2,1)',
    'opacity var(--stack-transition-duration-reverse) ease',
  ].join(', ')
}

export function StackedPosterFrame({
  stackLevel,
  className,
  ...imageProps
}: StackedPosterFrameProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [prefersReduced, setPrefersReduced] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPrefersReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleMouseEnter() {
    debounceRef.current = setTimeout(() => setIsHovered(true), 30)
  }

  function handleMouseLeave() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setIsHovered(false)
  }

  const hasStack = stackLevel > 0
  const animated = isHovered && !prefersReduced

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Shadow layers — visual only, no images */}
      {hasStack && (
        <>
          {/* Layer 2: furthest back, delay 160ms on enter */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              background: 'var(--stack-layer-2-bg)',
              transform: animated
                ? 'translate(var(--stack-layer-2-hover-offset-x), var(--stack-layer-2-hover-offset-y))'
                : 'translate(var(--stack-layer-2-offset-x), var(--stack-layer-2-offset-y))',
              opacity: isHovered
                ? 'var(--stack-layer-2-hover-opacity)'
                : 'var(--stack-layer-2-opacity)',
              transition: layerTransition(160, isHovered),
              zIndex: 1,
            }}
          />
          {/* Layer 1: closer to viewer, delay 80ms on enter */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              background: 'var(--stack-layer-1-bg)',
              transform: animated
                ? 'translate(var(--stack-layer-1-hover-offset-x), var(--stack-layer-1-hover-offset-y))'
                : 'translate(var(--stack-layer-1-offset-x), var(--stack-layer-1-offset-y))',
              opacity: isHovered
                ? 'var(--stack-layer-1-hover-opacity)'
                : 'var(--stack-layer-1-opacity)',
              transition: layerTransition(80, isHovered),
              zIndex: 2,
            }}
          />
        </>
      )}

      {/* Main image — overflow-hidden clips to rounded corners */}
      <div className="relative overflow-hidden rounded-lg" style={{ zIndex: 3 }}>
        <SafeImage
          {...imageProps}
          className="pointer-events-none"
          imgClassName={cn(
            'transition-transform pointer-events-none',
            animated ? 'scale-[1.03]' : 'scale-100',
          )}
          style={{
            transitionDuration: isHovered
              ? 'var(--stack-transition-duration)'
              : 'var(--stack-transition-duration-reverse)',
          }}
        />
      </div>
    </div>
  )
}
