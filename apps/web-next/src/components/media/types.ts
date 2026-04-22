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

/**
 * SafeImage 渲染模式（CDN-02）：
 * - 'lazy'（默认）：LazyImage + 原生 <img> + IntersectionObserver + blurHash canvas 占位
 * - 'next'：next/image + fill + 外层 aspect wrapper + blurDataURL 占位
 *   （过渡期试点，验证 CDN loader 挂接；CDN-03 全站迁移后本分派点将简化）
 */
export type SafeImageMode = 'lazy' | 'next'

export interface SafeImageProps extends Omit<LazyImageProps, 'blurHash' | 'src'> {
  src: string | undefined | null
  blurHash?: LazyImageProps['blurHash']
  /** CDN-02: next/image placeholder="blur" 的 base64 dataURL；仅 mode='next' 消费 */
  blurDataURL?: string
  aspect?: MediaAspect
  /** 结构化降级数据，传给 FallbackCover；典型用法：fallback={{ title, type, seed: video.id }} */
  fallback?: Omit<FallbackCoverProps, 'className'>
  onLoadFail?: (payload: ImageLoadFailPayload) => void
  /** @deprecated use onLoadFail */
  onLoadError?: (err: { src: string; reason: 'network' | 'empty-src' }) => void
  imageLoader?: ImageLoader
  loaderOptions?: ImageLoaderOptions
  /** CDN-02: 渲染模式开关，默认 'lazy' 保证现有消费者零影响 */
  mode?: SafeImageMode
  /** 透传给 <Image sizes>（mode='next' 时）或 <img>（mode='lazy' 时通过 imgClassName 由消费者控制） */
  sizes?: string
  /** 测试钩子；消费者 VideoDetailHero / DetailHero 已在传，在此显式声明类型 */
  'data-testid'?: string
}
