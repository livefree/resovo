import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@livefree/yt-player'],
  webpack(config) {
    // @livefree/yt-player 的 package.json exports 字段未导出 CSS，
    // 通过 resolve.alias 直接指向文件路径绕过 exports 检查
    config.resolve.alias = {
      ...config.resolve.alias,
      '@livefree/yt-player/dist/index.css':
        require.resolve('@livefree/yt-player/dist/index.css'),
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
