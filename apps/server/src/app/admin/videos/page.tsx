/**
 * /admin/videos — 视频管理页（Server Component）
 * CHG-27: 使用 VideoFilters + VideoTable Client Components
 */

import Link from 'next/link'
import { Suspense } from 'react'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { VideoFilters } from '@/components/admin/videos/VideoFilters'
import { VideoTable } from '@/components/admin/videos/VideoTable'
import { StagingCountBadge } from '@/components/admin/videos/StagingCountBadge'

export default function AdminVideosPage() {
  return (
    <ListPageShell variant="admin"
      title="视频管理"
      description="管理视频信息、筛选状态并执行上架下架操作。"
      testId="admin-videos-page"
      actions={(
        <div className="flex items-center gap-3">
          <StagingCountBadge />
          <Link href="/admin/videos/new" data-testid="admin-videos-new-btn">
            <AdminButton variant="primary" className="px-4 font-medium">
              手动添加视频
            </AdminButton>
          </Link>
        </div>
      )}
    >
      <Suspense>
        <VideoFilters />
        <VideoTable />
      </Suspense>
    </ListPageShell>
  )
}
