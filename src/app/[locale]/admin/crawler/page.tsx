/**
 * /admin/crawler — 源站与爬虫管理统一页
 * CHG-42: 合并“视频源配置”与“爬虫管理”页面
 */

import { AdminCrawlerPanel } from '@/components/admin/AdminCrawlerPanel'
import { CrawlerSiteManager } from '@/components/admin/system/CrawlerSiteManager'

export default function AdminCrawlerPage() {
  return (
    <div data-testid="admin-crawler-page" className="space-y-8">
      <section>
        <h1 className="mb-2 text-2xl font-bold">源站与爬虫管理</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          统一管理采集源站配置与采集任务。你可以在同一页面完成源站维护、单站触发、全量/增量采集与任务追踪。
        </p>
        <AdminCrawlerPanel />
      </section>

      <section id="site-manager" className="border-t border-[var(--border)] pt-6">
        <h2 className="mb-2 text-xl font-semibold">视频源配置</h2>
        <p className="mb-6 text-sm text-[var(--muted)]">
          管理爬虫使用的外部苹果CMS源站。停用源站不影响已采集的视频，仅暂停该站的后续采集。配置文件来源的源站需在「配置文件」页面中修改。
        </p>
        <CrawlerSiteManager />
      </section>
    </div>
  )
}
