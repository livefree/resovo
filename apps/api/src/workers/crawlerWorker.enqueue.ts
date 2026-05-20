/**
 * crawlerWorker.enqueue.ts — 采集任务入队工具函数
 * 从 crawlerWorker.ts 拆出，供 CrawlerRunService 调用
 */

import type Bull from 'bull'
import { crawlerQueue } from '@/api/lib/queue'
import type { CrawlJobData, CrawlJobMode } from './crawlerWorker.sources'

// Bull job 超时上界：单个采集任务最长允许运行 30 分钟。
// 超时后 Bull 将 job 标记为 failed，worker 可在 failed 事件中更新 DB 状态。
// 这是硬性保障层，与 crawler_tasks.timeout_at 的软性 watchdog 互补。
const CRAWLER_JOB_TIMEOUT_MS = 30 * 60 * 1000

interface EnqueueExtras {
  crawlMode?: CrawlJobMode
  keyword?: string | null
  targetVideoId?: string | null
}

/** 添加全量采集任务到队列（可选指定单站 key） */
export async function enqueueFullCrawl(
  siteKey: string,
  taskId: string,
  runId: string,
  extras?: EnqueueExtras,
): Promise<Bull.Job<CrawlJobData>> {
  if (!siteKey || !taskId || !runId) {
    throw new Error('CRAWL_JOB_CONTRACT_INVALID: enqueueFullCrawl requires siteKey/taskId/runId')
  }
  const data: CrawlJobData = { type: 'full-crawl', siteKey, taskId, runId }
  if (extras?.crawlMode) data.crawlMode = extras.crawlMode
  if (extras?.keyword) data.keyword = extras.keyword
  if (extras?.targetVideoId) data.targetVideoId = extras.targetVideoId
  return crawlerQueue.add(data, { timeout: CRAWLER_JOB_TIMEOUT_MS })
}

/** 添加增量采集任务到队列（默认最近 24 小时，可选指定单站 key） */
export async function enqueueIncrementalCrawl(
  siteKey: string,
  hoursAgo = 24,
  taskId: string,
  runId: string,
  extras?: EnqueueExtras,
): Promise<Bull.Job<CrawlJobData>> {
  if (!siteKey || !taskId || !runId) {
    throw new Error('CRAWL_JOB_CONTRACT_INVALID: enqueueIncrementalCrawl requires siteKey/taskId/runId')
  }
  const data: CrawlJobData = { type: 'incremental-crawl', siteKey, taskId, runId, hoursAgo }
  if (extras?.crawlMode) data.crawlMode = extras.crawlMode
  if (extras?.keyword) data.keyword = extras.keyword
  if (extras?.targetVideoId) data.targetVideoId = extras.targetVideoId
  return crawlerQueue.add(data, { timeout: CRAWLER_JOB_TIMEOUT_MS })
}
