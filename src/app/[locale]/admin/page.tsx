/**
 * /admin — 数据看板（Server Component）
 * CHG-338: 移除 x-internal-secret SSR prefetch（安全反模式）
 *   analytics 数据改为由 AnalyticsCards（Client Component）首屏拉数 + 30 秒轮询
 */

import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { AnalyticsCards } from '@/components/admin/dashboard/AnalyticsCards'

export default function AdminRootPage() {
  return (
    <ListPageShell variant="admin"
      title="数据看板"
      description="查看运营统计、审核队列与采集任务概览。"
      testId="admin-page"
    >
      <AnalyticsCards />
    </ListPageShell>
  )
}
