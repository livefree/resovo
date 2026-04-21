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

// Hard box-shadow (blur=0) simulates stacked card edges — no extra DOM nodes
function buildShadow(hovered: boolean, reduced: boolean): string {
  const useHover = hovered && !reduced
  const l1x = useHover ? 'var(--stack-layer-1-hover-offset-x)' : 'var(--stack-layer-1-offset-x)'
  const l1y = useHover ? 'var(--stack-layer-1-hover-offset-y)' : 'var(--stack-layer-1-offset-y)'
  const l2x = useHover ? 'var(--stack-layer-2-hover-offset-x)' : 'var(--stack-layer-2-offset-x)'
  const l2y = useHover ? 'var(--stack-layer-2-hover-offset-y)' : 'var(--stack-layer-2-offset-y)'
  return [
    `${l1x} ${l1y} 0 0 var(--stack-layer-1-bg)`,
    `${l2x} ${l2y} 0 0 var(--stack-layer-2-bg)`,
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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
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

  // reduced-motion: transition: none — shadow + scale snap to final state instantly
  const wrapperTransition = prefersReduced
    ? 'none'
    : isHovered
      ? 'box-shadow var(--stack-transition-duration) cubic-bezier(0.4,0,0.2,1)'
      : 'box-shadow var(--stack-transition-duration-reverse) cubic-bezier(0.4,0,0.2,1)'

  return (
    <div
      className={cn('relative overflow-hidden rounded-lg', className)}
      style={{
        boxShadow: hasStack ? buildShadow(isHovered, prefersReduced) : undefined,
        transition: wrapperTransition,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SafeImage
        {...imageProps}
        className="pointer-events-none"
        imgClassName={cn(
          'pointer-events-none',
          !prefersReduced && 'transition-transform',
          animated ? 'scale-[1.03]' : 'scale-100',
        )}
        style={{
          transitionDuration: prefersReduced
            ? '0ms'
            : isHovered
              ? 'var(--stack-transition-duration)'
              : 'var(--stack-transition-duration-reverse)',
        }}
      />
    </div>
  )
}
