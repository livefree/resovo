/**
 * /admin/system/cache — 缓存管理页面（Server Component）
 * CHG-30
 */

import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { CacheManager } from '@/components/admin/system/monitoring/CacheManager'

export default function AdminCachePage() {
  return (
    <ListPageShell variant="admin"
      title="缓存管理"
      description="管理各类缓存命中与清理操作。"
      testId="admin-cache-page"
    >
      <CacheManager />
    </ListPageShell>
  )
}
