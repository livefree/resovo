/**
 * crawlerScheduler.ts — 定时自动采集调度器
 * CHG-36: Bull cron job，按配置执行每日自动采集
 *
 * 调度规则：
 *   - cron: '* * * * *'（每分钟 tick）
 *   - 读取统一 auto-crawl 配置，命中 dailyTime 且当日未触发时创建一次批次
 */

import { crawlerQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'

/** 注册定时采集 cron job */
export function registerCrawlerScheduler(): void {
  const runService = new CrawlerRunService(db)
  crawlerQueue.add(
    // 占位 job data — scheduler 每次触发时由 processor 决定实际行为
    { type: 'incremental-crawl', hoursAgo: 24 },
    {
      repeat: { cron: '* * * * *' },
      jobId: 'auto-crawl-tick',
      removeOnComplete: 5,
      removeOnFail: 5,
    },
  ).then(() => {
    process.stderr.write('[crawler-scheduler] tick cron job registered (* * * * *)\n')
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[crawler-scheduler] failed to register cron: ${msg}\n`)
  })

  // 在任务执行前读取统一 auto-crawl 配置，命中时间窗时创建 run
  crawlerQueue.on('active', async (job) => {
    if (job.opts.jobId !== 'auto-crawl-tick') return
    try {
      const config = await systemSettingsQueries.getAutoCrawlConfig(db)
      if (!config.globalEnabled) {
        await job.moveToCompleted('auto_crawl_disabled', true)
        process.stderr.write('[crawler-scheduler] auto_crawl_enabled=false, skipped\n')
        return
      }

      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const current = `${hh}:${mm}`
      if (current !== config.dailyTime) {
        await job.moveToCompleted('auto_crawl_not_time', true)
        return
      }

      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const lastTriggeredDate = await systemSettingsQueries.getSetting(db, 'auto_crawl_last_trigger_date')
      if (lastTriggeredDate === today) {
        await job.moveToCompleted('auto_crawl_already_triggered_today', true)
        return
      }

      const mode = config.defaultMode
      const hoursAgo = mode === 'incremental' ? 24 : undefined

      await runService.createAndEnqueueRun({
        triggerType: 'schedule',
        mode,
        hoursAgo,
        timeoutSeconds: 1200,
        scheduleId: 'auto-crawl-daily',
      })
      await systemSettingsQueries.setSetting(db, 'auto_crawl_last_trigger_date', today)
      await job.moveToCompleted('auto_crawl_run_created', true)
      process.stderr.write(`[crawler-scheduler] scheduled run created (${mode}, dailyTime=${config.dailyTime})\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[crawler-scheduler] failed to read settings: ${msg}\n`)
    }
  })

  // 每分钟超时扫描一次，避免单任务长期无响应
  setInterval(() => {
    void (async () => {
      try {
        const timedOut = await crawlerTasksQueries.markTimedOutRunningTasks(db)
        if (timedOut > 0) {
          process.stderr.write(`[crawler-scheduler] timeout watchdog marked ${timedOut} tasks as timeout\n`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`[crawler-scheduler] timeout watchdog failed: ${msg}\n`)
      }
    })()
  }, 60_000)
}
