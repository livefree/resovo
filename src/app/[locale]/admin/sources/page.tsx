/**
 * /admin/sources — 播放源管理页
 * ADMIN-03: 按 is_active 筛选，支持单条验证、批量删除
 */

import { AdminSourceList } from '@/components/admin/AdminSourceList'

export default function AdminSourcesPage() {
  return (
    <div data-testid="admin-sources-page">
      <h1 className="mb-6 text-2xl font-bold">播放源管理</h1>
      <AdminSourceList />
    </div>
  )
}
