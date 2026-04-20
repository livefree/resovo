export interface ImageLoaderOptions {
  /** 目标渲染宽度（物理像素），用于 CDN 侧尺寸协商 */
  width?: number
  /** 1-100，默认由实现决定；passthrough 模式下忽略 */
  quality?: number
  /** 输出格式；'auto' 表示交由 CDN 按 UA 协商 */
  format?: 'auto' | 'webp' | 'avif'
}

export type ImageLoader = (src: string, opts: ImageLoaderOptions) => string

export const passthroughLoader: ImageLoader = (src) => src || ''

/** @deprecated use passthroughLoader or getLoader() */
export const buildImageUrl: ImageLoader = passthroughLoader

// ── Cloudflare Images loader ──────────────────────────────────────

function getCfAccountHash(): string {
  return (
    process.env['IMAGE_LOADER_CF_ACCOUNT_HASH'] ??
    process.env['NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH'] ??
    ''
  )
}

export const cloudflareLoader: ImageLoader = (src, opts) => {
  if (!src) return ''
  const variant = [
    opts.width != null ? `w=${opts.width}` : null,
    `q=${opts.quality ?? 80}`,
    `f=${opts.format ?? 'auto'}`,
  ].filter(Boolean).join(',')
  return `https://imagedelivery.net/${getCfAccountHash()}/${src}/${variant}`
}

// ── 运行时 loader 选择 ────────────────────────────────────────────

type LoaderType = 'passthrough' | 'cloudflare'

export function getLoader(): ImageLoader {
  const env = (
    process.env['IMAGE_LOADER'] ??
    process.env['NEXT_PUBLIC_IMAGE_LOADER'] ??
    'passthrough'
  ) as LoaderType
  return env === 'cloudflare' ? cloudflareLoader : passthroughLoader
}
