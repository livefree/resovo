/**
 * /admin/videos/new — 手动添加视频页
 * ADMIN-02: 直接填写元数据 + 播放源，不经爬虫
 */

import { AdminVideoForm } from '@/components/admin/AdminVideoForm'

export default function AdminVideosNewPage() {
  return (
    <div data-testid="admin-videos-new-page">
      <h1 className="mb-6 text-2xl font-bold">手动添加视频</h1>
      <AdminVideoForm />
    </div>
  )
}
