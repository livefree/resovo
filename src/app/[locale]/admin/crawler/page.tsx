/**
 * /admin/crawler — 爬虫管理页
 * ADMIN-04: admin only，触发采集、查看任务记录
 */

import { AdminCrawlerPanel } from '@/components/admin/AdminCrawlerPanel'

export default function AdminCrawlerPage() {
  return (
    <div data-testid="admin-crawler-page">
      <h1 className="mb-6 text-2xl font-bold">爬虫管理</h1>
      <AdminCrawlerPanel />
    </div>
  )
}
