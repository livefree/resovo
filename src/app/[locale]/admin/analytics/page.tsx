/**
 * /admin/analytics — 数据看板
 * ADMIN-05: admin only，运营统计数据
 */

import { AdminAnalyticsDashboard } from '@/components/admin/AdminAnalyticsDashboard'

export default function AdminAnalyticsPage() {
  return (
    <div data-testid="admin-analytics-page">
      <h1 className="mb-6 text-2xl font-bold">数据看板</h1>
      <AdminAnalyticsDashboard />
    </div>
  )
}
