/**
 * /admin/videos/[id]/edit — 编辑视频元数据页
 * ADMIN-02: 修改 title/description/director/cast/writers/cover_url/category/year
 */

import { AdminVideoForm } from '@/components/admin/AdminVideoForm'

export default async function AdminVideoEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div data-testid="admin-video-edit-page">
      <h1 className="mb-6 text-2xl font-bold">编辑视频</h1>
      <AdminVideoForm videoId={id} />
    </div>
  )
}
