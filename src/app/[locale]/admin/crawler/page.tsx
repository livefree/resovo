/**
 * /admin/crawler — 采集控制台统一页
 * CHG-47: 合并页面改为双 Tab（采集控制台 / 采集任务记录）
 */

import { AdminCrawlerTabs } from '@/components/admin/AdminCrawlerTabs'

export default function AdminCrawlerPage() {
  return (
    <div data-testid="admin-crawler-page" className="space-y-6">
      <section>
        <h1 className="mb-2 text-2xl font-bold">采集控制台</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          统一管理采集源站、手动采集触发与自动采集配置。当前页面采用双 Tab 结构，按工作流切换「采集控制台」与「采集任务记录」。
        </p>
        <AdminCrawlerTabs />
      </section>
    </div>
  )
}
