/**
 * crawler-scheduling.ts — 采集调度纯函数库
 * CW1-E-EP step 1a / ADR-152 G-152-1
 *
 * 纯函数（无 DB 依赖）抽出至 lib/，供 BackgroundEventService 跨 route 复用；
 * 原函数定义在 routes/admin/crawler.ts，直接在 route 层复用违反 "Route 层不含业务逻辑" 约束。
 */

import type { AutoCrawlConfig } from '@resovo/types'

/**
 * CW1-A 定时面板：计算下一次自动采集触发的 ISO timestamp。
 * - globalEnabled=false / scheduleType !== 'daily' → null
 * - dailyTime 已过今天 → 取明天该时刻
 */
export function computeNextTrigger(
  config: Pick<AutoCrawlConfig, 'globalEnabled' | 'scheduleType' | 'dailyTime'>,
): string | null {
  if (!config.globalEnabled || config.scheduleType !== 'daily') return null
  const [hhRaw, mmRaw] = config.dailyTime.split(':')
  const hh = Number(hhRaw)
  const mm = Number(mmRaw)
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.toISOString()
}
