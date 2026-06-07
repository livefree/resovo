/**
 * doubanCollectionsWorker.ts — 豆瓣热门合集采集队列消费者（ADR-187 D-187-3/8）
 *
 * 独立队列（doubanCollectionsQueue）隔离背压：refresh 长任务（16 合集分页 + 礼貌延时
 * 实测 60–90s）不阻塞 concurrency=1 的 maintenanceQueue（同 homeAutofillQueue 隔离范式）。
 * worker 只委托 refreshAllCollections（注册表驱动分页全量 + 全量替换 + empty_guard）。
 */

import { doubanCollectionsQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { refreshAllCollections } from '@/api/services/douban-collections/refresh'
import { baseLogger, withJob } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'douban-collections-worker' })

export interface DoubanCollectionsJobData {
  kind: 'refresh'
}

export function registerDoubanCollectionsWorker(): void {
  // concurrency 1：单 refresh 串行（jobId `refresh-douban-collections` 幂等已防并发入队）
  doubanCollectionsQueue.process(1, async (job) => {
    const jobLog = withJob(workerLog, job)
    const startAt = Date.now()
    const results = await refreshAllCollections(db)
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
