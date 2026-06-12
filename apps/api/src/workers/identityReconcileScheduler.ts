/**
 * identityReconcileScheduler.ts — 身份候选版本对账 + 周期重扫调度（GOV-3 / SEQ-20260612-03）
 *
 * arch-reviewer (claude-opus-4-8) 裁决落地：
 * - **拓扑**：apps/api 进程内 setInterval（复刻 bangumiCollectionsScheduler 范式）——
 *   ADR-107 §4 红线 apps/worker 禁 import apps/api，Bull 入队 scheduler 必须同进程。
 * - **jobId**：全链**不设固定 jobId**（BUGFIX-IDENTITY-ENRICH-RESCORE-FIX 教训：低频下
 *   固定 jobId 驻留 completed 历史吞 add 的风险 > 偶发并行 add 成本——后者被 pipeline 内
 *   advisory lock 廉价拦截 lockSkipped）。同进程重入用 tickRunning 内存去抖。
 * - **双触发**：① boot 自愈 tick（延迟 BOOT_DELAY 避启动争抢）——廉价失配检测，仅失配时
 *   入队（bump 部署后小时级自愈，不等次日）；② 每日 tick 无条件入队（周期重扫兜底 =
 *   原 GOV-5；版本失配同 job 顺带治愈）。
 */

import { identityCandidateQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { detectVersionMismatch } from '@/api/services/identity/versionReconcile'
import { baseLogger } from '@/api/lib/logger'

const schedulerLog = baseLogger.child({ worker: 'identity-reconcile-scheduler' })

/** 每日低峰 1 次（env IDENTITY_RECONCILE_TICK_MS 可覆盖） */
export const IDENTITY_RECONCILE_TICK_MS =
  Number(process.env.IDENTITY_RECONCILE_TICK_MS) > 0
    ? Number(process.env.IDENTITY_RECONCILE_TICK_MS)
    : 24 * 3600_000

/** boot 自愈检测延迟（避免与启动期 worker 注册/迁移争抢，参 verify-scheduler 范式） */
const BOOT_DELAY_MS = 5 * 60_000

let schedulerTimer: NodeJS.Timeout | null = null
let bootTimer: NodeJS.Timeout | null = null
let tickRunning = false

async function enqueueReconcile(trigger: 'boot' | 'interval'): Promise<void> {
  await identityCandidateQueue.add(
    { type: 'version-reconcile-rescan' },
    { removeOnComplete: true, removeOnFail: true },
  )
  schedulerLog.info({ stage: 'identity-version-reconcile', trigger }, 'enqueued')
}

/** 每日 tick：无条件入队（周期重扫兜底语义）。 */
export async function runIdentityReconcileTick(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    await enqueueReconcile('interval')
  } catch (err) {
    schedulerLog.warn({ err, stage: 'identity-version-reconcile' }, 'tick failed')
  } finally {
    tickRunning = false
  }
}

/** boot 自愈：仅失配时入队（每次部署重启都全量重扫则浪费）。 */
export async function runIdentityReconcileBootCheck(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    const mismatch = await detectVersionMismatch(db)
    if (mismatch.observationsMissing || mismatch.stalePending) {
      schedulerLog.warn(
        { stage: 'identity-version-reconcile', ...mismatch },
        'version mismatch detected at boot — enqueueing reconcile',
      )
      await enqueueReconcile('boot')
    }
  } catch (err) {
    schedulerLog.warn({ err, stage: 'identity-version-reconcile' }, 'boot check failed')
  } finally {
    tickRunning = false
  }
}

export function registerIdentityReconcileScheduler(): void {
  if (schedulerTimer) return
  bootTimer = setTimeout(() => {
    void runIdentityReconcileBootCheck()
  }, BOOT_DELAY_MS)
  bootTimer.unref?.()
  schedulerTimer = setInterval(() => {
    void runIdentityReconcileTick()
  }, IDENTITY_RECONCILE_TICK_MS)
  schedulerLog.info({ interval_ms: IDENTITY_RECONCILE_TICK_MS, boot_delay_ms: BOOT_DELAY_MS }, 'registered')
}
