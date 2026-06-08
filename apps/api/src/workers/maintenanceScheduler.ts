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
// CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.3 / ADR-146：审核积压超阈值 webhook
import { WebhookDispatcher, SYSTEM_ACTOR_ID } from '@/api/services/WebhookDispatcher'
import { AuditLogService } from '@/api/services/AuditLogService'
// CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.4 / ADR-146：R2 quota 软上限告警
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const schedulerLog = baseLogger.child({ worker: 'maintenance-scheduler' })

const TICK_MS = 30 * 60_000                  // 30 分钟（auto-publish-staging）
const VERIFY_TICK_MS = 60 * 60_000           // 60 分钟（verify-published-sources）
const STAGING_VERIFY_TICK_MS = 8 * 3600_000  // 8 小时（verify-staging-sources）
const RECONCILE_TICK_MS = 24 * 3600_000      // 24 小时（reconcile-search-index）
const PURGE_FETCH_LOG_TICK_MS = 24 * 3600_000  // 24 小时（external_fetch_log 30 天 purge，ADR-188 D-188-7）
const PENDING_THRESHOLD_TICK_MS = 60 * 60_000  // 1 小时（CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.3 / ADR-146）
const PENDING_THRESHOLD_DEBOUNCE_MS = 60 * 60_000  // 1 小时 debounce（防风暴 ADR-146 R-146-3）
// CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.4 / ADR-146 D-146-7 #2：R2 quota 软上限告警
const R2_QUOTA_TICK_MS = 6 * 3600_000             // 6 小时（R2 list 较慢，频率低于 pending check）
const R2_QUOTA_DEBOUNCE_MS = 12 * 3600_000        // 12 小时 debounce（防风暴 R-146-3）
const R2_QUOTA_DEFAULT_THRESHOLD_BYTES = 50 * 1024 * 1024 * 1024  // 50 GB
const R2_QUOTA_ALERT_PERCENT = 80                 // > 80% 软上限触发
const R2_LIST_MAX_ITERATIONS = 100                // 10 万 key 上限保护；超出 partial 数据告警

let schedulerTimer: NodeJS.Timeout | null = null
let verifyTimer: NodeJS.Timeout | null = null
let stagingVerifyTimer: NodeJS.Timeout | null = null
let reconcileTimer: NodeJS.Timeout | null = null
let pendingThresholdTimer: NodeJS.Timeout | null = null
let r2QuotaTimer: NodeJS.Timeout | null = null
let purgeFetchLogTimer: NodeJS.Timeout | null = null
let tickRunning = false
let verifyTickRunning = false
let stagingVerifyTickRunning = false
let reconcileTickRunning = false
let pendingThresholdTickRunning = false
let r2QuotaTickRunning = false
let purgeFetchLogTickRunning = false

// CW1-E-EP step 2 / ADR-152 R-152-2：lastRunAt 记录（intervalMs 推算 nextRunAt 用）
// 各 timer 在执行前赋值；registeredAt 作为 lastRunAt=null 时的回退基准
const registeredAt = new Date().toISOString()
const lastRunAt: Record<string, string | null> = {
  'auto-publish-staging': null,
  'verify-published-sources': null,
  'verify-staging-sources': null,
  'reconcile-search-index': null,
  'pending-threshold-check': null,
  'r2-quota-check': null,
  'purge-external-fetch-log': null,
}

async function runMaintenanceTick(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  lastRunAt['auto-publish-staging'] = new Date().toISOString()
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
  lastRunAt['verify-published-sources'] = new Date().toISOString()
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
  lastRunAt['verify-staging-sources'] = new Date().toISOString()
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
  lastRunAt['reconcile-search-index'] = new Date().toISOString()
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

/**
 * ADR-188 D-188-7：external_fetch_log 30 天 purge（采集流水防无界增长）。
 * 入共享 maintenanceQueue（DELETE 短任务，不阻塞 concurrency=1）；daily tick。
 */
async function runPurgeFetchLogTick(): Promise<void> {
  if (purgeFetchLogTickRunning) return
  purgeFetchLogTickRunning = true
  lastRunAt['purge-external-fetch-log'] = new Date().toISOString()
  try {
    const jobData: MaintenanceJobData = { type: 'purge-external-fetch-log', purgeRetentionDays: 30 }
    await maintenanceQueue.add(jobData, {
      jobId: `purge-external-fetch-log-${Date.now()}`,
      removeOnComplete: 10,
      removeOnFail: 5,
    })
    schedulerLog.info({ stage: 'purge-external-fetch-log' }, 'enqueued')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'purge-external-fetch-log' }, 'tick failed')
  } finally {
    purgeFetchLogTickRunning = false
  }
}

/**
 * CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.3 / ADR-146：审核积压超阈值 webhook
 * - 直接执行不入 queue（轻量 SQL count + KV read/write + dispatcher.enqueue 异步）
 * - 1h debounce KV `notification_pending_last_alert` 防风暴（R-146-3）
 * - 阈值 KV `notification_pending_threshold` 默认 50；webhookEnabled+订阅 enum 由 dispatcher 内部判断
 */
