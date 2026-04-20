export interface ImageLoaderOptions {
  /** 目标渲染宽度（物理像素），用于 CDN 侧尺寸协商 */
  width?: number
  /** 1-100，默认由实现决定；passthrough 模式下忽略 */
  quality?: number
  /** 输出格式；'auto' 表示交由 CDN 按 UA 协商 */
  format?: 'auto' | 'webp' | 'avif'
}

export type ImageLoader = (src: string, opts: ImageLoaderOptions) => string

/**
 * 默认 loader：passthrough。
 * TODO: Cloudflare Images:
 *   https://imagedelivery.net/<accountHash>/<imageId>/w=<width>,q=<quality>,f=<format>
 */
export const buildImageUrl: ImageLoader = (src, _opts) => {
  if (!src) return ''
  return src
}
