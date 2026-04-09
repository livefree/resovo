/**
 * maintenanceScheduler.ts — 维护任务定时调度器
 * CHG-383: 每 5 分钟检查是否需要触发 auto-publish-staging
 */

import { maintenanceQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import type { MaintenanceJobData } from '@/api/workers/maintenanceWorker'

const TICK_MS = 5 * 60_000   // 5 分钟
let schedulerTimer: NodeJS.Timeout | null = null
let tickRunning = false

async function runMaintenanceTick(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    const enabled = await systemSettingsQueries.getSetting(db, 'auto_publish_staging_enabled')
    if (enabled !== 'true') return

    // 防止短时间内重复入队：检查 queue 中是否已有等待中的 auto-publish-staging job
    const waitingCount = await maintenanceQueue.getWaitingCount()
    const activeCount = await maintenanceQueue.getActiveCount()
    if (waitingCount + activeCount > 0) return

    const jobData: MaintenanceJobData = { type: 'auto-publish-staging', maxBatch: 50 }
    await maintenanceQueue.add(jobData, {
      jobId: `auto-publish-staging-${Date.now()}`,
      removeOnComplete: 10,
      removeOnFail: 5,
    })
    process.stderr.write('[maintenance-scheduler] enqueued auto-publish-staging\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[maintenance-scheduler] tick failed: ${msg}\n`)
  } finally {
    tickRunning = false
  }
}

export function registerMaintenanceScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runMaintenanceTick()
  }, TICK_MS)
  process.stderr.write('[maintenance-scheduler] registered (5min interval)\n')
}
