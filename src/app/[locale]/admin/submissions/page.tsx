/**
 * /admin/submissions — 投稿审核页
 * ADMIN-03: 用户投稿的播放源待审队列，支持通过/拒绝
 */

import { AdminSubmissionList } from '@/components/admin/AdminSubmissionList'

export default function AdminSubmissionsPage() {
  return (
    <div data-testid="admin-submissions-page">
      <h1 className="mb-6 text-2xl font-bold">投稿审核</h1>
      <AdminSubmissionList />
    </div>
  )
}
