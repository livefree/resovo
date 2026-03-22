/**
 * /admin/sources — 播放源管理页（Server Component）
 * CHG-28: 使用 SourceTable Client Component
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { SourceTable } from '@/components/admin/sources/SourceTable'

export default function AdminSourcesPage() {
  return (
    <AdminPageShell
      title="播放源管理"
      description="筛选、验证和清理播放源，保持源站稳定性。"
      testId="admin-sources-page"
    >
      <SourceTable />
    </AdminPageShell>
  )
}
