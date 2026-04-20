'use client'

import { useEffect, useState } from 'react'
import { LazyImage } from '@/components/primitives/lazy-image'
import { buildImageUrl } from '@/lib/image/image-loader'
import { FallbackCover } from './FallbackCover'
import type { SafeImageProps } from './types'

export function SafeImage({
  src,
  blurHash,
  fallback,
  fallbackProps,
  onLoadError,
  imageLoader = buildImageUrl,
  loaderOptions = { format: 'auto' },
  onError,
  ...rest
}: SafeImageProps) {
  const [errored, setErrored] = useState(false)

  // src 变化时重置错误状态（避免永久降级）
  useEffect(() => {
    setErrored(false)
  }, [src])

  if (!src || errored) {
    if (!src) {
      onLoadError?.({ src: src ?? '', reason: 'empty-src' })
    }
    if (fallback !== undefined) return <>{fallback}</>
    return <FallbackCover variant="generic" {...fallbackProps} />
  }

  const resolvedSrc = imageLoader(src, loaderOptions)

  return (
    <LazyImage
      {...rest}
      src={resolvedSrc}
      blurHash={blurHash}
      onError={() => {
        setErrored(true)
        onLoadError?.({ src, reason: 'network' })
        onError?.()
      }}
    />
  )
}
