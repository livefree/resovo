/**
 * maintenanceScheduler.ts — 维护任务定时调度器
 * CHG-383: 定时检查是否需要触发 auto-publish-staging
 * CHG-393: 间隔改为 30 分钟（M1 验收要求）；null 视为已启用（显式 'false' 才禁用）
 * CHG-388: 新增 verify-published-sources 独立 60min 定时器
 * CHG-399: 新增 verify-staging-sources 独立 8h 定时器
 */

import { maintenanceQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import type { MaintenanceJobData } from '@/api/workers/maintenanceWorker'

const TICK_MS = 30 * 60_000               // 30 分钟（auto-publish-staging）
const VERIFY_TICK_MS = 60 * 60_000        // 60 分钟（verify-published-sources）
const STAGING_VERIFY_TICK_MS = 8 * 3600_000  // 8 小时（verify-staging-sources）

let schedulerTimer: NodeJS.Timeout | null = null
let verifyTimer: NodeJS.Timeout | null = null
let stagingVerifyTimer: NodeJS.Timeout | null = null
let tickRunning = false
let verifyTickRunning = false
let stagingVerifyTickRunning = false

async function runMaintenanceTick(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    const enabled = await systemSettingsQueries.getSetting(db, 'auto_publish_staging_enabled')
    // null（未初始化）视为已启用；只有显式设为 'false' 时才跳过
    if (enabled === 'false') return

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

async function runVerifyTick(): Promise<void> {
  if (verifyTickRunning) return
  verifyTickRunning = true
  try {
    const jobData: MaintenanceJobData = { type: 'verify-published-sources', batchLimit: 50 }
    await maintenanceQueue.add(jobData, {
      jobId: `verify-published-sources-${Date.now()}`,
      removeOnComplete: 10,
      removeOnFail: 5,
    })
    process.stderr.write('[maintenance-scheduler] enqueued verify-published-sources\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[maintenance-scheduler] verify tick failed: ${msg}\n`)
  } finally {
    verifyTickRunning = false
  }
}

async function runStagingVerifyTick(): Promise<void> {
  if (stagingVerifyTickRunning) return
  stagingVerifyTickRunning = true
  try {
    const jobData: MaintenanceJobData = { type: 'verify-staging-sources', stagingBatchLimit: 200 }
    await maintenanceQueue.add(jobData, {
      jobId: `verify-staging-sources-${Date.now()}`,
      removeOnComplete: 10,
      removeOnFail: 5,
    })
    process.stderr.write('[maintenance-scheduler] enqueued verify-staging-sources\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[maintenance-scheduler] staging verify tick failed: ${msg}\n`)
  } finally {
    stagingVerifyTickRunning = false
  }
}

export function registerMaintenanceScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runMaintenanceTick()
  }, TICK_MS)
  process.stderr.write('[maintenance-scheduler] registered (30min interval)\n')

  if (verifyTimer) return
  verifyTimer = setInterval(() => {
    void runVerifyTick()
  }, VERIFY_TICK_MS)
  process.stderr.write('[maintenance-scheduler] verify-published-sources registered (60min interval)\n')

  if (stagingVerifyTimer) return
  stagingVerifyTimer = setInterval(() => {
    void runStagingVerifyTick()
  }, STAGING_VERIFY_TICK_MS)
  process.stderr.write('[maintenance-scheduler] verify-staging-sources registered (8h interval)\n')
}
