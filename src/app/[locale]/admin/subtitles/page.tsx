/**
 * /admin/subtitles — 字幕审核页
 * ADMIN-03: 待审字幕队列，支持通过/拒绝（软删除）
 */

import { AdminSubtitleList } from '@/components/admin/AdminSubtitleList'
import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'

export default function AdminSubtitlesPage() {
  return (
    <AdminPageShell
      title="字幕审核"
      description="审核用户上传字幕，支持通过与拒绝。"
      testId="admin-subtitles-page"
    >
      <AdminSubtitleList />
    </AdminPageShell>
  )
}
