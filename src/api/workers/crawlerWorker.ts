/**
 * crawlerWorker.ts — 爬虫采集队列消费者
 * CHG-36: 从 crawler_sites 表读取源站；支持 siteKey 单站触发；更新采集状态
 */

import type Bull from 'bull'
import { crawlerQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { CrawlerService, getEnabledSources } from '@/api/services/CrawlerService'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import { createCrawlerTaskLog } from '@/api/db/queries/crawlerTaskLogs'

// ── 任务类型 ──────────────────────────────────────────────────────

export type CrawlJobType = 'full-crawl' | 'incremental-crawl'

export interface CrawlJobData {
  type: CrawlJobType
  /** 指定单站 key；留空时采集全部启用站 */
  siteKey?: string
  /** 已创建的任务 ID（单站触发时由 API 预创建） */
  taskId?: string
  /** 增量模式：只采集最近 N 小时更新的内容 */
  hoursAgo?: number
}

export interface CrawlJobResult {
  type: CrawlJobType
  sites: string[]
  videosUpserted: number
  sourcesUpserted: number
  errors: number
  durationMs: number
}

// ── Worker 处理函数 ───────────────────────────────────────────────

async function processCrawlJob(job: Bull.Job<CrawlJobData>): Promise<CrawlJobResult> {
  const { type, siteKey, taskId, hoursAgo } = job.data
  const start = Date.now()
  const crawlerService = new CrawlerService(db, es)

  const logTask = async (
    level: 'info' | 'warn' | 'error',
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ) => {
    try {
      await createCrawlerTaskLog(db, {
        taskId: taskId ?? null,
        sourceSite: siteKey ?? null,
        level,
        stage,
        message,
        details: {
          ...(details ?? {}),
          jobId: String(job.id),
          mode: type,
        },
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[crawler-worker] failed to persist task log: ${reason}\n`)
    }
  }

  await logTask('info', 'worker.job.received', 'Worker 接收到采集任务', {
    siteKey: siteKey ?? null,
    hoursAgo: hoursAgo ?? null,
  })

  if (taskId) {
    await crawlerTasksQueries.updateTaskStatus(db, taskId, 'running', {
      queueJobId: String(job.id),
    })
    await logTask('info', 'worker.task.running', '任务状态切换为 running')
  }

  try {
    // 获取待采集源站列表
    let allSources = await getEnabledSources(db)
    if (siteKey) {
      allSources = allSources.filter((s) => s.name === siteKey)
      if (allSources.length === 0) {
        await logTask('error', 'worker.source.not_found', '指定源站不存在或已禁用', { siteKey })
        throw new Error(`源站 "${siteKey}" 不存在或已禁用`)
      }
    }

    if (allSources.length === 0) {
      await logTask('error', 'worker.source.empty', '没有可用采集源站')
      throw new Error('没有可用的采集源站，请在"视频源配置"中添加并启用源站')
    }

    await job.progress(0)

    let videosUpserted = 0
    let sourcesUpserted = 0
    let errors = 0
    const siteNames: string[] = []

    for (let i = 0; i < allSources.length; i++) {
      const source = allSources[i]
      siteNames.push(source.name)

      // 标记为运行中
      await crawlerSitesQueries.updateCrawlStatus(db, source.name, 'running')
      await logTask('info', 'worker.source.start', '开始采集源站', { source: source.name, base: source.base })

      try {
        process.stderr.write(
          `[crawler-worker] crawling ${source.name} (${source.base}, ${type}${hoursAgo ? `, last ${hoursAgo}h` : ''})\n`
        )
        const result = await crawlerService.crawl(source, {
          taskType: type,
          taskId: siteKey ? taskId : undefined,
          hoursAgo: type === 'incremental-crawl' ? (hoursAgo ?? 24) : undefined,
          onLog: async (input) => {
            await logTask(input.level ?? 'info', input.stage, input.message, {
              source: source.name,
              ...(input.details ?? {}),
            })
          },
        })
        videosUpserted += result.videosUpserted
        sourcesUpserted += result.sourcesUpserted
        if (result.errors > 0) errors += result.errors

        await crawlerSitesQueries.updateCrawlStatus(db, source.name, result.errors > 0 ? 'failed' : 'ok')
        await logTask('info', 'worker.source.done', '源站采集完成', {
          source: source.name,
          videosUpserted: result.videosUpserted,
          sourcesUpserted: result.sourcesUpserted,
          errors: result.errors,
        })
      } catch (err) {
        errors++
        const message = err instanceof Error ? err.message : String(err)
        process.stderr.write(`[crawler-worker] error crawling ${source.name}: ${message}\n`)
        await crawlerSitesQueries.updateCrawlStatus(db, source.name, 'failed')
        await logTask('error', 'worker.source.failed', '源站采集失败', {
          source: source.name,
          error: message,
        })
      }

      await job.progress(Math.round(((i + 1) / allSources.length) * 100))
    }

    return {
      type,
      sites: siteNames,
      videosUpserted,
      sourcesUpserted,
      errors,
      durationMs: Date.now() - start,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logTask('error', 'worker.job.failed', '采集任务执行失败', { error: message })
    if (taskId) {
      await crawlerTasksQueries.updateTaskStatus(db, taskId, 'failed', {
        error: message,
      })
    }
    throw err
  }
}

// ── Worker 注册 ───────────────────────────────────────────────────

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

/** 添加全量采集任务到队列（可选指定单站 key） */
export async function enqueueFullCrawl(siteKey?: string, taskId?: string): Promise<Bull.Job<CrawlJobData>> {
  return crawlerQueue.add({ type: 'full-crawl', siteKey, taskId })
}

/** 添加增量采集任务到队列（默认最近 24 小时，可选指定单站 key） */
export async function enqueueIncrementalCrawl(
  siteKey?: string,
  hoursAgo = 24,
  taskId?: string,
): Promise<Bull.Job<CrawlJobData>> {
  return crawlerQueue.add({ type: 'incremental-crawl', siteKey, taskId, hoursAgo })
}
