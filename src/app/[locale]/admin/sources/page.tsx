/**
 * /admin/sources — 播放源管理页（Server Component）
 * CHG-216: 使用 AdminSourceList 组合源健康告警与双区域列表
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { AdminSourceList } from '@/components/admin/AdminSourceList'

export default function AdminSourcesPage() {
  return (
    <AdminPageShell
      title="播放源管理"
      description="筛选、验证和清理播放源，保持源站稳定性。"
      testId="admin-sources-page"
    >
      <AdminSourceList />
    </AdminPageShell>
  )
}
