/**
 * bangumiCollectionsScheduler.ts — Bangumi 派生合集采集定时调度（ADR-189 D-189-2）
 *
 * 6h tick 入队 refresh（calendar 每日变 + heat/rank 榜单无需高频，6h 足够）。**固定 jobId
 * `refresh-bangumi-collections` 幂等键**：上一轮 job 仍在 waiting/active 时再入队静默跳过。
 * per-add removeOnComplete/removeOnFail: true 释放 jobId。Redis/Bull 不可用 → warn 不阻塞进程。
 */

import { bangumiCollectionsQueue } from '@/api/lib/queue'
import type { BangumiCollectionsJobData } from '@/api/workers/bangumiCollectionsWorker'
import { baseLogger } from '@/api/lib/logger'

const schedulerLog = baseLogger.child({ worker: 'bangumi-collections-scheduler' })

/** 6 小时（calendar 每日变 + 榜单无需高频，同 douban-collections 范式） */
export const BANGUMI_COLLECTIONS_TICK_MS = 6 * 3600_000

/** 固定 jobId 幂等键（防重复入队） */
const REFRESH_JOB_ID = 'refresh-bangumi-collections'

let schedulerTimer: NodeJS.Timeout | null = null
let tickRunning = false

export async function runBangumiCollectionsTick(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    const jobData: BangumiCollectionsJobData = { kind: 'refresh' }
    await bangumiCollectionsQueue.add(jobData, {
      jobId: REFRESH_JOB_ID,
      removeOnComplete: true,
      removeOnFail: true,
    })
    schedulerLog.info({ stage: 'refresh-bangumi-collections' }, 'enqueued')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'refresh-bangumi-collections' }, 'tick failed')
  } finally {
    tickRunning = false
  }
}

export function registerBangumiCollectionsScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runBangumiCollectionsTick()
  }, BANGUMI_COLLECTIONS_TICK_MS)
  schedulerLog.info({ interval_ms: BANGUMI_COLLECTIONS_TICK_MS }, 'registered')
}
