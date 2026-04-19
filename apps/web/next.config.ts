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
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  webpack(config) {
    // design-tokens 包以 ESM .js 扩展名引用 .ts 源文件；
    // 让 webpack 在找不到 .js 时回退到 .ts / .tsx
    config.resolve.extensionAlias = {
      ...((config.resolve.extensionAlias as Record<string, string[]>) ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    }
    return config
  },
}

export default withNextIntl(nextConfig)
