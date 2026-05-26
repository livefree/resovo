/**
 * crawlerScheduler.ts — 定时自动采集调度器
 *
 * ADR-154 D-154-5 改动（Fix-D5 CW2-C-EP-A）：
 *   - runSchedulerTick 拆为 dispatch 模式（switch scheduleType）
 *   - 纯判定函数 checkDaily / checkInterval（无 IO，可独立单测）
 *   - persistTriggerMark（R-154-1：createRun 成功后才写锚点）
 *
 * 重要约束：
 * - scheduler 仅负责"创建 run + enqueue tasks"
 * - 不向 crawler-queue 写入可被 worker 误消费的占位 crawl job
 * - R-154-1：interval 锚点写入必须在 createRun 成功之后（防止 createRun 失败后跳窗口）
 */

import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import { baseLogger } from '@/api/lib/logger'
import type { AutoCrawlConfig } from '@/types'

const schedulerLog = baseLogger.child({ worker: 'crawler-scheduler' })

const TICK_MS = 60_000
let schedulerTimer: NodeJS.Timeout | null = null
let schedulerTickRunning = false

// ── 纯判定函数（无 IO，可独立单测）──────────────────────────────

/** D-154-5 §checkDaily：daily 模式触发判定 */
export function checkDaily(
  config: Pick<AutoCrawlConfig, 'dailyTime'>,
  now: Date,
  lastTriggerDate: string | null,
): boolean {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const current = `${hh}:${mm}`
  if (current !== config.dailyTime) return false

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (lastTriggerDate === today) return false  // 天级防重不变

  return true
}

/** D-154-5 §checkInterval：interval 模式触发判定 */
export function checkInterval(
  config: Pick<AutoCrawlConfig, 'intervalMinutes'>,
  now: Date,
  lastTriggerAt: Date | null,
): boolean {
  if (lastTriggerAt === null) return true  // 从未触发：立即触发

  const dueAt = lastTriggerAt.getTime() + config.intervalMinutes * 60_000
  return now.getTime() >= dueAt
}

// ── DB 辅助（有 IO）────────────────────────────────────────────

async function getLastTriggerDate(): Promise<string | null> {
  const val = await systemSettingsQueries.getSetting(db, 'auto_crawl_last_trigger_date')
  return val ?? null
}

async function getLastTriggerAt(): Promise<Date | null> {
  const val = await systemSettingsQueries.getSetting(db, 'auto_crawl_last_trigger_at')
  if (!val || val === '') return null
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

/** R-154-1：必须在 createRun 成功后调用，防止 createRun 抛错时锚点前进 */
async function persistTriggerMark(scheduleType: AutoCrawlConfig['scheduleType'], now: Date): Promise<void> {
  if (scheduleType === 'interval') {
    await systemSettingsQueries.setSetting(db, 'auto_crawl_last_trigger_at', now.toISOString())
  } else {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    await systemSettingsQueries.setSetting(db, 'auto_crawl_last_trigger_date', today)
  }
}

// ── 主 tick ────────────────────────────────────────────────────

async function runSchedulerTick(): Promise<void> {
  if (schedulerTickRunning) return
  schedulerTickRunning = true
  try {
    const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
    if (freeze === 'true') return

    const config = await systemSettingsQueries.getAutoCrawlConfig(db)
    if (!config.globalEnabled) return

    const now = new Date()

    // D-154-5：按 scheduleType dispatch 到纯判定函数
    let shouldTrigger: boolean
    if (config.scheduleType === 'interval') {
      shouldTrigger = checkInterval(config, now, await getLastTriggerAt())
    } else {
      // 默认 daily（向后兼容）
      shouldTrigger = checkDaily(config, now, await getLastTriggerDate())
    }

    if (!shouldTrigger) return

    // 触发：创建 run（先 createRun，再写锚点——R-154-1）
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

    // R-154-1：createRun 成功后才写锚点
    await persistTriggerMark(config.scheduleType, now)

    schedulerLog.info({ type: config.scheduleType, mode, interval_minutes: config.intervalMinutes }, 'scheduled run created')
  } catch (err) {
    schedulerLog.warn({ err }, 'tick failed')
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
      schedulerLog.warn({ count: timedOut.count }, 'timeout watchdog marked tasks as timeout')
    }
    if (stale.count > 0) {
      schedulerLog.warn({ count: stale.count }, 'heartbeat watchdog marked stale running tasks')
    }
    if (affectedRunIds.length > 0) {
      schedulerLog.info({ count: affectedRunIds.length }, 'watchdog synced affected runs')
    }

    // 对所有活跃 run 执行周期性状态同步，消除监控列表滞后（最大 60s）
    const activeRunIds = await crawlerRunsQueries.listActiveRunIds(db)
    for (const runId of activeRunIds) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }
    if (activeRunIds.length > 0) {
      schedulerLog.info({ count: activeRunIds.length }, 'periodic sync applied to active runs')
    }
  } catch (err) {
    schedulerLog.warn({ err }, 'timeout watchdog failed')
  }
}

/** 注册定时采集 scheduler（进程内 tick） */
export function registerCrawlerScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runSchedulerTick()
    void runTimeoutWatchdogTick()
  }, TICK_MS)
  schedulerLog.info({ interval_ms: TICK_MS }, 'registered')
}
