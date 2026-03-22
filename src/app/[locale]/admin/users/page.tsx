/**
 * /admin/users — 用户管理页（Server Component）
 * CHG-26: 页面壳（无 SSR 数据预取，由 UserTable Client Component 负责搜索/分页）
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { UserTable } from '@/components/admin/users/UserTable'

export default function AdminUsersPage() {
  return (
    <AdminPageShell
      title="用户管理"
      description="按用户名或邮箱检索用户，并执行角色与封禁管理。"
      testId="admin-users-page"
    >
      <UserTable />
    </AdminPageShell>
  )
}
