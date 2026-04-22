'use client'

import { useEffect, useState } from 'react'
import { LazyImage } from '@/components/primitives/lazy-image'
import { getLoader } from '@/lib/image/image-loader'
import { FallbackCover } from './FallbackCover'
import { SafeImageNext } from './SafeImageNext'
import type { SafeImageProps } from './types'

export function SafeImage(props: SafeImageProps) {
  // CDN-02: mode='next' 分派到 SafeImageNext（next/image + fill + aspect wrapper）
  if (props.mode === 'next') {
    return <SafeImageNext {...props} />
  }
  return <SafeImageLazy {...props} />
}

function SafeImageLazy({
  src,
  blurHash,
  aspect,
  fallback,
  onLoadFail,
  onLoadError,
  imageLoader,
  loaderOptions = { format: 'auto' },
  onError,
  blurDataURL: _blurDataURL,
  mode: _mode,
  sizes: _sizes,
  ...rest
}: SafeImageProps) {
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  const loader = imageLoader ?? getLoader()

  if (!src || errored) {
    return <FallbackCover variant="generic" aspect={aspect} {...(fallback ?? {})} />
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
