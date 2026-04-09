/**
 * maintenanceWorker.ts — 维护任务队列消费者
 * CHG-383: 处理 maintenance-queue 中的后台维护任务
 */

import { maintenanceQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { StagingPublishService } from '@/api/services/StagingPublishService'

// ── 任务类型 ──────────────────────────────────────────────────────

export type MaintenanceJobType = 'auto-publish-staging'

export interface MaintenanceJobData {
  type: MaintenanceJobType
  /** auto-publish-staging: 单批次最大发布数量（default 50） */
  maxBatch?: number
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
