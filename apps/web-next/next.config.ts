import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { routing } from './src/i18n/routing'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  async redirects() {
    // 旧 /variety/* 永久迁移到 /tvshow/*（ADR-048/ADR-042：tvshow(URL) ↔ variety(域) 映射 + 308 永久范式 D6）。
    // localePrefix 默认 'always'（src/i18n/routing.ts）→ 实际路径恒带 locale 前缀，故须显式匹配
    // `/{locale}/variety/*`，且 locale 段约束为合法值避免越界改写其他 `/{x}/variety/*` 路径。
    // locale 列表取自 routing.locales（i18n 单一真源），不硬编码——新增 locale 自动覆盖、零漂移。
    // 另保留无前缀兜底（直接命中或非常规入口，链式经 intlMiddleware 再补 locale）。
    const localePattern = routing.locales.join('|')
    return [
      {
        source: `/:locale(${localePattern})/variety/:path*`,
        destination: '/:locale/tvshow/:path*',
        permanent: true,
      },
      {
        source: '/variety/:path*',
        destination: '/tvshow/:path*',
        permanent: true,
      },
    ]
  },
  reactStrictMode: true,
  images: {
    // CDN-01: 接入自定义 loader，转接到 src/lib/image/image-loader.ts 的
    // getLoader() 抽象（passthrough / cloudflare 由 env 切换）。
    // 与 SafeImage 消费同一 loader 策略，未来接入 Cloudflare Images 零代码改动。
    // 方案：image_pipeline_plan §10.2。
    loader: 'custom',
    loaderFile: './src/lib/image/next-image-loader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
}

export default withNextIntl(nextConfig)
