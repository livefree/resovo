/**
 * homeAutofillScheduler.ts — 首页自动填充重算调度器
 * （ADR-183 D-183-3.2/3.3 / CHG-HOME-AUTOFILL-REFRESH）
 *
 * 单一 5min tick 扫描 home_section_settings：refresh_interval_minutes 非空且
 * autofill_mode != manual_only 的 section，最新快照 generated_at + interval ≤ NOW()
 * → 入队重算。**不为每 section 建独立 timer**——interval 运营改配后下一 tick 即生效。
 * jobId `autofill:${section}` 固定键幂等（add 命中已存在静默跳过，防 tick 与端点 #7
 * 手动触发竞态）；per-add removeOnComplete/removeOnFail: true 释放 jobId（定频重入
 * 前提——failed 残留 jobId 会永久阻塞后续入队，D-183-3.3）。
 * Redis/Bull 不可用 → warn 不阻塞进程（聚合层回落最近快照或 trending 兜底，D-183-3.6）。
 */

import { homeAutofillQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import type { HomeSectionSettings } from '@resovo/types'
import { listHomeSectionSettings } from '@/api/db/queries/home-section-settings'
import { listLatestSnapshotSummaries } from '@/api/db/queries/home-autofill-snapshots'
import type { HomeAutofillJobData } from '@/api/workers/homeAutofillWorker'
import { baseLogger } from '@/api/lib/logger'

const schedulerLog = baseLogger.child({ worker: 'home-autofill-scheduler' })

/** tick 间隔（D-183-3.2 常量；interval 判定精度 = 本值，非 per-section timer） */
export const AUTOFILL_TICK_MS = 5 * 60_000

let schedulerTimer: NodeJS.Timeout | null = null
let tickRunning = false

/**
 * 单 section 到期判定（纯函数，导出供单测）：
 * interval 为空 / manual_only → 永不到期；无快照 → 立即到期（首份）。
 */
export function isSectionDue(
  settings: Pick<HomeSectionSettings, 'autofillMode' | 'refreshIntervalMinutes'>,
  latestGeneratedAt: string | null,
  now: Date,
): boolean {
  if (settings.refreshIntervalMinutes == null) return false
  if (settings.autofillMode === 'manual_only') return false
  if (!latestGeneratedAt) return true
  const last = Date.parse(latestGeneratedAt)
  if (!Number.isFinite(last)) return true
  return last + settings.refreshIntervalMinutes * 60_000 <= now.getTime()
}

export async function runHomeAutofillTick(now: Date = new Date()): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    const [settingsRows, latest] = await Promise.all([
      listHomeSectionSettings(db),
      listLatestSnapshotSummaries(db),
    ])
    for (const settings of settingsRows) {
      if (!isSectionDue(settings, latest[settings.section]?.generatedAt ?? null, now)) continue
      const jobData: HomeAutofillJobData = {
        kind: 'recalculate',
        section: settings.section,
        trigger: 'scheduled',
      }
      try {
        // 固定 jobId 幂等：已有同 key job（waiting/active/delayed）时 add 静默跳过
        await homeAutofillQueue.add(jobData, {
          jobId: `autofill:${settings.section}`,
          removeOnComplete: true,
          removeOnFail: true,
        })
        schedulerLog.info({ section: settings.section }, 'enqueued')
      } catch (err) {
        // D-183-3.6：入队失败 warn 不阻塞（下一 tick 自然重试）
        schedulerLog.warn({ err, section: settings.section }, 'enqueue failed')
      }
    }
  } catch (err) {
    schedulerLog.warn({ err }, 'tick failed')
  } finally {
    tickRunning = false
  }
}

export function registerHomeAutofillScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runHomeAutofillTick()
  }, AUTOFILL_TICK_MS)
  schedulerLog.info({ interval_ms: AUTOFILL_TICK_MS }, 'registered')
}
