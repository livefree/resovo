'use client'

import { useEffect, useState } from 'react'
import { LazyImage } from '@/components/primitives/lazy-image'
import { getLoader } from '@/lib/image/image-loader'
import { FallbackCover } from './FallbackCover'
import type { SafeImageProps } from './types'

export function SafeImage({
  src,
  blurHash,
  aspect,
  fallback,
  fallbackProps,
  onLoadFail,
  onLoadError,
  imageLoader,
  loaderOptions = { format: 'auto' },
  onError,
  ...rest
}: SafeImageProps) {
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  const loader = imageLoader ?? getLoader()

  if (!src || errored) {
    if (fallback !== undefined) return <>{fallback}</>
    return <FallbackCover variant="generic" aspect={aspect} {...fallbackProps} />
  }

  const resolvedSrc = loader(src, loaderOptions ?? {})

  return (
    <LazyImage
      {...rest}
      src={resolvedSrc}
      blurHash={blurHash}
      onError={() => {
        setErrored(true)
        onLoadFail?.({ src, reason: 'network' })
        onLoadError?.({ src, reason: 'network' })
        onError?.()
      }}
    />
  )
}
