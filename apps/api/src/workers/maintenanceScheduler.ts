/**
 * maintenanceScheduler.ts — 维护任务定时调度器
 * CHG-383: 定时检查是否需要触发 auto-publish-staging
 * CHG-393: 间隔改为 30 分钟（M1 验收要求）；null 视为已启用（显式 'false' 才禁用）
 * CHG-388: 新增 verify-published-sources 独立 60min 定时器
 * CHG-399: 新增 verify-staging-sources 独立 8h 定时器
 * CHG-401: 新增 reconcile-search-index 独立 24h 定时器
 */

import { maintenanceQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import type { MaintenanceJobData } from '@/api/workers/maintenanceWorker'
import { baseLogger } from '@/api/lib/logger'

const schedulerLog = baseLogger.child({ worker: 'maintenance-scheduler' })

const TICK_MS = 30 * 60_000                  // 30 分钟（auto-publish-staging）
const VERIFY_TICK_MS = 60 * 60_000           // 60 分钟（verify-published-sources）
const STAGING_VERIFY_TICK_MS = 8 * 3600_000  // 8 小时（verify-staging-sources）
const RECONCILE_TICK_MS = 24 * 3600_000      // 24 小时（reconcile-search-index）

let schedulerTimer: NodeJS.Timeout | null = null
let verifyTimer: NodeJS.Timeout | null = null
let stagingVerifyTimer: NodeJS.Timeout | null = null
let reconcileTimer: NodeJS.Timeout | null = null
let tickRunning = false
let verifyTickRunning = false
let stagingVerifyTickRunning = false
let reconcileTickRunning = false

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
    schedulerLog.info({ stage: 'auto-publish-staging' }, 'enqueued')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'auto-publish-staging' }, 'tick failed')
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
    schedulerLog.info({ stage: 'verify-published-sources' }, 'enqueued')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'verify-published-sources' }, 'tick failed')
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
    schedulerLog.info({ stage: 'verify-staging-sources' }, 'enqueued')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'verify-staging-sources' }, 'tick failed')
  } finally {
    stagingVerifyTickRunning = false
  }
}

async function runReconcileTick(): Promise<void> {
  if (reconcileTickRunning) return
  reconcileTickRunning = true
  try {
    const jobData: MaintenanceJobData = { type: 'reconcile-search-index', reconcileBatchLimit: 100 }
    await maintenanceQueue.add(jobData, {
      jobId: `reconcile-search-index-${Date.now()}`,
      removeOnComplete: 10,
      removeOnFail: 5,
    })
    schedulerLog.info({ stage: 'reconcile-search-index' }, 'enqueued')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'reconcile-search-index' }, 'tick failed')
  } finally {
    reconcileTickRunning = false
  }
}

export interface SchedulerInfo {
  name: string
  enabled: boolean
  intervalMs: number
}

/** CHG-408: 返回各定时器当前状态，供 GET /admin/system/scheduler-status 使用 */
export function getSchedulerStatus(): SchedulerInfo[] {
  const globalEnabled = process.env.MAINTENANCE_SCHEDULER_ENABLED !== 'false'
  return [
    { name: 'auto-publish-staging',    enabled: globalEnabled && schedulerTimer != null,       intervalMs: TICK_MS },
    { name: 'verify-published-sources', enabled: globalEnabled && verifyTimer != null,          intervalMs: VERIFY_TICK_MS },
    { name: 'verify-staging-sources',   enabled: globalEnabled && stagingVerifyTimer != null,   intervalMs: STAGING_VERIFY_TICK_MS },
    { name: 'reconcile-search-index',   enabled: globalEnabled && reconcileTimer != null,       intervalMs: RECONCILE_TICK_MS },
  ]
}

export function registerMaintenanceScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runMaintenanceTick()
  }, TICK_MS)
  schedulerLog.info({ interval_ms: TICK_MS, stage: 'auto-publish-staging' }, 'registered')

  if (verifyTimer) return
  verifyTimer = setInterval(() => {
    void runVerifyTick()
  }, VERIFY_TICK_MS)
  schedulerLog.info({ interval_ms: VERIFY_TICK_MS, stage: 'verify-published-sources' }, 'registered')

  if (stagingVerifyTimer) return
  stagingVerifyTimer = setInterval(() => {
    void runStagingVerifyTick()
  }, STAGING_VERIFY_TICK_MS)
  schedulerLog.info({ interval_ms: STAGING_VERIFY_TICK_MS, stage: 'verify-staging-sources' }, 'registered')

  if (reconcileTimer) return
  reconcileTimer = setInterval(() => {
    void runReconcileTick()
  }, RECONCILE_TICK_MS)
  schedulerLog.info({ interval_ms: RECONCILE_TICK_MS, stage: 'reconcile-search-index' }, 'registered')
}
