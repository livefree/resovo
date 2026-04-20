export interface LazyImageProps {
  src: string
  alt: string
  width: number
  height: number
  /**
   * blurhash 占位字符串；不传则占位为纯色背景（使用 --bg-surface token）。
   */
  blurHash?: string
  /**
   * 跳过 IntersectionObserver，立即加载（首屏关键图使用）。
   */
  priority?: boolean
  className?: string
  imgClassName?: string
  style?: React.CSSProperties
  onLoad?: () => void
  onError?: () => void
}

export interface BlurHashCanvasProps {
  hash: string
  width: number
  height: number
  punch?: number
  className?: string
}
