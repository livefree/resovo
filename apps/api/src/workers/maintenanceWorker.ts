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
import { baseLogger, withJob } from '@/api/lib/logger'
import type pino from 'pino'

const workerLog = baseLogger.child({ worker: 'maintenance-worker' })

// ── 任务类型 ──────────────────────────────────────────────────────

export type MaintenanceJobType =
  | 'auto-publish-staging'
  | 'verify-published-sources'
  | 'verify-staging-sources'
  | 'reconcile-search-index'

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
    default: {
      const never: never = data.type
      throw new Error(`Unknown maintenance job type: ${String(never)}`)
    }
  }
}

export function registerMaintenanceWorker(): void {
  maintenanceQueue.process(1, async (job) => {
    const data = job.data as MaintenanceJobData
    return processMaintenanceJob(data, withJob(workerLog, job))
  })
  workerLog.info({ concurrency: 1 }, 'registered')
}
