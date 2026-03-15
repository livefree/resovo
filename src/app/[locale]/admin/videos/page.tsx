/**
 * /admin/videos — 视频列表页
 * ADMIN-02: 按 is_published 状态筛选，支持上下架操作
 */

import Link from 'next/link'
import { AdminVideoList } from '@/components/admin/AdminVideoList'

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
      <AdminVideoList />
    </div>
  )
}
