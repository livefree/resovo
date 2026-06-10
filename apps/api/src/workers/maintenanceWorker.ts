/**
 * maintenanceWorker.ts — 维护任务队列消费者
 * CHG-383: 处理 maintenance-queue 中的后台维护任务
 * CHG-388: 新增 verify-published-sources job type
 * CHG-401: 新增 reconcile-search-index job type
 */

import { maintenanceQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { StagingPublishService } from '@/api/services/StagingPublishService'
import { SourceVerificationService } from '@/api/services/SourceVerificationService'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'
import { bulkSyncSourceCheckStatus } from '@/api/db/queries/videos'
import { deleteFetchLogBefore } from '@/api/db/queries/external-fetch-log'
import { deleteExpiredNotifications } from '@/api/db/queries/notifications'
import { baseLogger, withJob } from '@/api/lib/logger'
import { DbTaskRunReporter } from '@/api/services/TaskRunReporter'
import { runMaintenanceJobWithReporter } from '@/api/workers/maintenanceWorker.taskrun'
import type pino from 'pino'

const workerLog = baseLogger.child({ worker: 'maintenance-worker' })

// ── 任务类型 ──────────────────────────────────────────────────────

export type MaintenanceJobType =
  | 'auto-publish-staging'
  | 'verify-published-sources'
  | 'verify-staging-sources'
  | 'reconcile-search-index'
  | 'purge-external-fetch-log'
  | 'purge-expired-notifications'

export interface MaintenanceJobData {
  type: MaintenanceJobType
  /** auto-publish-staging: 单批次最大发布数量（default 50） */
  maxBatch?: number
  /** verify-published-sources: 单批次最大检测数量（default 50） */
  batchLimit?: number
  /** verify-staging-sources: 单批次最大同步数量（default 200） */
  stagingBatchLimit?: number
  /** reconcile-search-index: 单批次最大同步数量（default 100） */
  reconcileBatchLimit?: number
  /** purge-external-fetch-log: 保留天数（default 30，ADR-188 D-188-7） */
  purgeRetentionDays?: number
}

export interface MaintenanceJobResult {
  type: MaintenanceJobType
  durationMs: number
  [key: string]: unknown
}

// ── Worker ────────────────────────────────────────────────────────

// INFRA-14 F6：增 jobLog 参数，4 处 'job done' 改为 jobLog（含 job_id 上下文）
async function processMaintenanceJob(
  data: MaintenanceJobData,
  jobLog: pino.Logger,
): Promise<MaintenanceJobResult> {
  const startAt = Date.now()

  switch (data.type) {
    case 'auto-publish-staging': {
      const svc = new StagingPublishService(db)
      const { published, skipped } = await svc.publishReadyBatch(data.maxBatch ?? 50)
      const durationMs = Date.now() - startAt
      jobLog.info({ stage: 'auto-publish-staging', published, skipped, duration_ms: durationMs }, 'job done')
      return { type: data.type, durationMs, published, skipped }
    }
    case 'verify-published-sources': {
      const svc = new SourceVerificationService(db)
      const stats = await svc.verifyPublishedSources(data.batchLimit ?? 50)
      const durationMs = Date.now() - startAt
      jobLog.info({ stage: 'verify-published-sources', ...stats, duration_ms: durationMs }, 'job done')
      return { type: data.type, durationMs, ...stats }
    }
    case 'verify-staging-sources': {
      // 从 video_sources.is_active 聚合回写暂存视频的 source_check_status，
      // 使 StagingTable 的 ready/blocked 状态反映当前真实源状态
      const updated = await bulkSyncSourceCheckStatus(db, 'staging', data.stagingBatchLimit ?? 200)
      const durationMs = Date.now() - startAt
      jobLog.info({ stage: 'verify-staging-sources', updated, duration_ms: durationMs }, 'job done')
      return { type: data.type, durationMs, updated }
    }
    case 'reconcile-search-index': {
      // CHG-401: 补全 DB 已上架但 ES 索引缺失/过期的视频文档
      // CHG-411: 同时修复漏下架/漏删除的旧 ES 文档
      const svc = new VideoIndexSyncService(db, es)
      const [publishedResult, staleResult] = await Promise.all([
        svc.reconcilePublished(data.reconcileBatchLimit ?? 100),
        svc.reconcileStale(),
      ])
      const durationMs = Date.now() - startAt
      jobLog.info({
        stage: 'reconcile-search-index',
        synced: publishedResult.synced,
        fixed: staleResult.fixed,
        deleted: staleResult.deleted,
        errors: publishedResult.errors + staleResult.errors,
        duration_ms: durationMs,
      }, 'job done')
      return {
        type: data.type, durationMs,
        synced: publishedResult.synced,
        fixed: staleResult.fixed,
        deleted: staleResult.deleted,
        errors: publishedResult.errors + staleResult.errors,
      }
    }
    case 'purge-external-fetch-log': {
      // ADR-188 D-188-7：external_fetch_log 保留 30 天，删早于 cutoff 的采集流水（防无界增长）
      const retentionDays = data.purgeRetentionDays ?? 30
      const cutoff = new Date(Date.now() - retentionDays * 24 * 3600_000).toISOString()
      const deleted = await deleteFetchLogBefore(db, cutoff)
      const durationMs = Date.now() - startAt
      jobLog.info({ stage: 'purge-external-fetch-log', deleted, retentionDays, duration_ms: durationMs }, 'job done')
      return { type: data.type, durationMs, deleted }
    }
    case 'purge-expired-notifications': {
      // ADR-195 D-195-4：物理删除已过期通知（expires_at IS NOT NULL AND <= NOW()）；
      // notification_reads 经 FK ON DELETE CASCADE 级联、cursor 不受影响。NULL=永久永不删。
      const deleted = await deleteExpiredNotifications(db, new Date().toISOString())
      const durationMs = Date.now() - startAt
      jobLog.info({ stage: 'purge-expired-notifications', deleted, duration_ms: durationMs }, 'job done')
      return { type: data.type, durationMs, deleted }
    }
    default: {
      const never: never = data.type
      throw new Error(`Unknown maintenance job type: ${String(never)}`)
    }
  }
}

// ADR-194 D-194-5：maintenance 作业 run 级登记 task_runs（模块级单实例，同 worker 用模块级 db 范式）
const taskRunReporter = new DbTaskRunReporter(db)

export function registerMaintenanceWorker(): void {
  maintenanceQueue.process(1, async (job) => {
    const data = job.data as MaintenanceJobData
    const jobLog = withJob(workerLog, job)
    // run 级登记包裹：start→执行→finish(success+digest)/catch-finish(failed)+rethrow（保 bull 失败语义，D-194-5）
    return runMaintenanceJobWithReporter(
      taskRunReporter,
      data.type,
      String(job.id),
      () => processMaintenanceJob(data, jobLog),
    )
  })
  workerLog.info({ concurrency: 1 }, 'registered')
}
