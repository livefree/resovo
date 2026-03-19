/**
 * /admin/videos — 视频管理页（Server Component）
 * CHG-27: 使用 VideoFilters + VideoTable Client Components
 */

import Link from 'next/link'
import { Suspense } from 'react'
import { VideoFilters } from '@/components/admin/videos/VideoFilters'
import { VideoTable } from '@/components/admin/videos/VideoTable'

export default function AdminVideosPage() {
  return (
    <div data-testid="admin-videos-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">视频管理</h1>
        <Link
          href="/admin/videos/new"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          data-testid="admin-videos-new-btn"
        >
          手动添加视频
        </Link>
      </div>
      <Suspense>
        <VideoFilters />
        <VideoTable />
      </Suspense>
    </div>
  )
}
