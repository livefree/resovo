/**
 * image-loader.ts — 图片 URL 构建策略
 *
 * ## env 切换方式
 *
 * 在 `.env.local`（或 Vercel / Docker 环境变量）中设置：
 *
 * ```
 * IMAGE_LOADER=passthrough          # 默认：原图直出，不经过 CDN
 * IMAGE_LOADER=cloudflare           # 通过 Cloudflare Images 代理缩图
 * IMAGE_LOADER_CF_ACCOUNT_HASH=xxx  # cloudflare 模式必填
 * ```
 *
 * 客户端组件中需改用 NEXT_PUBLIC_ 前缀的同名变量（Next.js 编译期注入）：
 * ```
 * NEXT_PUBLIC_IMAGE_LOADER=cloudflare
 * NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH=xxx
 * ```
 *
 * ## 过渡期多尺寸行为（IMAGE_LOADER=passthrough）
 *
 * SafeImage 当前基于 `<img>`，不经过 `next/image` custom loader。
 * passthrough 模式下，原图 URL 直出，浏览器依据 `sizes` / `srcSet` 属性选最接近的尺寸。
 * `width` / `quality` / `format` 参数在 passthrough 模式下均被忽略。
 *
 * 若未来 SafeImage 改为 `next/image`，需另立任务卡同步修改 `next.config.ts`。
 */

export interface ImageLoaderOptions {
  /** 目标渲染宽度（物理像素），用于 CDN 侧尺寸协商 */
  width?: number
  /** 1-100，默认由实现决定；passthrough 模式下忽略 */
  quality?: number
  /** 输出格式；'auto' 表示交由 CDN 按 UA 协商 */
  format?: 'auto' | 'webp' | 'avif'
}

export type ImageLoader = (src: string, opts: ImageLoaderOptions) => string

export type LoaderType = 'passthrough' | 'cloudflare'

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

/**
 * 根据 `type` 参数或 `IMAGE_LOADER` env 返回对应的 loader 函数。
 *
 * @param type - 显式指定 loader 类型；省略时读取 `IMAGE_LOADER` / `NEXT_PUBLIC_IMAGE_LOADER` env，
 *               两者均未设置时默认使用 `'passthrough'`。
 */
export function getLoader(type?: LoaderType): ImageLoader {
  const resolved: LoaderType = type ?? ((
    process.env['IMAGE_LOADER'] ||
    process.env['NEXT_PUBLIC_IMAGE_LOADER'] ||
    'passthrough'
  ) as LoaderType)
  return resolved === 'cloudflare' ? cloudflareLoader : passthroughLoader
}
