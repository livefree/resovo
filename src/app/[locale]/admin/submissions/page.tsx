/**
 * /admin/submissions — 投稿审核页
 * ADMIN-03: 用户投稿的播放源待审队列，支持通过/拒绝
 */

import { AdminSubmissionList } from '@/components/admin/AdminSubmissionList'
import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'

export default function AdminSubmissionsPage() {
  return (
    <AdminPageShell
      title="投稿审核"
      description="审核用户提交的播放源信息，支持通过与拒绝。"
      testId="admin-submissions-page"
    >
      <AdminSubmissionList />
    </AdminPageShell>
  )
}
