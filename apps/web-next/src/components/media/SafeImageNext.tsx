/**
 * SafeImageNext.tsx — CDN-02 过渡期验证面
 *
 * 本组件是 SafeImage `mode='next'` 分支的实装，走 next/image。
 * 用途：
 *   1. 验证 CDN-01 接入的 next.config.ts custom loader（next-image-loader.ts）确实被调用
 *   2. 为未来 Cloudflare Images 接入提供运行时代理证据面
 *   3. 作为 CDN-03 全站迁移（SafeImage 默认切 next）的试点
 *
 * 与 LazyImage 分支（mode='lazy'）的对齐：
 *   - 错误分支继续走 FallbackCover 降级（语义一致）
 *   - 外层保留 aspect-ratio wrapper 保证响应式布局与 LazyImage 等价
 *   - 默认 sizes='100vw'，消费者可 override
 *
 * CDN-02 scope 内不支持：
 *   - blurHash canvas 占位（改用 blurDataURL + placeholder="blur"，若消费者未传则无占位）
 *   - imageLoader / loaderOptions.format per-component override（由 next.config.ts 全局 loader 接管）
 *     dev 环境侦测到 imageLoader 传入会 console.warn
 *
 * CDN-03 合并后，本文件与 SafeImage 的 mode switch 可简化为单一路径。
 */

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FallbackCover } from './FallbackCover'
import type { MediaAspect, SafeImageProps } from './types'
import { clientLogger } from '@/lib/logger.client'

// ── aspect 字符串 → CSS aspect-ratio 值 ───────────────────────────
const ASPECT_RATIO_MAP: Record<MediaAspect, string> = {
  '2:3':  '2 / 3',
  '16:9': '16 / 9',
  '1:1':  '1 / 1',
  '5:6':  '5 / 6',
  '21:9': '21 / 9',
}

function resolveAspectRatio(
  aspect: MediaAspect | undefined,
  width: number | undefined,
  height: number | undefined,
): string | undefined {
  if (aspect) return ASPECT_RATIO_MAP[aspect]
  if (width && height) return `${width} / ${height}`
  return undefined
}

export function SafeImageNext({
  src,
  blurDataURL,
  blurHash: _blurHash,
  aspect,
  fallback,
  onLoadFail,
  onLoadError,
  imageLoader,
  loaderOptions,
  onError,
  width,
  height,
  alt,
  priority,
  className,
  imgClassName,
  style,
  sizes = '100vw',
  mode: _mode,
  'data-testid': dataTestId,
  ...rest
}: SafeImageProps) {
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  // dev 环境警告：imageLoader prop 在 next 模式下不生效
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && imageLoader) {
      clientLogger.warn(
        "[SafeImage] imageLoader prop is ignored when mode='next'; use next.config.ts loaderFile instead.",
      )
    }
  }, [imageLoader])

  if (!src || errored) {
    return <FallbackCover variant="generic" aspect={aspect} {...(fallback ?? {})} />
  }

  const aspectRatio = resolveAspectRatio(aspect, width, height)

  // next/image 的 quality prop 接 1-100
  const quality = loaderOptions?.quality

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        aspectRatio,
        ...style,
      }}
      data-testid={dataTestId}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={quality}
        placeholder={blurDataURL ? 'blur' : undefined}
        blurDataURL={blurDataURL}
        className={imgClassName}
        style={{
          objectFit: 'cover',
        }}
        onError={() => {
          setErrored(true)
          onLoadFail?.({ src, reason: 'network' })
          onLoadError?.({ src, reason: 'network' })
          onError?.()
        }}
        {...rest}
      />
    </div>
  )
}
