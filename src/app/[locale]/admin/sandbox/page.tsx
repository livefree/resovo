/**
 * 组件沙盒页面 — 治理样板验证环境
 *
 * 用途：
 *   1. 验证 TableSettingsTrigger + useTableSettings 的视觉与交互
 *   2. 作为"后台表格类样板迁移页"的长期验证环境（SEQ-20260328-42）
 *
 * 访问控制：仅限 admin 角色（role='admin'）
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { SandboxTableDemo } from './SandboxTableDemo'

export default async function SandboxPage() {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user_role')?.value
  if (userRole !== 'admin') {
    redirect('/admin')
  }

  return (
    <AdminPageShell title="组件沙盒" description="用于验证共享组件的视觉与交互行为。">
      <SandboxTableDemo />
    </AdminPageShell>
  )
}
