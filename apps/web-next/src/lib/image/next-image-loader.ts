/**
 * next-image-loader.ts — Next.js `images.loaderFile` 约定的默认导出
 *
 * Next.js 会在每次渲染 `<Image>` 时调用本 module 的 default export，传入：
 *   - src:     Image 组件的 src（原始 URL 或静态资源路径）
 *   - width:   设备协商宽度（由 Next 自动按 viewport + sizes 计算）
 *   - quality: 可选，1-100
 *
 * 内部转接到已有的 `getLoader()` 抽象（passthrough / cloudflare，由 env 切换），
 * 保持与 `SafeImage` 消费同一 loader 策略，未来接入 Cloudflare Images 零改动。
 *
 * ## env 切换（server / edge）
 *   IMAGE_LOADER=passthrough|cloudflare
 *   IMAGE_LOADER_CF_ACCOUNT_HASH=<account hash>  # cloudflare 模式必填
 *
 * ## env 切换（client / 编译期）
 *   NEXT_PUBLIC_IMAGE_LOADER=passthrough|cloudflare
 *   NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH=<account hash>
 *
 * 关联：image_pipeline_plan §10.2 + ADR-035
 */

import { getLoader } from './image-loader'

export interface NextImageLoaderProps {
  src: string
  width: number
  quality?: number
}

/**
 * Next.js custom loader 入口。保持纯函数语义，不访问 DOM/window。
 */
export default function nextImageLoader({ src, width, quality }: NextImageLoaderProps): string {
  const loader = getLoader()
  return loader(src, {
    width,
    quality,
    format: 'auto',
  })
}
