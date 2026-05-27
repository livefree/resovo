/**
 * crawlerScheduler.ts — 定时自动采集调度器
 *
 * ADR-154 D-154-5 改动（Fix-D5 CW2-C-EP-A）：
 *   - runSchedulerTick 拆为 dispatch 模式（switch scheduleType）
 *   - 纯判定函数 checkDaily / checkInterval（无 IO，可独立单测）
 *   - persistTriggerMark（R-154-1：createRun 成功后才写锚点）
 *
 * 重要约束：
 * - scheduler 仅负责"创建 run + enqueue tasks"
 * - 不向 crawler-queue 写入可被 worker 误消费的占位 crawl job
 * - R-154-1：interval 锚点写入必须在 createRun 成功之后（防止 createRun 失败后跳窗口）
 */

import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import { CrawlerRunService } from '@/api/services/CrawlerRunService'
import { baseLogger } from '@/api/lib/logger'
import type { AutoCrawlConfig } from '@/types'

const schedulerLog = baseLogger.child({ worker: 'crawler-scheduler' })

const TICK_MS = 60_000
let schedulerTimer: NodeJS.Timeout | null = null
let schedulerTickRunning = false

// ── 纯判定函数（无 IO，可独立单测）──────────────────────────────

/** ADR-155 D-155-6 / EP-1C-1b：marks key 格式辅助（"YYYY-MM-DD HH:MM"） */
function formatDateStr(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function makeMarkKey(dateStr: string, hhmm: string): string {
  return `${dateStr} ${hhmm}`
}

/**
 * ADR-155 §7 风险 / W3-FIX HOTFIX-D：daily 模式 catch-up window
 *
 * 原 checkDaily 精确匹配当前 HH:MM；server 在 dailyTime 那一分钟未运行
 * （部署 / 重启 / 慢启动）→ 该次触发永久错过到次日。CATCH_UP_WINDOW_MIN
 * 给出容错窗口：过去 N 分钟内未触发即视为可补触发，marks 防重保证不重跑。
 *
 * 取值理由：tick 周期 60s × 5 = 5 分钟覆盖 4–5 次 tick 机会；超窗口不补
 * （防止半夜重启误补昨夜 23:59 等远期 dailyTime）。
 */
const CATCH_UP_WINDOW_MIN = 5

/**
 * ADR-155 D-155-6 / EP-1C-1b GC：清理 7 天前的旧 marks keys
 * key 格式 "YYYY-MM-DD HH:MM"，过滤 datePart < cutoff
 */
export function gcOldMarks(
  marks: Record<string, string>,
  now: Date,
  retentionDays = 7,
): Record<string, string> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
  const cutoffDateStr = formatDateStr(cutoff)
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(marks)) {
    const datePart = key.split(' ')[0]
    if (datePart && datePart >= cutoffDateStr) {
      result[key] = value
    }
  }
  return result
}

/**
 * D-154-5 §checkDaily：daily 模式触发判定
 *
 * 历史演进：
 *   - ADR-154 D-154-5：旧 API（dailyTime + lastTriggerDate string + 精确匹配）
 *   - ADR-155 D-155-6 EP-1C-1b：新 API（dailyTimes + marks Record）+ 多时间防重
 *   - W3-FIX HOTFIX-D（本次）：catch-up window（5 分钟容错 / server 故障重启补触发）
 *
 * 判定逻辑：
 *   1. times = dailyTimes（主）兜底 [dailyTime || '03:00']
 *   2. 遍历 times，对每个 HH:MM 计算今天目标时刻
 *   3. 0 ≤ now - target ≤ CATCH_UP_WINDOW_MIN × 60_000 → 在窗口内
 *      - diff < 0：未到，跳过
 *      - diff > 窗口：已过期，跳过（防跨午夜补昨夜 dailyTime）
 *   4. marks[date#HH:MM] 不存在 → 触发；存在 → 防重跳过
 *   5. 早匹配早返回（遍历顺序 = times 数组顺序 = UI chip 列表顺序）
 */
