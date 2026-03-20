/**
 * /admin/system/cache — 缓存管理页面（Server Component）
 * CHG-30
 */

import { CacheManager } from '@/components/admin/system/monitoring/CacheManager'

export default function AdminCachePage() {
  return (
    <div data-testid="admin-cache-page">
      <h1 className="mb-6 text-2xl font-bold">缓存管理</h1>
      <CacheManager />
    </div>
  )
}
