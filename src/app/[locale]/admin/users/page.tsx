/**
 * /admin/users — 用户管理页（Server Component）
 * CHG-26: 页面壳（无 SSR 数据预取，由 UserTable Client Component 负责搜索/分页）
 */

import { UserTable } from '@/components/admin/users/UserTable'

export default function AdminUsersPage() {
  return (
    <div data-testid="admin-users-page">
      <h1 className="mb-6 text-2xl font-bold">用户管理</h1>
      <UserTable />
    </div>
  )
}
