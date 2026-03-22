/**
 * /admin/analytics — 数据看板
 * ADMIN-05: admin only，运营统计数据
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { AdminAnalyticsDashboard } from '@/components/admin/AdminAnalyticsDashboard'

export default function AdminAnalyticsPage() {
  return (
    <AdminPageShell
      title="数据看板"
      description="查看运营统计、任务趋势与关键告警数据。"
      testId="admin-analytics-page"
    >
      <AdminAnalyticsDashboard />
    </AdminPageShell>
  )
}
