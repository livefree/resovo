/**
 * /admin/crawler — 采集控制台统一页
 * CHG-96: 三 Tab 结构（采集配置 / 采集任务记录 / 高级设置）
 */

import { AdminCrawlerTabs } from '@/components/admin/AdminCrawlerTabs'

export default function AdminCrawlerPage() {
  return (
    <div data-testid="admin-crawler-page">
      <AdminCrawlerTabs />
    </div>
  )
}
