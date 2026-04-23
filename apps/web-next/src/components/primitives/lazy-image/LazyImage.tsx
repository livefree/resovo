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
  const imgRef = useRef<HTMLImageElement>(null)

  // src 变化时复位 loaded（否则切 banner 图片会残留旧 loaded=true）
  useEffect(() => {
    setLoaded(false)
  }, [src])

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

  // 补救 React 经典 race：img 在 ref 绑定前已完成加载（缓存 / 快速网络 / hydration）
  // 导致 onLoad 事件错过 → loaded 永远 false → opacity:0 → 图片"不显示"但 Network 200。
  // 挂载后主动检查 img.complete 和 naturalWidth，若已加载则补触发 setLoaded(true)。
  useEffect(() => {
    if (!inView) return
    const img = imgRef.current
    if (!img) return
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true)
      onLoad?.()
    }
  }, [inView, src, onLoad])

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
          ref={imgRef}
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