export function checkDaily(
  config: Pick<AutoCrawlConfig, 'dailyTimes'>,
  now: Date,
  marks: Record<string, string>,
): { shouldTrigger: boolean; matchedTime: string | null } {
  // ADR-155 D-155-6 / EP-1C-CLEANUP-B3a：dailyTimes 类型 required + 反序列化兜底非空
  // 信任上游（getAutoCrawlConfig → deserializeAutoCrawlConfig 永远输出非空 ['03:00']）
  const times = config.dailyTimes

  const today = formatDateStr(now)
  const windowMs = CATCH_UP_WINDOW_MIN * 60_000

  for (const time of times) {
    if (!/^\d{2}:\d{2}$/.test(time)) continue
    const [h, m] = time.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue
    if (h < 0 || h > 23 || m < 0 || m > 59) continue

    // 该 dailyTime 今天的目标时刻
    const target = new Date(now)
    target.setHours(h, m, 0, 0)

    const diffMs = now.getTime() - target.getTime()
    // 窗口判断：未来（diff < 0）/ 超窗口（diff > windowMs）跳过
    if (diffMs < 0 || diffMs > windowMs) continue

    // 防重：marks 已含 → 跳过
    if (makeMarkKey(today, time) in marks) continue

    return { shouldTrigger: true, matchedTime: time }
  }

  return { shouldTrigger: false, matchedTime: null }
}

/** D-154-5 §checkInterval：interval 模式触发判定 */
export function checkInterval(
  config: Pick<AutoCrawlConfig, 'intervalMinutes'>,
  now: Date,
  lastTriggerAt: Date | null,
): boolean {
  if (lastTriggerAt === null) return true  // 从未触发：立即触发

  const dueAt = lastTriggerAt.getTime() + config.intervalMinutes * 60_000
  return now.getTime() >= dueAt
}

// ── DB 辅助（有 IO）────────────────────────────────────────────

async function getLastTriggerAt(): Promise<Date | null> {
  const val = await systemSettingsQueries.getSetting(db, 'auto_crawl_last_trigger_at')
  if (!val || val === '') return null
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * ADR-155 D-155-6 / EP-1C-1b R-155-2'：读取 marks JSONB
 * key 格式 "YYYY-MM-DD HH:MM" / value isoTs；解析失败或缺键返回 {}
 */
async function getLastTriggerMarks(): Promise<Record<string, string>> {
  const raw = await systemSettingsQueries.getSetting(db, 'auto_crawl_last_trigger_marks')
  if (!raw || raw === '') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') result[k] = v
      }
      return result
    }
  } catch {
    // ignore malformed JSON
  }
  return {}
}

/**
 * R-154-1：必须在 createRun 成功后调用，防止 createRun 抛错时锚点前进
 *
 * ADR-155 D-155-6 / EP-1C-1b 重构：daily 模式从写 last_trigger_date（天级）改为写
 * last_trigger_marks JSONB key="YYYY-MM-DD HH:MM"。matchedTime 由 checkDaily 返回，
 * 必须由调用方传入；Y-155-2 GC 7 天前 keys 在同一写入 transaction 内完成。
 */
async function persistTriggerMark(
  scheduleType: AutoCrawlConfig['scheduleType'],
  now: Date,
  matchedTime: string | null = null,
): Promise<void> {
  if (scheduleType === 'interval') {
    await systemSettingsQueries.setSetting(db, 'auto_crawl_last_trigger_at', now.toISOString())
    return
  }

  // daily：写 marks + GC
  if (!matchedTime) return  // checkDaily 未匹配时不应进入触发流；防御性 noop
  const marks = await getLastTriggerMarks()
  const today = formatDateStr(now)
  const markKey = makeMarkKey(today, matchedTime)
  const updated = gcOldMarks({ ...marks, [markKey]: now.toISOString() }, now)
  await systemSettingsQueries.setSetting(db, 'auto_crawl_last_trigger_marks', JSON.stringify(updated))
}

