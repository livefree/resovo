import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
