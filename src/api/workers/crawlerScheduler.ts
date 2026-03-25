/**
 * crawlerScheduler.ts — 定时自动采集调度器
 *
 * 重要约束：
 * - scheduler 仅负责“创建 run + enqueue tasks”
 * - 不向 crawler-queue 写入可被 worker 误消费的占位 crawl job
 */

import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'

const TICK_MS = 60_000
let schedulerTimer: NodeJS.Timeout | null = null
let schedulerTickRunning = false

async function runSchedulerTick(): Promise<void> {
  if (schedulerTickRunning) return
  schedulerTickRunning = true
  try {
    const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
    if (freeze === 'true') {
      return
    }

    const config = await systemSettingsQueries.getAutoCrawlConfig(db)
    if (!config.globalEnabled) return

    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const current = `${hh}:${mm}`
    if (current !== config.dailyTime) return

    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const lastTriggeredDate = await systemSettingsQueries.getSetting(db, 'auto_crawl_last_trigger_date')
    if (lastTriggeredDate === today) return

    const runService = new CrawlerRunService(db)
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
    process.stderr.write(`[crawler-scheduler] scheduled run created (${mode}, dailyTime=${config.dailyTime})\n`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[crawler-scheduler] tick failed: ${msg}\n`)
  } finally {
    schedulerTickRunning = false
  }
}

export async function runTimeoutWatchdogTick(): Promise<void> {
  try {
    const timedOut = await crawlerTasksQueries.markTimedOutRunningTasksWithRunIds(db)
    const stale = await crawlerTasksQueries.markStaleHeartbeatRunningTasksWithRunIds(db)
    const affectedRunIds = Array.from(new Set([...timedOut.runIds, ...stale.runIds]))
    for (const runId of affectedRunIds) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }
    if (timedOut.count > 0) {
      process.stderr.write(`[crawler-scheduler] timeout watchdog marked ${timedOut.count} tasks as timeout\n`)
    }
    if (stale.count > 0) {
      process.stderr.write(`[crawler-scheduler] heartbeat watchdog marked ${stale.count} stale running tasks\n`)
    }
    if (affectedRunIds.length > 0) {
      process.stderr.write(`[crawler-scheduler] watchdog synced ${affectedRunIds.length} affected runs\n`)
    }

    // 对所有活跃 run 执行周期性状态同步，消除监控列表滞后（最大 60s）
    const activeRunIds = await crawlerRunsQueries.listActiveRunIds(db)
    for (const runId of activeRunIds) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }
    if (activeRunIds.length > 0) {
      process.stderr.write(`[crawler-scheduler] periodic sync applied to ${activeRunIds.length} active runs\n`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[crawler-scheduler] timeout watchdog failed: ${msg}\n`)
  }
}

/** 注册定时采集 scheduler（进程内 tick） */
export function registerCrawlerScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runSchedulerTick()
    void runTimeoutWatchdogTick()
  }, TICK_MS)
  process.stderr.write('[crawler-scheduler] interval scheduler registered (60s)\n')
}
