/**
 * bangumiCollectionsWorker.ts — Bangumi 派生合集采集队列消费者（ADR-189 D-189-2）
 *
 * 独立队列（bangumiCollectionsQueue）隔离背压（同 douban-collections 范式）。
 * worker 只委托 refreshAllBangumiCollections（trending/ranking 全量替换 + calendar 一拉七写 + empty_guard）。
 */

import { bangumiCollectionsQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { refreshAllBangumiCollections } from '@/api/services/bangumi-collections/refresh'
import { baseLogger, withJob } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'bangumi-collections-worker' })

export interface BangumiCollectionsJobData {
  kind: 'refresh'
}

export function registerBangumiCollectionsWorker(): void {
  // concurrency 1：单 refresh 串行（jobId `refresh-bangumi-collections` 幂等已防并发入队）
  bangumiCollectionsQueue.process(1, async (job) => {
    const jobLog = withJob(workerLog, job)
    const startAt = Date.now()
    const results = await refreshAllBangumiCollections(db)
    const ok = results.filter((r) => r.status === 'ok').length
    const failed = results.filter((r) => r.status === 'failed').length
    const guarded = results.filter((r) => r.status === 'empty_guard').length
    const totalItems = results.reduce((sum, r) => sum + r.count, 0)
    const durationMs = Date.now() - startAt
    jobLog.info({ ok, failed, guarded, totalItems, duration_ms: durationMs }, 'refresh done')
    return { ok, failed, guarded, totalItems, durationMs }
  })
  workerLog.info({ concurrency: 1 }, 'registered')
}
