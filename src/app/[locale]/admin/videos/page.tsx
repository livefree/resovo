/**
 * /admin/videos — 视频管理页（Server Component）
 * CHG-27: 使用 VideoFilters + VideoTable Client Components
 */

import Link from 'next/link'
import { Suspense } from 'react'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { VideoFilters } from '@/components/admin/videos/VideoFilters'
import { VideoTable } from '@/components/admin/videos/VideoTable'

export default function AdminVideosPage() {
  return (
    <div className="space-y-4" data-testid="admin-videos-page">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">视频管理</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">管理视频信息、筛选状态并执行上架下架操作。</p>
          </div>
          <Link href="/admin/videos/new" data-testid="admin-videos-new-btn">
            <AdminButton variant="primary" className="px-4 font-medium">
              手动添加视频
            </AdminButton>
          </Link>
        </div>
      </div>
      <Suspense>
        <VideoFilters />
        <VideoTable />
      </Suspense>
    </div>
  )
}
