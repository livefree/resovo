/**
 * imageBackfillWorker.ts — 存量图片回填调度器
 *
 * 分批（1000/batch）将 pending_review 的图片 URL 入队：
 *   - 先入 health-check 队（imageHealthWorker 处理）
 *   - 再入 blurhash-extract 队（imageBlurhashWorker 处理）
 * 批次间不 sleep——由 Bull 并发控制背压；可中断恢复（下次运行续从 offset 0 扫）
 */

import { imageHealthQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import {
  listPendingImageUrls,
  listMissingBlurhashUrls,
} from '@/api/db/queries/imageHealth'
import { baseLogger, withJob } from '@/api/lib/logger'
import type pino from 'pino'

const workerLog = baseLogger.child({ worker: 'backfill-worker' })

const BATCH_SIZE = 1000

export interface BackfillResult {
  healthCheckEnqueued: number
  blurhashEnqueued: number
}

async function enqueueBatch(
  jobType: 'health-check' | 'blurhash-extract',
  rows: Awaited<ReturnType<typeof listPendingImageUrls>>
): Promise<number> {
  if (rows.length === 0) return 0

  const jobs = rows.map(row => ({
    name: jobType,
    data: { type: jobType, ...row },
    opts: {
      jobId: `${jobType}-${row.catalogId}-${row.kind}`,
      removeOnComplete: 50,
    },
  }))

  await imageHealthQueue.addBulk(jobs)
  return rows.length
}

// INFRA-14 F7：runImageBackfill 接 jobLog 参数；默认 fallback 到 workerLog 兼容
// 现有调用方（runImageBackfill 也被其他 service 直调，非仅 Bull processor）
export async function runImageBackfill(
  batchSize = BATCH_SIZE,
  jobLog: pino.Logger = workerLog,
): Promise<BackfillResult> {
  let healthTotal = 0
  let blurhashTotal = 0
  let offset = 0

  // 健康检查回填：扫 pending_review
  while (true) {
    const rows = await listPendingImageUrls(db, batchSize, offset)
    if (rows.length === 0) break
    healthTotal += await enqueueBatch('health-check', rows)
    offset += rows.length
    if (rows.length < batchSize) break
  }

  // BlurHash 回填：扫 ok 但 blurhash 为空
  offset = 0
  while (true) {
    const rows = await listMissingBlurhashUrls(db, batchSize, offset)
    if (rows.length === 0) break
    blurhashTotal += await enqueueBatch('blurhash-extract', rows)
    offset += rows.length
    if (rows.length < batchSize) break
  }

  jobLog.info({ health_check_enqueued: healthTotal, blurhash_enqueued: blurhashTotal }, 'backfill done')

  return { healthCheckEnqueued: healthTotal, blurhashEnqueued: blurhashTotal }
}

/** 手动触发一次存量回填（用于管理员操作或 scheduler 调用） */
export async function enqueueBackfillJob(): Promise<void> {
  // INFRA-14 F7：用 add() 返回的 Bull.Job 取真实 job_id 写日志
  const bullJob = await imageHealthQueue.add(
    'backfill',
    { type: 'backfill', catalogId: '', videoId: '', kind: 'poster', url: '' },
    { jobId: `backfill-${Date.now()}`, removeOnComplete: 5 }
  )
  workerLog.info({ job_id: String(bullJob.id) }, 'backfill job enqueued')
}

/** 注册 backfill job 处理器（直接在进程内运行，不走网络） */
export function registerBackfillWorker(): void {
  // INFRA-14 F7：processor 接 job → 派生 withJob 传给 runImageBackfill
  imageHealthQueue.process('backfill', 1, async (job) => {
    await runImageBackfill(BATCH_SIZE, withJob(workerLog, job))
  })
  workerLog.info('registered')
}
