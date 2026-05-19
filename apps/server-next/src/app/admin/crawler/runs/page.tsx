/**
 * /admin/crawler/runs — 采集批次列表独立路由（CHG-SN-7-REDO-01-H）
 *
 * 历史：原 CrawlerRunsView 嵌入 CrawlerClient sites/runs tab；REDO-01-C 重写
 * 移除 tab，runs 列表迁此独立 page；sidebar 二级菜单注册见 lib/admin-nav.tsx
 */

import { CrawlerRunsView } from './_client/CrawlerRunsView'

export const dynamic = 'force-dynamic'

export default function CrawlerRunsPage() {
  return <CrawlerRunsView />
}
