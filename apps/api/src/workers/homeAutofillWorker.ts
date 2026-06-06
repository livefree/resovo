/**
 * homeAutofillWorker.ts — 首页自动填充候选重算队列消费者
 * （ADR-183 D-183-3.4 / CHG-HOME-AUTOFILL-REFRESH）
 *
 * worker 只委托 Service（identityCandidateWorker 范式）：编排与分派在
 * services/home-autofill/recalculate.ts。full_auto 不写运营表（D-181-4.3），
 * 重算 ≠ 生效（方案 §7.3.4）。
 */

import { homeAutofillQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import type { HomeSectionKey } from '@resovo/types'
import { recalculateSectionSnapshot } from '@/api/services/home-autofill/recalculate'
import { baseLogger, withJob } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'home-autofill-worker' })

export interface HomeAutofillJobData {
  kind: 'recalculate'
  section: HomeSectionKey
  trigger: 'scheduled' | 'manual'
}

export function registerHomeAutofillWorker(): void {
  // concurrency 1：jobId `autofill:${section}` 已保证单 section 串行（D-183-3.3），
  // 全局并发 1 避免多 section 重算同时压映射 JOIN
  homeAutofillQueue.process(1, async (job) => {
    const data = job.data as HomeAutofillJobData
    const jobLog = withJob(workerLog, job)
    const result = await recalculateSectionSnapshot(db, data.section, data.trigger)
    if (result.outcome === 'skipped') {
      jobLog.warn({ section: data.section, skip_reason: result.skipReason }, 'recalculation skipped')
    } else {
      jobLog.info({
        section: data.section,
        trigger: data.trigger,
        snapshot_id: result.snapshotId,
        candidate_count: result.candidateCount,
        gap_count: result.gapCount,
      }, 'snapshot written')
    }
    return result
  })
  workerLog.info({ concurrency: 1 }, 'registered')
}
