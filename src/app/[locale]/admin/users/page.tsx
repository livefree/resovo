/**
 * /admin/users — 用户管理页
 * ADMIN-04: admin only，封号/解封/角色修改
 */

import { AdminUserList } from '@/components/admin/AdminUserList'

export default function AdminUsersPage() {
  return (
    <div data-testid="admin-users-page">
      <h1 className="mb-6 text-2xl font-bold">用户管理</h1>
      <AdminUserList />
    </div>
  )
}
