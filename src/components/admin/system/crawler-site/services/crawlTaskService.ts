'use client'

import { apiClient } from '@/lib/api-client'
import type { CrawlMode, CrawlTaskDTO } from '@/components/admin/system/crawler-site/crawlTask.types'

interface TriggerCrawlTaskResponse {
  data: {
    runId: string
    taskId: string | null
    taskIds?: string[]
    type: 'full-crawl' | 'incremental-crawl'
    siteKey: string | null
    enqueuedSiteKeys: string[]
    skippedSiteKeys: string[]
  }
}

interface TriggerRunResponse {
  data: {
    runId: string
    taskIds: string[]
    enqueuedSiteKeys: string[]
    skippedSiteKeys: string[]
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

export async function triggerSiteCrawlTask(siteKey: string, mode: CrawlMode): Promise<TriggerCrawlTaskResponse['data']> {
  const res = await apiClient.post<TriggerRunResponse>('/admin/crawler/runs', {
    triggerType: 'single',
    mode,
    siteKeys: [siteKey],
  })
  return {
    runId: res.data.runId,
    taskId: res.data.taskIds[0] ?? null,
    taskIds: res.data.taskIds,
    type: mode === 'full' ? 'full-crawl' : 'incremental-crawl',
    siteKey,
    enqueuedSiteKeys: res.data.enqueuedSiteKeys,
    skippedSiteKeys: res.data.skippedSiteKeys,
  }
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
