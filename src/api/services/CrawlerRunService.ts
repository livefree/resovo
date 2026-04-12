import type { Pool } from 'pg'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import type { CrawlerRunCrawlMode } from '@/api/db/queries/crawlerRuns'
import { createCrawlerTaskLog } from '@/api/db/queries/crawlerTaskLogs'
import { ensureCrawlerQueueReady } from '@/api/lib/queue'
import { enqueueFullCrawl, enqueueIncrementalCrawl } from '@/api/workers/crawlerWorker'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

type TriggerType = 'single' | 'batch' | 'all' | 'schedule'
type Mode = 'incremental' | 'full'

export class CrawlerRunService {
  constructor(private db: Pool) {}

  private async log(input: Parameters<typeof createCrawlerTaskLog>[1]): Promise<void> {
    try {
      await createCrawlerTaskLog(this.db, input)
    } catch {
      // 非阻塞日志
    }
  }

  async createAndEnqueueRun(input: {
    triggerType: TriggerType
    mode: Mode
    siteKeys?: string[]
    hoursAgo?: number
    timeoutSeconds?: number
    createdBy?: string | null
    scheduleId?: string | null
    /** CRAWLER-01: 采集模式（默认 batch） */
    crawlMode?: CrawlerRunCrawlMode
    /** CRAWLER-01: 关键词搜索词（crawlMode='keyword' 时使用） */
    keyword?: string | null
    /** CRAWLER-01: 目标视频 ID（crawlMode='source-refetch' 时使用） */
    targetVideoId?: string | null
  }): Promise<{
    runId: string
    taskIds: string[]
    enqueuedSiteKeys: string[]
    skippedSiteKeys: string[]
  }> {
    const timeoutSeconds = Math.max(60, Math.min(input.timeoutSeconds ?? 900, 7200))
    const hoursAgo = Math.max(1, Math.min(input.hoursAgo ?? 24, 720))

    await ensureCrawlerQueueReady()

    const autoConfig = input.triggerType === 'schedule'
      ? await systemSettingsQueries.getAutoCrawlConfig(this.db)
      : null

    let targetSiteKeys: string[] = []
    if (input.triggerType === 'all') {
      const sites = await crawlerSitesQueries.listEnabledCrawlerSites(this.db)
      targetSiteKeys = sites.map((s) => s.key)
    } else if (input.triggerType === 'schedule') {
      const sites = autoConfig?.onlyEnabledSites
        ? await crawlerSitesQueries.listEnabledCrawlerSites(this.db)
        : await crawlerSitesQueries.listCrawlerSites(this.db)
      targetSiteKeys = sites.map((s) => s.key)
    } else {
      targetSiteKeys = Array.from(new Set((input.siteKeys ?? []).map((s) => s.trim()).filter(Boolean)))
    }

    const run = await crawlerRunsQueries.createRun(this.db, {
      triggerType: input.triggerType,
      mode: input.mode,
      requestedSiteCount: targetSiteKeys.length,
      timeoutSeconds,
      createdBy: input.createdBy ?? null,
      scheduleId: input.scheduleId ?? null,
      summary: { hoursAgo },
      crawlMode: input.crawlMode ?? 'batch',
      keyword: input.keyword ?? null,
      targetVideoId: input.targetVideoId ?? null,
    })

    const enqueuedSiteKeys: string[] = []
    const skippedSiteKeys: string[] = []
    const taskIds: string[] = []

    for (const siteKey of targetSiteKeys) {
      const site = await crawlerSitesQueries.findCrawlerSite(this.db, siteKey)
      if (!site) {
        skippedSiteKeys.push(siteKey)
        continue
      }

      const siteOverride = autoConfig?.perSiteOverrides?.[siteKey]
      if (input.triggerType === 'schedule' && siteOverride && !siteOverride.enabled) {
        skippedSiteKeys.push(siteKey)
        continue
      }

      if (site.disabled && (input.triggerType !== 'schedule' || autoConfig?.onlyEnabledSites !== false)) {
        skippedSiteKeys.push(siteKey)
        continue
      }

      const active = await crawlerTasksQueries.findActiveTaskBySite(this.db, siteKey)
      if (active) {
        // NOTE: queue_after_running 当前阶段先保守跳过，避免并发采集冲突。
        skippedSiteKeys.push(siteKey)
        continue
      }

      const taskMode = input.triggerType === 'schedule' && siteOverride && siteOverride.mode !== 'inherit'
        ? siteOverride.mode
        : input.mode

      const task = await crawlerTasksQueries.createTask(this.db, {
        type: taskMode === 'full' ? 'full-crawl' : 'incremental-crawl',
        sourceSite: siteKey,
        targetUrl: site.apiUrl,
        runId: run.id,
        triggerType: input.triggerType,
        timeoutSeconds,
      })
      taskIds.push(task.id)

      try {
        if (taskMode === 'full') {
          await enqueueFullCrawl(siteKey, task.id, run.id)
        } else {
          await enqueueIncrementalCrawl(siteKey, hoursAgo, task.id, run.id)
        }
        enqueuedSiteKeys.push(siteKey)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await crawlerTasksQueries.updateTaskStatus(this.db, task.id, 'failed', {
          error: 'QUEUE_ENQUEUE_FAILED',
          message,
        })
        skippedSiteKeys.push(siteKey)
        await this.log({
          taskId: task.id,
          sourceSite: siteKey,
          level: 'error',
          stage: 'run.task.enqueue_failed',
          message: '批次子任务入队失败',
          details: { runId: run.id, error: message },
        })
      }
    }

    await crawlerRunsQueries.setRunEnqueueStats(this.db, run.id, {
      enqueued: enqueuedSiteKeys.length,
      skipped: skippedSiteKeys.length,
      summary: {
        enqueuedSiteKeys,
        skippedSiteKeys,
      },
    })
    await crawlerRunsQueries.syncRunStatusFromTasks(this.db, run.id)

    return {
      runId: run.id,
      taskIds,
      enqueuedSiteKeys,
      skippedSiteKeys,
    }
  }
}
