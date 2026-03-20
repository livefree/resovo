/**
 * /admin/users — 用户管理页（Server Component）
 * CHG-26: 页面壳（无 SSR 数据预取，由 UserTable Client Component 负责搜索/分页）
 */

import { UserTable } from '@/components/admin/users/UserTable'

export default function AdminUsersPage() {
  return (
    <div className="space-y-4" data-testid="admin-users-page">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">按用户名或邮箱检索用户，并执行角色与封禁管理。</p>
      </div>
      <UserTable />
    </div>
  )
}
