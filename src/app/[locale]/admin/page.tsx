/**
 * /admin — 数据看板（Server Component）
 * CHG-25: SSR 获取初始 analytics 数据，消除客户端 loading 闪烁
 */

import { AnalyticsService } from '@/api/services/AnalyticsService'
import { db } from '@/api/lib/postgres'
import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { AnalyticsCards } from '@/components/admin/dashboard/AnalyticsCards'
import { QueueAlerts } from '@/components/admin/dashboard/QueueAlerts'
import type { AnalyticsData } from '@/api/routes/admin/analytics'

async function fetchAnalytics(): Promise<AnalyticsData | null> {
  try {
    const service = new AnalyticsService(db)
    return await service.getDashboard()
  } catch {
    return null
  }
}

export default async function AdminRootPage() {
  const data = await fetchAnalytics()

  if (!data) {
    return (
      <ListPageShell variant="admin"
        title="数据看板"
        description="查看运营统计、审核队列与采集任务概览。"
        testId="admin-page"
      >
        <p className="text-red-400">数据加载失败，请刷新页面重试</p>
      </ListPageShell>
    )
  }

  return (
    <ListPageShell variant="admin"
      title="数据看板"
      description="查看运营统计、审核队列与采集任务概览。"
      testId="admin-page"
    >
      <QueueAlerts queues={data.queues} />
      <AnalyticsCards initialData={data} />
    </ListPageShell>
  )
}
