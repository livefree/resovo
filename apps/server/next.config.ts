import type { NextConfig } from 'next'

// 生产部署时通过 NEXT_PUBLIC_ASSET_PREFIX=/admin 注入，
// 使静态资源引用带 /admin 前缀，以便反向代理正确路由到本进程。
const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX ?? ''

const nextConfig: NextConfig = {
  reactStrictMode: true,
  assetPrefix: assetPrefix || undefined,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
}

export default nextConfig
