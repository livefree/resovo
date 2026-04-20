import type { ImageLoader, ImageLoaderOptions } from '@/lib/image/image-loader'
import type { LazyImageProps } from '@/components/primitives/lazy-image'

export interface FallbackCoverProps {
  aspectRatio?: string
  width?: number | string
  height?: number | string
  className?: string
  ariaLabel?: string
  iconScale?: number
  variant?: 'poster' | 'still' | 'avatar' | 'generic'
  'data-testid'?: string
}

export interface SafeImageProps extends Omit<LazyImageProps, 'blurHash' | 'src'> {
  src: string | undefined | null
  blurHash?: LazyImageProps['blurHash']
  fallback?: React.ReactNode
  fallbackProps?: Omit<FallbackCoverProps, 'className'>
  onLoadError?: (err: { src: string; reason: 'network' | 'empty-src' }) => void
  imageLoader?: ImageLoader
  loaderOptions?: ImageLoaderOptions
}
