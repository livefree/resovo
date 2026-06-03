/**
 * identityCandidateWorker.ts — 视频身份候选离线重算队列消费者
 * （SEQ-20260602-03 / CHG-VIR-8 / Phase 2b / ADR-105a D-105a-10）
 *
 * 评分逻辑单一真源在 apps/api/src/services/identity/（apps/worker node-cron 禁 import apps/api
 * / ADR-107 §4），故离线 job 落 apps/api Bull 队列。仿 maintenanceWorker：worker 只委托 Service。
 */

import { identityCandidateQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { runIdentityRescore, type IdentityRescoreOptions } from '@/api/services/identity'
import { baseLogger, withJob } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'identity-candidate-worker' })

export interface IdentityCandidateJobData {
  type: 'full-rescan'
  batchSize?: number
  maxBucket?: number
  parserVersion?: string
  scorerVersion?: string
}

export function registerIdentityCandidateWorker(): void {
  // concurrency 1：advisory lock 已保证单实例，并发设 1 避免 Redis 侧浪费
  identityCandidateQueue.process(1, async (job) => {
    const data = job.data as IdentityCandidateJobData
    const jobLog = withJob(workerLog, job)
    const opts: IdentityRescoreOptions = {
      batchSize: data.batchSize,
      maxBucket: data.maxBucket,
      parserVersion: data.parserVersion,
      scorerVersion: data.scorerVersion,
    }
    return runIdentityRescore(db, jobLog, opts)
  })
  workerLog.info({ concurrency: 1 }, 'registered')
}
