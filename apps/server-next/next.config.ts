import type { NextConfig } from 'next'

// 生产 / staging 部署时通过 NEXT_PUBLIC_ASSET_PREFIX=/admin 注入，
// 使静态资源引用带 /admin 前缀，nginx 反代剥前缀转发到本进程 :3003/_next/...
// （architecture.md §1 静态资源路由 / ADR-101 cutover 协议）。
// 与 apps/server v1 的实现形式完全一致，cutover 后无需切换 env。
// 默认空 → assetPrefix=undefined，dev 直接访问 :3003 不受影响。
const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX ?? ''

const nextConfig: NextConfig = {
  reactStrictMode: true,
  assetPrefix: assetPrefix || undefined,
  experimental: {
    // ADR-103b §4.6：lucide-react named import 优化（dev 启动加速；不影响生产 tree-shake）
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
