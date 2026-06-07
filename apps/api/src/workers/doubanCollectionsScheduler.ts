/**
 * doubanCollectionsScheduler.ts — 豆瓣热门合集采集定时调度（ADR-187 D-187-3/8）
 *
 * 6h tick 入队 refresh（热度榜无需高频）。**固定 jobId `refresh-douban-collections`
 * 幂等键**：上一轮 job 仍在 waiting/active 时再入队静默跳过（防重复入队，homeAutofill 同范式）。
 * per-add removeOnComplete/removeOnFail: true 释放 jobId（定频重入前提——failed 残留 jobId
 * 会永久阻塞后续入队）。Redis/Bull 不可用 → warn 不阻塞进程。
 */

import { doubanCollectionsQueue } from '@/api/lib/queue'
import type { DoubanCollectionsJobData } from '@/api/workers/doubanCollectionsWorker'
import { baseLogger } from '@/api/lib/logger'

const schedulerLog = baseLogger.child({ worker: 'douban-collections-scheduler' })

/** 6 小时（ADR-187 D-187-3：热度榜无需高频） */
export const DOUBAN_COLLECTIONS_TICK_MS = 6 * 3600_000

/** 固定 jobId 幂等键（防重复入队，ADR-187 D-187-8） */
const REFRESH_JOB_ID = 'refresh-douban-collections'

let schedulerTimer: NodeJS.Timeout | null = null
let tickRunning = false

export async function runDoubanCollectionsTick(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    const jobData: DoubanCollectionsJobData = { kind: 'refresh' }
    await doubanCollectionsQueue.add(jobData, {
      jobId: REFRESH_JOB_ID,
      removeOnComplete: true,
      removeOnFail: true,
    })
    schedulerLog.info({ stage: 'refresh-douban-collections' }, 'enqueued')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'refresh-douban-collections' }, 'tick failed')
  } finally {
    tickRunning = false
  }
}

export function registerDoubanCollectionsScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runDoubanCollectionsTick()
  }, DOUBAN_COLLECTIONS_TICK_MS)
  schedulerLog.info({ interval_ms: DOUBAN_COLLECTIONS_TICK_MS }, 'registered')
}
