/**
 * /admin/subtitles — 字幕审核页
 * ADMIN-03: 待审字幕队列，支持通过/拒绝（软删除）
 */

import { AdminSubtitleList } from '@/components/admin/AdminSubtitleList'

export default function AdminSubtitlesPage() {
  return (
    <div data-testid="admin-subtitles-page">
      <h1 className="mb-6 text-2xl font-bold">字幕审核</h1>
      <AdminSubtitleList />
    </div>
  )
}