// ── 主 tick ────────────────────────────────────────────────────

async function runSchedulerTick(): Promise<void> {
  if (schedulerTickRunning) return
  schedulerTickRunning = true
  try {
    const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
    if (freeze === 'true') return

    const config = await systemSettingsQueries.getAutoCrawlConfig(db)
    if (!config.globalEnabled) return

    const now = new Date()

    // D-154-5 / D-155-6 EP-1C-1b：按 scheduleType dispatch 到纯判定函数
    let shouldTrigger: boolean
    let matchedTime: string | null = null  // daily 模式专用：写 marks 时识别 key
    if (config.scheduleType === 'interval') {
      shouldTrigger = checkInterval(config, now, await getLastTriggerAt())
    } else {
      // 默认 daily（向后兼容；EP-1C-1b 改用 marks JSONB 防重）
      const result = checkDaily(config, now, await getLastTriggerMarks())
      shouldTrigger = result.shouldTrigger
      matchedTime = result.matchedTime
    }

    if (!shouldTrigger) return

    // 触发：创建 run（先 createRun，再写锚点——R-154-1）
    const runService = new CrawlerRunService(db)
    const mode = config.defaultMode
    const hoursAgo = mode === 'incremental' ? 24 : undefined
    await runService.createAndEnqueueRun({
      triggerType: 'schedule',
      mode,
      hoursAgo,
      timeoutSeconds: 1200,
      scheduleId: 'auto-crawl-daily',
    })

    // R-154-1：createRun 成功后才写锚点
    // D-155-6 EP-1C-1b：daily 模式写 marks[date#matchedTime]；interval 模式写 last_trigger_at
    await persistTriggerMark(config.scheduleType, now, matchedTime)

    schedulerLog.info(
      { type: config.scheduleType, mode, interval_minutes: config.intervalMinutes, matched_time: matchedTime },
      'scheduled run created',
    )
  } catch (err) {
    schedulerLog.warn({ err }, 'tick failed')
  } finally {
    schedulerTickRunning = false
  }
}

export async function runTimeoutWatchdogTick(): Promise<void> {
  try {
    const timedOut = await crawlerTasksQueries.markTimedOutRunningTasksWithRunIds(db)
    const stale = await crawlerTasksQueries.markStaleHeartbeatRunningTasksWithRunIds(db)
    const affectedRunIds = Array.from(new Set([...timedOut.runIds, ...stale.runIds]))
    for (const runId of affectedRunIds) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }
    if (timedOut.count > 0) {
      schedulerLog.warn({ count: timedOut.count }, 'timeout watchdog marked tasks as timeout')
    }
    if (stale.count > 0) {
      schedulerLog.warn({ count: stale.count }, 'heartbeat watchdog marked stale running tasks')
    }
    if (affectedRunIds.length > 0) {
      schedulerLog.info({ count: affectedRunIds.length }, 'watchdog synced affected runs')
    }

    // 对所有活跃 run 执行周期性状态同步，消除监控列表滞后（最大 60s）
    const activeRunIds = await crawlerRunsQueries.listActiveRunIds(db)
    for (const runId of activeRunIds) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }
    if (activeRunIds.length > 0) {
      schedulerLog.info({ count: activeRunIds.length }, 'periodic sync applied to active runs')
    }
  } catch (err) {
    schedulerLog.warn({ err }, 'timeout watchdog failed')
  }
}

/** 注册定时采集 scheduler（进程内 tick） */
export function registerCrawlerScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void runSchedulerTick()
    void runTimeoutWatchdogTick()
  }, TICK_MS)
  schedulerLog.info({ interval_ms: TICK_MS }, 'registered')
}