async function runPendingThresholdTick(): Promise<void> {
  if (pendingThresholdTickRunning) return
  pendingThresholdTickRunning = true
  lastRunAt['pending-threshold-check'] = new Date().toISOString()
  try {
    // 1. 查 KV 阈值（默认 50）
    const thresholdRaw = await systemSettingsQueries.getSetting(db, 'notification_pending_threshold')
    const threshold = thresholdRaw ? Number.parseInt(thresholdRaw, 10) : 50
    if (!Number.isFinite(threshold) || threshold <= 0) return

    // 2. 查当前 pending count
    const countRes = await db.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM videos
       WHERE review_status = 'pending_review' AND deleted_at IS NULL`,
    )
    const pendingCount = Number.parseInt(countRes.rows[0]?.c ?? '0', 10)
    if (pendingCount <= threshold) return

    // 3. 1h debounce check
    const lastAlertRaw = await systemSettingsQueries.getSetting(db, 'notification_pending_last_alert')
    if (lastAlertRaw) {
      const lastAlertMs = Number.parseInt(lastAlertRaw, 10)
      if (Number.isFinite(lastAlertMs) && Date.now() - lastAlertMs < PENDING_THRESHOLD_DEBOUNCE_MS) {
        return  // debounce 窗口内不触发
      }
    }

    // 4. 触发 webhook + 更新 last_alert KV
    const dispatcher = new WebhookDispatcher(db, new AuditLogService(db))
    dispatcher.enqueue('moderation.pending.threshold', {
      pendingCount,
      threshold,
      checkedAt: new Date().toISOString(),
    }, SYSTEM_ACTOR_ID)
    await systemSettingsQueries.setSetting(db, 'notification_pending_last_alert', String(Date.now()))
    schedulerLog.info({ pendingCount, threshold }, 'pending threshold webhook triggered')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'pending-threshold-check' }, 'tick failed')
  } finally {
    pendingThresholdTickRunning = false
  }
}

/**
 * CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.4 / ADR-146 D-146-7 #2：R2 quota 软上限告警
 * - ListObjectsV2 分页累加 Size（@aws-sdk/client-s3 已装，零新依赖）
 * - bucket 取 R2_IMAGES_BUCKET（图片是主用量；字幕远小）；未配 R2_* env 跳过
 * - 12h debounce KV `notification_r2_last_alert` 防风暴（R-146-3）
 * - 阈值 KV `notification_r2_quota_threshold_bytes` 默认 50 GB；usagePercent > 80% 触发
 * - payload 对齐 ADR-146 D-146-7：{ usagePercent, usageBytes, threshold, bucket, checkedAt }
 */
async function runR2QuotaTick(): Promise<void> {
  if (r2QuotaTickRunning) return
  r2QuotaTickRunning = true
  lastRunAt['r2-quota-check'] = new Date().toISOString()
  try {
    const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return
    const bucket = process.env.R2_IMAGES_BUCKET ?? 'resovo-images'

    const thresholdRaw = await systemSettingsQueries.getSetting(db, 'notification_r2_quota_threshold_bytes')
    const threshold = thresholdRaw ? Number.parseInt(thresholdRaw, 10) : R2_QUOTA_DEFAULT_THRESHOLD_BYTES
    if (!Number.isFinite(threshold) || threshold <= 0) return

    const client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
    let usageBytes = 0
    let continuationToken: string | undefined
    let iterations = 0
    let truncatedByLimit = false
    do {
      const res = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }))
      for (const obj of res.Contents ?? []) {
        usageBytes += obj.Size ?? 0
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
      iterations += 1
      if (continuationToken && iterations >= R2_LIST_MAX_ITERATIONS) {
        truncatedByLimit = true
        break
      }
    } while (continuationToken)

    const usagePercent = (usageBytes / threshold) * 100
    if (usagePercent < R2_QUOTA_ALERT_PERCENT) return

    const lastAlertRaw = await systemSettingsQueries.getSetting(db, 'notification_r2_last_alert')
    if (lastAlertRaw) {
      const lastAlertMs = Number.parseInt(lastAlertRaw, 10)
      if (Number.isFinite(lastAlertMs) && Date.now() - lastAlertMs < R2_QUOTA_DEBOUNCE_MS) return
    }

    const dispatcher = new WebhookDispatcher(db, new AuditLogService(db))
    dispatcher.enqueue('storage.r2.alert', {
      usagePercent: Number(usagePercent.toFixed(2)),
      usageBytes,
      threshold,
      bucket,
      checkedAt: new Date().toISOString(),
    }, SYSTEM_ACTOR_ID)
    await systemSettingsQueries.setSetting(db, 'notification_r2_last_alert', String(Date.now()))
    schedulerLog.info({ usageBytes, threshold, usagePercent, bucket, truncatedByLimit }, 'R2 quota webhook triggered')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'r2-quota-check' }, 'tick failed')
  } finally {
    r2QuotaTickRunning = false
  }
}

export interface SchedulerInfo {
  name: string
  enabled: boolean
  intervalMs: number
  /** CW1-E-EP step 2 / ADR-152 R-152-2：上次执行时间（ISO） / null = 尚未执行过 */
  lastRunAt: string | null
  /** CW1-E-EP step 2 / ADR-152 R-152-2：下次预期执行时间（ISO）。
   *  计算公式：(lastRunAt ?? registeredAt) + intervalMs
   *  单 timer parse 失败时 skip + warn，不阻塞主响应。 */
  nextRunAt: string
}

/** CHG-408 / CW1-E-EP step 2: 返回各定时器当前状态（含 lastRunAt + nextRunAt） */
export function getSchedulerStatus(): SchedulerInfo[] {
  const globalEnabled = process.env.MAINTENANCE_SCHEDULER_ENABLED !== 'false'

  function computeNextRunAt(name: string, intervalMs: number): string {
    const last = lastRunAt[name]
    const base = last ?? registeredAt
    try {
      return new Date(Date.parse(base) + intervalMs).toISOString()
    } catch {
      schedulerLog.warn({ name, base }, '[getSchedulerStatus] failed to parse base time; using registeredAt fallback')
      return new Date(Date.parse(registeredAt) + intervalMs).toISOString()
    }
  }

  return [
    { name: 'auto-publish-staging',     enabled: globalEnabled && schedulerTimer != null,        intervalMs: TICK_MS,                 lastRunAt: lastRunAt['auto-publish-staging'],     nextRunAt: computeNextRunAt('auto-publish-staging', TICK_MS) },
    { name: 'verify-published-sources', enabled: globalEnabled && verifyTimer != null,            intervalMs: VERIFY_TICK_MS,          lastRunAt: lastRunAt['verify-published-sources'], nextRunAt: computeNextRunAt('verify-published-sources', VERIFY_TICK_MS) },
    { name: 'verify-staging-sources',   enabled: globalEnabled && stagingVerifyTimer != null,     intervalMs: STAGING_VERIFY_TICK_MS,  lastRunAt: lastRunAt['verify-staging-sources'],   nextRunAt: computeNextRunAt('verify-staging-sources', STAGING_VERIFY_TICK_MS) },
    { name: 'reconcile-search-index',   enabled: globalEnabled && reconcileTimer != null,         intervalMs: RECONCILE_TICK_MS,       lastRunAt: lastRunAt['reconcile-search-index'],   nextRunAt: computeNextRunAt('reconcile-search-index', RECONCILE_TICK_MS) },
    { name: 'pending-threshold-check',  enabled: globalEnabled && pendingThresholdTimer != null,  intervalMs: PENDING_THRESHOLD_TICK_MS, lastRunAt: lastRunAt['pending-threshold-check'], nextRunAt: computeNextRunAt('pending-threshold-check', PENDING_THRESHOLD_TICK_MS) },
    { name: 'r2-quota-check',           enabled: globalEnabled && r2QuotaTimer != null,           intervalMs: R2_QUOTA_TICK_MS,        lastRunAt: lastRunAt['r2-quota-check'],           nextRunAt: computeNextRunAt('r2-quota-check', R2_QUOTA_TICK_MS) },
    { name: 'purge-external-fetch-log', enabled: globalEnabled && purgeFetchLogTimer != null,     intervalMs: PURGE_FETCH_LOG_TICK_MS, lastRunAt: lastRunAt['purge-external-fetch-log'], nextRunAt: computeNextRunAt('purge-external-fetch-log', PURGE_FETCH_LOG_TICK_MS) },
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

  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.3 / ADR-146：审核积压超阈值定时检查
  if (pendingThresholdTimer) return
  pendingThresholdTimer = setInterval(() => {
    void runPendingThresholdTick()
  }, PENDING_THRESHOLD_TICK_MS)
  schedulerLog.info({ interval_ms: PENDING_THRESHOLD_TICK_MS, stage: 'pending-threshold-check' }, 'registered')

  // CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.4 / ADR-146：R2 quota 软上限定时检查
  if (r2QuotaTimer) return
  r2QuotaTimer = setInterval(() => {
    void runR2QuotaTick()
  }, R2_QUOTA_TICK_MS)
  schedulerLog.info({ interval_ms: R2_QUOTA_TICK_MS, stage: 'r2-quota-check' }, 'registered')

  // ADR-188 D-188-7：external_fetch_log 30 天 purge（daily）
  if (purgeFetchLogTimer) return
  purgeFetchLogTimer = setInterval(() => {
    void runPurgeFetchLogTick()
  }, PURGE_FETCH_LOG_TICK_MS)
  schedulerLog.info({ interval_ms: PURGE_FETCH_LOG_TICK_MS, stage: 'purge-external-fetch-log' }, 'registered')
}
