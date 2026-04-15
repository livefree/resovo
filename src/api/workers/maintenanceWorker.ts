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

async function processMaintenanceJob(
  data: MaintenanceJobData,
): Promise<MaintenanceJobResult> {
  const startAt = Date.now()

  switch (data.type) {
    case 'auto-publish-staging': {
      const svc = new StagingPublishService(db)
      const { published, skipped } = await svc.publishReadyBatch(data.maxBatch ?? 50)
      const durationMs = Date.now() - startAt
      process.stderr.write(
        `[maintenance-worker] auto-publish-staging: published=${published} skipped=${skipped} (${durationMs}ms)\n`,
      )
      return { type: data.type, durationMs, published, skipped }
    }
    case 'verify-published-sources': {
      const svc = new SourceVerificationService(db)
      const stats = await svc.verifyPublishedSources(data.batchLimit ?? 50)
      const durationMs = Date.now() - startAt
      process.stderr.write(
        `[maintenance-worker] verify-published-sources: unpublished=${stats.unpublished} ` +
        `refetchEnqueued=${stats.refetchEnqueued} skipped=${stats.skipped} failed=${stats.failed} (${durationMs}ms)\n`,
      )
      return { type: data.type, durationMs, ...stats }
    }
    case 'verify-staging-sources': {
      // 从 video_sources.is_active 聚合回写暂存视频的 source_check_status，
      // 使 StagingTable 的 ready/blocked 状态反映当前真实源状态
      const updated = await bulkSyncSourceCheckStatus(db, 'staging', data.stagingBatchLimit ?? 200)
      const durationMs = Date.now() - startAt
      process.stderr.write(
        `[maintenance-worker] verify-staging-sources: updated=${updated} (${durationMs}ms)\n`,
      )
      return { type: data.type, durationMs, updated }
    }
    case 'reconcile-search-index': {
      // CHG-401: 补全 DB 已上架但 ES 索引缺失/过期的视频文档
      const svc = new VideoIndexSyncService(db, es)
      const { synced, errors } = await svc.reconcilePublished(data.reconcileBatchLimit ?? 100)
      const durationMs = Date.now() - startAt
      process.stderr.write(
        `[maintenance-worker] reconcile-search-index: synced=${synced} errors=${errors} (${durationMs}ms)\n`,
      )
      return { type: data.type, durationMs, synced, errors }
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
    return processMaintenanceJob(data)
  })
  process.stderr.write('[maintenance-worker] registered (concurrency=1)\n')
}
