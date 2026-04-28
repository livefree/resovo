import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // ADR-103b §4.6：lucide-react named import 优化（dev 启动加速；不影响生产 tree-shake）
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
