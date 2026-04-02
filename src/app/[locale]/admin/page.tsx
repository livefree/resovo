/**
 * /admin — 数据看板（Server Component）
 * CHG-25: SSR 获取初始 analytics 数据，消除客户端 loading 闪烁
 * DEC-02: 改为通过 API fetch 获取数据，消除对后端 Service/db 的直接依赖
 */

import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { AnalyticsCards } from '@/components/admin/dashboard/AnalyticsCards'
import { QueueAlerts } from '@/components/admin/dashboard/QueueAlerts'
import type { AnalyticsData } from '@/types/contracts/v1/admin'

async function fetchAnalytics(): Promise<AnalyticsData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'
    const res = await fetch(`${baseUrl}/v1/admin/analytics`, {
      headers: {
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json() as { data: AnalyticsData }
    return json.data
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
