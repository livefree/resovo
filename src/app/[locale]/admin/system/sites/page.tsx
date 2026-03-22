/**
 * /admin/system/sites — 兼容旧入口，重定向到统一管理页
 * CHG-42
 */

import { redirect } from 'next/navigation'

export default function AdminCrawlerSitesPage() {
  redirect('/admin/crawler')
}
