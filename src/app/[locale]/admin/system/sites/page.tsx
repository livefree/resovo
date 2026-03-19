/**
 * /admin/system/sites — 视频源配置页面
 * CHG-35
 */

import { CrawlerSiteManager } from '@/components/admin/system/CrawlerSiteManager'

export default function AdminCrawlerSitesPage() {
  return (
    <div data-testid="admin-crawler-sites-page">
      <h1 className="mb-2 text-2xl font-bold">视频源配置</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        管理爬虫使用的外部苹果CMS源站。停用源站不影响已采集的视频，仅暂停该站的后续采集。配置文件来源的源站需在「配置文件」页面中修改。
      </p>
      <CrawlerSiteManager />
    </div>
  )
}
