/**
 * crawlerScheduler.ts — 定时自动采集调度器
 * CHG-36: Bull cron job，每日 03:00 执行增量采集
 *
 * 调度规则：
 *   - cron: '0 3 * * *'（每天凌晨 3:00）
 *   - 读 system_settings.auto_crawl_enabled；false 则跳过
 *   - 读 system_settings.auto_crawl_recent_only / auto_crawl_recent_days 决定模式
 */

import { crawlerQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

/** 注册定时采集 cron job */
export function registerCrawlerScheduler(): void {
  crawlerQueue.add(
    // 占位 job data — scheduler 每次触发时由 processor 决定实际行为
    { type: 'incremental-crawl', hoursAgo: 24 },
    {
      repeat: { cron: '0 3 * * *' },
      jobId: 'auto-crawl-daily',
      removeOnComplete: 5,
      removeOnFail: 5,
    },
  ).then(() => {
    process.stderr.write('[crawler-scheduler] daily cron job registered (0 3 * * *)\n')
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[crawler-scheduler] failed to register cron: ${msg}\n`)
  })

  // 在任务实际执行前读取 auto_crawl_enabled 决定是否跳过
  crawlerQueue.on('active', async (job) => {
    if (job.opts.jobId !== 'auto-crawl-daily') return
    try {
      const enabled = await systemSettingsQueries.getSetting(db, 'auto_crawl_enabled')
      if (enabled !== 'true') {
        // 自动采集已关闭，移动到完成状态（不做任何工作）
        await job.moveToCompleted('auto_crawl_disabled', true)
        process.stderr.write('[crawler-scheduler] auto_crawl_enabled=false, skipped\n')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[crawler-scheduler] failed to read settings: ${msg}\n`)
    }
  })
}
