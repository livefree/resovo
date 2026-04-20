'use client'

import { useEffect, useRef, useState } from 'react'
import { BlurHashCanvas } from './BlurHashCanvas'
import type { LazyImageProps } from './types'

export function LazyImage({
  src,
  alt,
  width,
  height,
  blurHash,
  priority = false,
  className,
  imgClassName,
  style,
  onLoad,
  onError,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(priority)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (priority) return

    const el = wrapperRef.current
    if (!el) return

    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [priority])

  const aspectRatio = `${width} / ${height}`

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', aspectRatio, ...style }}
    >
      {/* 占位层：blurHash canvas 或纯色背景 */}
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: blurHash ? undefined : 'var(--bg-surface)',
          }}
          aria-hidden
        >
          {blurHash && (
            <BlurHashCanvas
              hash={blurHash}
              width={Math.min(width, 32)}
              height={Math.min(height, 32)}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      {/* 真实图片，仅在进入视口后渲染 src */}
      {inView && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={imgClassName}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity var(--transition-page) var(--ease-page)',
          }}
          onLoad={() => {
            setLoaded(true)
            onLoad?.()
          }}
          onError={onError}
        />
      )}
    </div>
  )
}
