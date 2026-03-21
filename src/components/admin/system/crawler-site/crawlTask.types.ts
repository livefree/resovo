export type CrawlMode = 'incremental' | 'full'

export type CrawlTaskStatus = 'queued' | 'running' | 'paused' | 'success' | 'failed'

export interface CrawlTaskDTO {
  id: string
  siteKey: string
  mode: CrawlMode
  status: CrawlTaskStatus
  startedAt: string | null
  finishedAt: string | null
  message: string | null
  itemCount: number | null
}
