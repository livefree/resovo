import { apiClient } from '@/lib/api-client'
import type { CrawlerSite } from '@/lib/videos/types'

export async function listCrawlerSites(): Promise<CrawlerSite[]> {
  const res = await apiClient.get<{ data: CrawlerSite[] }>('/admin/crawler/sites')
  return res.data
}
