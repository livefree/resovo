/**
 * crawlerWorker.ts — 爬虫采集队列消费者
 * CRAWLER-01: 处理 crawler-queue 任务（full-crawl / incremental-crawl）
 * 具体采集逻辑由 CRAWLER-02 的 CrawlerService 实现
 */

import type Bull from 'bull'
import { crawlerQueue } from '@/api/lib/queue'

// ── 任务类型 ──────────────────────────────────────────────────────

export type CrawlJobType = 'full-crawl' | 'incremental-crawl'

export interface CrawlJobData {
  type: CrawlJobType
  /** 资源站地址，留空时从 CRAWLER_SOURCES 环境变量读取 */
  sourceUrl?: string
  /** 增量模式：只采集最近 N 小时更新的内容 */
  hoursAgo?: number
}

export interface CrawlJobResult {
  type: CrawlJobType
  sourceUrl: string
  videosUpserted: number
  sourcesUpserted: number
  errors: number
  durationMs: number
}

// ── Worker 处理函数 ───────────────────────────────────────────────

/**
 * 处理单个爬虫任务。
 * 真正的采集逻辑在 CRAWLER-02 CrawlerService 中实现，
 * 此处为 Worker 注册骨架，保证队列基础设施可工作。
 */
async function processCrawlJob(job: Bull.Job<CrawlJobData>): Promise<CrawlJobResult> {
  const { type, sourceUrl, hoursAgo } = job.data
  const start = Date.now()

  const sources = (sourceUrl ? [sourceUrl] : (process.env.CRAWLER_SOURCES ?? '').split(','))
    .map((s) => s.trim())
    .filter(Boolean)

  if (sources.length === 0) {
    throw new Error('No crawler sources configured. Set CRAWLER_SOURCES env variable.')
  }

  // 进度上报：任务开始
  await job.progress(0)

  let videosUpserted = 0
  let sourcesUpserted = 0
  let errors = 0

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]
    try {
      // CrawlerService（CRAWLER-02 实现后注入）
      // const result = await crawlerService.crawl(src, { hoursAgo })
      // videosUpserted += result.videosUpserted
      // sourcesUpserted += result.sourcesUpserted

      // 占位：记录日志
      process.stderr.write(`[crawler-worker] crawling ${src} (${type}${hoursAgo ? `, last ${hoursAgo}h` : ''})\n`)
    } catch (err) {
      errors++
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[crawler-worker] error crawling ${src}: ${message}\n`)
    }

    await job.progress(Math.round(((i + 1) / sources.length) * 100))
  }

  return {
    type,
    sourceUrl: sources.join(','),
    videosUpserted,
    sourcesUpserted,
    errors,
    durationMs: Date.now() - start,
  }
}

// ── Worker 注册 ───────────────────────────────────────────────────

/**
 * 注册爬虫 Worker 到 crawlerQueue。
 * 在 Fastify 服务启动后调用一次。
 */
export function registerCrawlerWorker(concurrency = 1): void {
  crawlerQueue.process(concurrency, processCrawlJob)

  crawlerQueue.on('completed', (job: Bull.Job<CrawlJobData>, result: CrawlJobResult) => {
    process.stderr.write(
      `[crawler-worker] job ${job.id} completed: ` +
        `${result.videosUpserted} videos, ${result.sourcesUpserted} sources, ` +
        `${result.errors} errors, ${result.durationMs}ms\n`
    )
  })
}

// ── 便捷入队函数 ──────────────────────────────────────────────────

/** 添加全量采集任务到队列 */
export async function enqueueFullCrawl(sourceUrl?: string): Promise<Bull.Job<CrawlJobData>> {
  return crawlerQueue.add({ type: 'full-crawl', sourceUrl })
}

/** 添加增量采集任务到队列（默认最近 24 小时） */
export async function enqueueIncrementalCrawl(
  sourceUrl?: string,
  hoursAgo = 24
): Promise<Bull.Job<CrawlJobData>> {
  return crawlerQueue.add({ type: 'incremental-crawl', sourceUrl, hoursAgo })
}
