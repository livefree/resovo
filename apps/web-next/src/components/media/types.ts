import type { ImageLoader, ImageLoaderOptions } from '@/lib/image/image-loader'
import type { LazyImageProps } from '@/components/primitives/lazy-image'
import type { VideoType } from '@resovo/types'

export type MediaAspect = '2:3' | '16:9' | '1:1' | '5:6' | '21:9'
export type FallbackVariant = 'poster' | 'still' | 'avatar' | 'generic'
export type ImageLoadFailReason = 'network' | 'decode'

export interface ImageLoadFailPayload {
  src: string
  reason: ImageLoadFailReason
}

export interface FallbackCoverProps {
  aspect?: MediaAspect
  /** @deprecated use aspect */
  aspectRatio?: string
  width?: number | string
  height?: number | string
  className?: string
  ariaLabel?: string
  iconScale?: number
  variant?: FallbackVariant
  title?: string
  originalTitle?: string
  type?: VideoType
  seed?: string
  /** 品牌单色 Logo URL；有值时在右下角渲染 <img>，无值时回落到 CSS --brand-initial 文字角标 */
  brandLogoUrl?: string
  'data-testid'?: string
}

export interface SafeImageProps extends Omit<LazyImageProps, 'blurHash' | 'src'> {
  src: string | undefined | null
  blurHash?: LazyImageProps['blurHash']
  aspect?: MediaAspect
  /** 结构化降级数据，传给 FallbackCover；典型用法：fallback={{ title, type, seed: video.id }} */
  fallback?: Omit<FallbackCoverProps, 'className'>
  onLoadFail?: (payload: ImageLoadFailPayload) => void
  /** @deprecated use onLoadFail */
  onLoadError?: (err: { src: string; reason: 'network' | 'empty-src' }) => void
  imageLoader?: ImageLoader
  loaderOptions?: ImageLoaderOptions
}
