/**
 * /admin/sources — 播放源管理页（Server Component）
 * CHG-216: 使用 AdminSourceList 组合源健康告警与双区域列表
 */

import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { AdminSourceList } from '@/components/admin/AdminSourceList'

export default function AdminSourcesPage() {
  return (
    <ListPageShell variant="admin"
      title="播放源管理"
      description="筛选、验证和清理播放源，并查看源校验调度运行态。"
      testId="admin-sources-page"
    >
      <AdminSourceList />
    </ListPageShell>
  )
}
