/**
 * /admin — 数据看板（Server Component）
 * CHG-25: SSR 获取初始 analytics 数据，消除客户端 loading 闪烁
 */

import { AnalyticsService } from '@/api/services/AnalyticsService'
import { db } from '@/api/lib/postgres'
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
      <div data-testid="admin-page">
        <h1 className="mb-6 text-2xl font-bold">数据看板</h1>
        <p className="text-red-400">数据加载失败，请刷新页面重试</p>
      </div>
    )
  }

  return (
    <div data-testid="admin-page">
      <h1 className="mb-6 text-2xl font-bold">数据看板</h1>
      <QueueAlerts queues={data.queues} />
      <AnalyticsCards initialData={data} />
    </div>
  )
}
