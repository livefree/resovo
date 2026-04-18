/**
 * /admin/videos/[id]/edit — 编辑视频元数据页
 * ADMIN-02: 修改 title/description/director/cast/writers/cover_url/category/year
 */

import { AdminVideoForm } from '@/components/admin/AdminVideoForm'

export default async function AdminVideoEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  return (
    <div data-testid="admin-video-edit-page">
      <h1 className="mb-6 text-2xl font-bold">编辑视频</h1>
      <AdminVideoForm videoId={id} returnUrl={from ?? '/admin/videos'} />
    </div>
  )
}
