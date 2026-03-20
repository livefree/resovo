'use client'

import { apiClient } from '@/lib/api-client'
import type { CrawlMode, CrawlTaskDTO } from '@/components/admin/system/crawler-site/crawlTask.types'

interface TriggerCrawlTaskResponse {
  data: {
    jobId: string | number
    type: 'full-crawl' | 'incremental-crawl'
    siteKey?: string
  }
}

interface LatestTasksResponse {
  data: {
    tasks: CrawlTaskDTO[]
  }
}

interface LatestTaskResponse {
  data: {
    task: CrawlTaskDTO | null
  }
}

function toTaskType(mode: CrawlMode): 'full-crawl' | 'incremental-crawl' {
  return mode === 'full' ? 'full-crawl' : 'incremental-crawl'
}

export async function triggerSiteCrawlTask(siteKey: string, mode: CrawlMode): Promise<string | number> {
  const res = await apiClient.post<TriggerCrawlTaskResponse>('/admin/crawler/tasks', {
    type: toTaskType(mode),
    siteKey,
  })
  return res.data.jobId
}

export async function getLatestCrawlTasksBySites(siteKeys: string[]): Promise<CrawlTaskDTO[]> {
  if (siteKeys.length === 0) return []
  const query = encodeURIComponent(siteKeys.join(','))
  const res = await apiClient.get<LatestTasksResponse>(`/admin/crawler/tasks/latest?siteKeys=${query}`)
  return res.data.tasks
}

export async function getLatestCrawlTaskBySite(siteKey: string): Promise<CrawlTaskDTO | null> {
  const res = await apiClient.get<LatestTaskResponse>(`/admin/crawler/sites/${siteKey}/latest-task`)
  return res.data.task
}
